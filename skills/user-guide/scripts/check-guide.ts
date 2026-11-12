// Checks a user guide before it is released.
//
//   quarto run check-guide.ts --docs <dir> [--draft] [--no-render]
//
// <dir> holds user-guide.qmd (the spine), _chapters/*.md and images/ with images/IMAGES.md.
// Prints one line per problem, "ERROR: <text>" or "WARN: <text>", after collecting all of them,
// and exits 1 if any line is an ERROR, else 0. Prints nothing when the guide is clean.
//
// --draft turns pictures still marked placeholder and template markers still in the text from
// errors into warnings, for a guide that is not being released yet. --no-render skips
// `quarto render`, which is the slow check.
//
// Checks:
//   - user-guide.qmd exists (when it does not, that is the only line);
//   - images/IMAGES.md exists (when it does not, the picture checks are skipped);
//   - no picture is still marked placeholder;
//   - every picture file has a row, and every row has a file;
//   - every pipe table in a chapter is followed by a ": Caption {#tbl-id}" line;
//   - no unfilled [[TOKEN]] is left in the spine or a chapter;
//   - no `<!-- Template:` marker is left in the spine or a chapter: the starter text under it is
//     sample prose that nobody has confirmed;
//   - `quarto render` exits 0 and prints no warning.

import { quartoCommand } from "./quarto.ts";

