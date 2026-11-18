/**
 * @file Checks a user guide before it is released.
 *
 * Usage: quarto run check-guide.ts --docs <dir> [--draft] [--no-render]
 *
 * `<dir>` holds user-guide.qmd (the spine), _chapters/*.md and images/ with images/IMAGES.md.
 * Prints one line per problem, "ERROR: <text>" or "WARN: <text>", after collecting all of them,
 * and exits 1 if any line is an ERROR, else 0. Prints nothing when the guide is clean.
 *
 * `--draft` turns pictures still marked placeholder, pictures no chapter uses yet and template
 * markers still in the text from errors into warnings, for a guide that is not being released yet.
 * `--no-render` skips `quarto render`, which is the slow check. A picture named for another
 * chapter is a warning with or without `--draft`.
 *
 * Checks:
 *   - user-guide.qmd exists (when it does not, that is the only line);
 *   - images/IMAGES.md exists (when it does not, the picture checks are skipped);
 *   - no picture is still marked placeholder;
 *   - every picture file has a row, and every row has a file;
 *   - every picture with a row is used by a chapter;
 *   - every picture a chapter uses carries that chapter file's prefix (a warning only);
 *   - every picture sits under a heading with an id, callout titles not counted;
 *   - every pipe table in a chapter is followed by a ": Caption {#tbl-id}" line;
 *   - no unfilled [[TOKEN]] is left in the spine or a chapter;
 *   - no `<!-- Template:` marker is left in the spine or a chapter: the starter text under it is
 *     sample prose that nobody has confirmed;
 *   - `quarto render` exits 0 and prints no warning.
 */

import { quartoCommand } from "./quarto.ts";