const NAME = "check-guide";
const SPINE = "user-guide.qmd";
const IMAGE_FILE = /\.(png|jpe?g|gif|svg|webp)$/i;
const TOKEN = /\[\[[^\[\]\r\n]+\]\]/g;
const TEMPLATE_MARKER = "<!-- Template:";
const RENDER_WARNING = /\bwarn(ing)?\b/i;
const ANSI = /\u001b\[[0-9;]*[A-Za-z]/g;

interface Problem {
  level: "ERROR" | "WARN";
  text: string;
}

type Add = (level: Problem["level"], text: string) => void;

interface Options {
  docs: string;
  draft: boolean;
  render: boolean;
}

/** Collapses every run of whitespace, newlines included, so a problem stays on one line. */
function oneLine(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function parseArgs(argv: string[]): Options {
  let docs: string | undefined;
  let draft = false;
  let render = true;
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (flag === "--draft") {
      draft = true;
    } else if (flag === "--no-render") {
      render = false;
    } else if (flag === "--docs") {
      if (i + 1 >= argv.length) throw new Error("missing a value for --docs");
      docs = argv[++i];
    } else {
      throw new Error(`unknown argument ${flag}`);
    }
  }
  if (!docs) throw new Error("missing --docs <dir>");
  return { docs: docs.replace(/[\\/]+$/, "") || docs, draft, render };
}

async function readIfExists(path: string): Promise<string | undefined> {
  try {
    return await Deno.readTextFile(path);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return undefined;
    throw error;
  }
}

async function namesIn(dir: string, keep: (name: string) => boolean): Promise<string[]> {
  const names: string[] = [];
  try {
    for await (const entry of Deno.readDir(dir)) {
      if (entry.isFile && keep(entry.name)) names.push(entry.name);
    }
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) throw error;
  }
  return names.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

function linesOf(text: string): string[] {
  return text.split(/\r?\n/);
}

/** Splits a table row on its unescaped pipes and trims the cells. */
function cells(row: string): string[] {
  return row.replace(/^\|/, "").replace(/\|$/, "").split(/(?<!\\)\|/).map((c) => c.trim());
}

/** Flags each line that sits inside a fenced code block, the fences themselves included. */
function codeLines(lines: string[]): boolean[] {
  const inCode: boolean[] = [];
  let fence: { char: string; length: number } | undefined;
  for (const line of lines) {
    const match = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    if (fence === undefined) {
      const opens = match !== null && !(match[1][0] === "`" && match[2].includes("`"));
      if (opens) fence = { char: match[1][0], length: match[1].length };
      inCode.push(opens);
    } else {
      inCode.push(true);
      if (
        match !== null && match[1][0] === fence.char && match[1].length >= fence.length &&
        match[2].trim() === ""
      ) fence = undefined;
    }
  }
  return inCode;
}

function isDelimiterRow(line: string): boolean {
  return line.includes("|") && /^ {0,3}\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/.test(line);
}

/** The 1-based line of the header row of each pipe table that has no `: Caption {#tbl-…}` line. */
function uncaptionedTables(lines: string[]): number[] {
  const inCode = codeLines(lines);
  const found: number[] = [];
  for (let i = 0; i + 1 < lines.length; i++) {
    if (inCode[i] || inCode[i + 1] || !lines[i].includes("|") || !isDelimiterRow(lines[i + 1])) {
      continue;
    }
    const isRow = (n: number) =>
      n < lines.length && !inCode[n] && lines[n].trim() !== "" && lines[n].includes("|");
    let end = i + 2;
    while (isRow(end)) end++;
    let next = end;
    while (next < lines.length && lines[next].trim() === "") next++;

    let captioned = false;
    if (next < lines.length && lines[next].startsWith(": ")) {
      let last = next;
      while (last < lines.length && lines[last].trim() !== "") last++;
      captioned = lines.slice(next, last).join("\n").includes("{#tbl-");
    }
    if (!captioned) found.push(i + 1);
    i = end - 1;
  }
  return found;
}

function checkText(
  file: string,
  text: string,
  isChapter: boolean,
  draft: boolean,
  add: Add,
): void {
  const lines = linesOf(text);
  lines.forEach((line, index) => {
    for (const token of line.match(TOKEN) ?? []) {
      add("ERROR", `${file}:${index + 1}: unfilled template token ${token}`);
    }
    if (line.includes(TEMPLATE_MARKER)) {
      add(
        draft ? "WARN" : "ERROR",
        `${file}:${index + 1}: template marker is still there, so the sample text under it ` +
          "may not be confirmed; rewrite it from the code, then delete the marker line",
      );
    }
  });
  if (!isChapter) return;
  for (const line of uncaptionedTables(lines)) {
    add("ERROR", `${file}:${line}: table has no caption; put ": Caption {#tbl-id}" after it`);
  }
}

async function checkImages(docs: string, draft: boolean, add: Add): Promise<void> {
  const md = await readIfExists(`${docs}/images/IMAGES.md`);
  if (md === undefined) {
    add(
      "ERROR",
      "images/IMAGES.md is missing: it lists every picture, one row each " +
        "(placeholder-card.ts creates it)",
    );
    return;
  }

  const present = await namesIn(`${docs}/images`, () => true);
  const listed = new Set<string>();
  linesOf(md).forEach((line, index) => {
    if (!line.startsWith("| `")) return;
    const where = `images/IMAGES.md:${index + 1}`;
    const row = cells(line);
    const file = /^`([^`]+)`$/.exec(row[0])?.[1];
    if (file === undefined || row.length < 5) {
      add("ERROR", `${where}: row is not "| File | Section | Shows | How to get there | Status |"`);
      return;
    }
    listed.add(file);

    const status = row[4];
    if (/^placeholder/i.test(status)) {
      const why = status.replace(/^placeholder:?\s*/i, "");
      add(
        draft ? "WARN" : "ERROR",
        `${where}: ${file} is still a placeholder${why ? ` (${why})` : ""}`,
      );
    } else if (!/^captured/i.test(status)) {
      add(
        "ERROR",
        `${where}: ${file} has status "${status}"; use "captured" or "placeholder: <why>"`,
      );
    }
    if (!present.includes(file)) {
      add("ERROR", `${where}: ${file} is listed but images/${file} does not exist`);
    }
  });

  for (const file of present.filter((name) => IMAGE_FILE.test(name))) {
    if (!listed.has(file)) add("ERROR", `images/${file} has no row in images/IMAGES.md`);
  }
}

/** The lines `quarto render` printed, without colour codes or the options it echoes first. */
function renderLines(output: string): string[] {
  const kept: string[] = [];
  let echo = false;
  for (const raw of linesOf(output)) {
    const line = raw.replace(ANSI, "").trimEnd();
    if (echo && /^\s+\S/.test(line)) continue;
    echo = /^(pandoc|metadata)$/.test(line);
    if (!echo) kept.push(line);
  }
  return kept;
}

async function checkRender(docs: string, add: Add): Promise<void> {
  const quarto = quartoCommand();
  let result: Deno.CommandOutput;
  try {
    result = await new Deno.Command(quarto, {
      args: ["render", `${docs}/${SPINE}`],
      stdout: "piped",
      stderr: "piped",
    }).output();
  } catch (error) {
    add("ERROR", `cannot start Quarto (${quarto}): ${(error as Error).message}`);
    return;
  }

  const decoder = new TextDecoder();
  const lines = renderLines(`${decoder.decode(result.stdout)}\n${decoder.decode(result.stderr)}`)
    .filter((line) => line.trim() !== "");
  const echoed = new Set<string>();
  const report = (line: string, strip: RegExp) => {
    if (echoed.has(line)) return;
    echoed.add(line);
    add("ERROR", `render: ${line.replace(strip, "") || line}`);
  };

  for (const line of lines.filter((l) => RENDER_WARNING.test(l))) {
    report(line, /^\[?(WARNING|WARN|warning)\]?(\s*\(.*?\.lua:\d+\))?:?\s*/);
  }
  if (result.code !== 0) {
    add("ERROR", `quarto render failed with exit code ${result.code}`);
    let reasons = lines.filter((line) => /^(ERROR|error)\b/.test(line));
    if (reasons.length === 0) reasons = lines.slice(-5);
    for (const line of reasons) report(line, /^((ERROR|error):\s*)+/);
  }
}

async function main(argv: string[]): Promise<void> {
  const options = parseArgs(argv);
  const problems: Problem[] = [];
  const add: Add = (level, text) => problems.push({ level, text: oneLine(text) });

  const spine = await readIfExists(`${options.docs}/${SPINE}`);
  if (spine === undefined) {
    add("ERROR", `${SPINE} is missing from ${options.docs}`);
  } else {
    await checkImages(options.docs, options.draft, add);

    checkText(SPINE, spine, false, options.draft, add);
    for (const name of await namesIn(`${options.docs}/_chapters`, (n) => n.endsWith(".md"))) {
      const text = await Deno.readTextFile(`${options.docs}/_chapters/${name}`);
      checkText(`_chapters/${name}`, text, true, options.draft, add);
    }

    if (options.render) await checkRender(options.docs, add);
  }

  for (const problem of problems) console.log(`${problem.level}: ${problem.text}`);
  if (problems.some((problem) => problem.level === "ERROR")) Deno.exitCode = 1;
}

try {
  await main(Deno.args);
} catch (error) {
  const reason = oneLine(error instanceof Error ? error.message : String(error));
  console.log(`ERROR: ${NAME}: ${reason}`);
  Deno.exitCode = 1;
}