const NAME = "check-guide";
const SPINE = "user-guide.qmd";
const IMAGE_FILE = /\.(png|jpe?g|gif|svg|webp)$/i;
const TOKEN = /\[\[[^\[\]\r\n]+\]\]/g;
const TEMPLATE_MARKER = "<!-- Template:";
const IMAGE_USE = /(?<![\w./-])images\/([A-Za-z0-9._-]+)/g;
const PREFIX = /^([A-Za-z0-9]+)-/;
const RENDER_WARNING = /\bwarn(ing)?\b/i;
const ANSI = /\u001b\[[0-9;]*[A-Za-z]/g;

/** One line of output: an ERROR fails the check, a WARN does not. */
interface Problem {
  level: "ERROR" | "WARN";
  text: string;
}

/** Records a problem for the final report. */
type Add = (level: Problem["level"], text: string) => void;

/** The parsed command line. */
interface Options {
  /** The guide folder, without a trailing separator. */
  docs: string;
  /** Whether `--draft` was given. */
  draft: boolean;
  /** False when `--no-render` was given. */
  render: boolean;
}

/** Collapses every run of whitespace, newlines included, so a problem stays on one line. */
function oneLine(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * Parses the command line into options.
 *
 * @throws Error when an argument is unknown, or `--docs` has no value or is missing.
 */
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

/**
 * Reads a text file, or returns undefined when it does not exist.
 *
 * @throws Any read error other than a missing file.
 */
async function readIfExists(path: string): Promise<string | undefined> {
  try {
    return await Deno.readTextFile(path);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return undefined;
    throw error;
  }
}

/**
 * Lists the names of the files directly inside `dir` that `keep` accepts, in code-unit order
 * rather than locale order. Subfolders are skipped, and a folder that does not exist gives an
 * empty list.
 *
 * @throws Any read error other than a missing folder.
 */
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

/** Splits text into lines on LF or CRLF. */
function linesOf(text: string): string[] {
  return text.split(/\r?\n/);
}

/** Splits a table row on its unescaped pipes, ignoring the outer ones, and trims the cells. */
function cells(row: string): string[] {
  return row.replace(/^\|/, "").replace(/\|$/, "").split(/(?<!\\)\|/).map((c) => c.trim());
}

/**
 * Flags each line that sits inside a fenced code block, the fences themselves included.
 *
 * @returns One flag per entry of `lines`, in the same order.
 */
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

/** Returns whether a line is the `| --- | :---: |` row that separates a pipe table's header. */
function isDelimiterRow(line: string): boolean {
  return line.includes("|") && /^ {0,3}\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/.test(line);
}

/**
 * Returns the 1-based line of the header row of each pipe table that has no
 * `: Caption {#tbl-…}` line. Tables inside fenced code are ignored; the caption may follow blank
 * lines and may wrap, but the `{#tbl-` id must be in it.
 */
function uncaptionedTables(lines: string[]): number[] {
  const inCode = codeLines(lines);
  const found: number[] = [];
  for (let i = 0; i + 1 < lines.length; i++) {
    if (inCode[i] || inCode[i + 1] || !lines[i].includes("|") || !isDelimiterRow(lines[i + 1])) {
      continue;
    }
    /** Whether line `n` continues the table: outside code, not blank, and holding a pipe. */
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

/**
 * Reports each unfilled `[[TOKEN]]` and each `<!-- Template:` marker in the spine or a chapter,
 * and, for a chapter, each pipe table without a caption.
 *
 * @param file - The name shown in messages, relative to the guide folder.
 * @param isChapter - Whether table captions are checked, which they are for chapters only.
 * @param draft - Reports template markers as warnings; an unfilled token is an error either way.
 */
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

/**
 * Returns, for each picture file name a chapter points at outside fenced code, the chapter files
 * that point at it. Reports each picture whose heading has no id, as an error: its IMAGES.md row
 * names the section by that id.
 *
 * @param chapters - Each chapter's file name and text.
 */
function picturesUsed(
  chapters: { name: string; text: string }[],
  add: Add,
): Map<string, string[]> {
  const used = new Map<string, string[]>();
  for (const { name, text } of chapters) {
    const lines = linesOf(text);
    const inCode = codeLines(lines);
    const divs: boolean[] = [];
    let heading: { text: string; id: boolean } | undefined;
    lines.forEach((line, index) => {
      if (inCode[index]) return;
      if (/^:::+\s*\{/.test(line)) divs.push(/\.callout/.test(line));
      else if (/^:::+\s*$/.test(line)) divs.pop();
      const title = /^#{1,6}\s+(.*?)\s*$/.exec(line);
      if (title && !divs.includes(true)) {
        heading = { text: title[1].replace(/\s*\{[^}]*\}$/, ""), id: /\{#[^}\s]+/.test(title[1]) };
      }
      for (const match of line.matchAll(IMAGE_USE)) {
        const users = used.get(match[1]) ?? [];
        if (!users.includes(name)) users.push(name);
        used.set(match[1], users);
        if (heading !== undefined && !heading.id && IMAGE_FILE.test(match[1])) {
          add(
            "ERROR",
            `_chapters/${name}:${index + 1}: images/${match[1]} sits under "${heading.text}", ` +
              "which has no id; give that heading one ({#sec-…}) for its IMAGES.md row to name",
          );
        }
      }
    });
  }
  return used;
}

/**
 * Warns about each picture that carries the prefix of no chapter using it, naming the name it
 * should have: a chapter file renumbered without its pictures leaves them on the old number.
 */
function checkPrefixes(used: Map<string, string[]>, add: Add): void {
  for (const [file, users] of used) {
    if (!IMAGE_FILE.test(file)) continue;
    const prefixes = users.flatMap((user) => PREFIX.exec(user)?.[1] ?? []);
    const own = PREFIX.exec(file)?.[1];
    if (prefixes.length === 0 || (own !== undefined && prefixes.includes(own))) continue;
    const rename = own === undefined
      ? `${prefixes[0]}-${file}`
      : file.replace(PREFIX, `${prefixes[0]}-`);
    const chapter = users.length === 1 ? "its chapter" : "any chapter that uses it";
    add(
      "WARN",
      `images/${file} is not named for ${chapter} (_chapters/${users.join(", _chapters/")}); ` +
        `rename it ${rename}, with its figure and its IMAGES.md row`,
    );
  }
}

/**
 * Checks images/IMAGES.md against the files in images/ and the pictures the chapters use: every
 * row is well formed with a status of "captured" or "placeholder: <why>", every row has a file,
 * every picture file has a row, and every picture with a row is used by a chapter. Reports one
 * error and checks nothing else when IMAGES.md is missing.
 *
 * @param docs - The guide folder.
 * @param used - The pictures the chapters use, from {@link picturesUsed}.
 * @param draft - Reports pictures still marked placeholder, and pictures no chapter uses yet, as
 * warnings instead of errors.
 */
async function checkImages(
  docs: string,
  used: Map<string, string[]>,
  draft: boolean,
  add: Add,
): Promise<void> {
  const md = await readIfExists(`${docs}/images/IMAGES.md`);
  if (md === undefined) {
    add(
      "ERROR",
      "images/IMAGES.md is missing: copy templates/images/IMAGES.md from the user-guide skill, " +
        "fill its Capture it line and give every picture a row",
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
    } else if (IMAGE_FILE.test(file) && !used.has(file)) {
      add(
        draft ? "WARN" : "ERROR",
        `${where}: no chapter uses ${file}; place its figure, or delete the picture and its row`,
      );
    }
  });

  for (const file of present.filter((name) => IMAGE_FILE.test(name))) {
    if (!listed.has(file)) add("ERROR", `images/${file} has no row in images/IMAGES.md`);
  }
}

/**
 * Returns the lines `quarto render` printed, without colour codes or the options it echoes first.
 *
 * @param output - Its standard output and standard error, joined.
 */
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

/**
 * Runs `quarto render` on the spine and reports every line that mentions a warning, and, when it
 * exits non-zero, the failure with its reasons. Reports one error instead when Quarto cannot be
 * started. Every render problem is an error, in draft mode too.
 */
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
  /** Adds `line` as an error unless it was already reported, with the `strip` prefix removed. */
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

/**
 * Runs the checks, prints the problems, and returns the process exit code.
 *
 * @returns 1 if any problem is an ERROR, else 0.
 * @throws Error when the command line is bad or a file cannot be read; the entry point below
 * prints it as one `ERROR:` line.
 */
async function main(argv: string[]): Promise<number> {
  const options = parseArgs(argv);
  const problems: Problem[] = [];
  const add: Add = (level, text) => problems.push({ level, text: oneLine(text) });

  const spine = await readIfExists(`${options.docs}/${SPINE}`);
  if (spine === undefined) {
    add("ERROR", `${SPINE} is missing from ${options.docs}`);
  } else {
    const chapters: { name: string; text: string }[] = [];
    for (const name of await namesIn(`${options.docs}/_chapters`, (n) => n.endsWith(".md"))) {
      chapters.push({ name, text: await Deno.readTextFile(`${options.docs}/_chapters/${name}`) });
    }
    const used = picturesUsed(chapters, add);

    await checkImages(options.docs, used, options.draft, add);
    checkPrefixes(used, add);

    checkText(SPINE, spine, false, options.draft, add);
    for (const { name, text } of chapters) {
      checkText(`_chapters/${name}`, text, true, options.draft, add);
    }

    if (options.render) await checkRender(options.docs, add);
  }

  for (const problem of problems) console.log(`${problem.level}: ${problem.text}`);
  return problems.some((problem) => problem.level === "ERROR") ? 1 : 0;
}

try {
  Deno.exit(await main(Deno.args));
} catch (error) {
  const reason = oneLine(error instanceof Error ? error.message : String(error));
  console.log(`ERROR: ${NAME}: ${reason}`);
  Deno.exit(1);
}
