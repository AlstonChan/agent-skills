/**
 * @file Draws the standard "REPLACE ME" card for a screenshot that has not been taken yet and
 * records it in docs/images/IMAGES.md.
 *
 * Usage: quarto run placeholder-card.ts --docs <dir> --file <name.png> --section <sec-id>
 *     --shows <text> --how <text> --why <text> [--capture <text>]
 *
 * Writes `<dir>/images/<name.png>` and upserts that picture's row in `<dir>/images/IMAGES.md`.
 * `--capture` defaults to the "Capture it:" line of IMAGES.md; a new IMAGES.md needs it.
 * The card names the folder to save the capture in as `<dir>/images` when `<dir>` is relative,
 * and by the folder's own name when it is absolute, so pass `<dir>` from the repository root.
 * Exits 0 on success; on failure exits 1 with one message line on stderr.
 *
 * A warning from Typst counts as a failure. The usual one is an unknown font: Typst then falls
 * back to another face and still exits 0, so cards would quietly stop matching each other. The
 * card is drawn in a scratch folder and copied out only when Typst printed no warning, so a
 * refused run leaves the image and IMAGES.md exactly as they were.
 */

import { quartoCommand } from "./quarto.ts";

const NAME = "placeholder-card";
const REQUIRED = ["docs", "file", "section", "shows", "how", "why"] as const;
const OPTIONAL = ["capture"] as const;
const PATHS: readonly string[] = ["docs", "file"];
const ANSI = /\u001b\[[0-9;]*[A-Za-z]/g;

const TABLE_HEADER = "| File | Section | Shows | How to get there | Status |";
const TABLE_RULE = "| :--- | :--- | :--- | :--- | :--- |";

/** Collapses every run of whitespace, newlines included, so a text value stays on one table line. */
function oneLine(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * Parses the `--name value` pairs into a record keyed by flag name. Every value but the two paths
 * (`docs` and `file`) is collapsed onto one line.
 *
 * @throws Error when a flag is unknown or has no value, a required flag is missing or empty, or
 * `--file` is not a plain file name ending in .png.
 */
function parseArgs(argv: string[]): Record<string, string> {
  const known: readonly string[] = [...REQUIRED, ...OPTIONAL];
  const values: Record<string, string> = {};
  for (let i = 0; i < argv.length; i += 2) {
    const flag = argv[i];
    if (!flag.startsWith("--") || !known.includes(flag.slice(2))) {
      throw new Error(`unknown argument ${flag}`);
    }
    if (i + 1 >= argv.length) throw new Error(`missing a value for ${flag}`);
    const name = flag.slice(2);
    values[name] = PATHS.includes(name) ? argv[i + 1] : oneLine(argv[i + 1]);
  }
  for (const name of REQUIRED) {
    if (!values[name]) throw new Error(`missing --${name}`);
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*\.png$/.test(values.file)) {
    throw new Error(`--file must be a plain file name ending in .png, not "${values.file}"`);
  }
  return values;
}

/**
 * Returns the text after "Capture it:", or null when the line is missing, empty or still a
 * template slot.
 */
function captureFrom(imagesMd: string | undefined): string | null {
  const match = /^Capture it:[ \t]*(.*?)[ \t]*\r?$/m.exec(imagesMd ?? "");
  if (!match || match[1] === "" || match[1].includes("[[")) return null;
  return match[1];
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
 * Returns the first line of Typst's output that opens a warning, or undefined when it printed
 * none.
 */
function typstWarning(stderr: string): string | undefined {
  return stderr.replace(ANSI, "").split(/\r?\n/).find((line) => /^\s*warning\b/i.test(line))
    ?.trim();
}

/**
 * Draws one placeholder card with Typst and copies it to `<imagesDir>/<card.file>`, creating the
 * folder if needed. The drawing happens in a scratch folder that is always removed, so a failed
 * run writes nothing.
 *
 * @param card - The picture's file name and the texts printed on the card.
 * @throws Error when Quarto cannot be started, Typst fails, or Typst prints a warning.
 */
async function drawCard(
  imagesDir: string,
  card: { file: string; shows: string; how: string; capture: string; folder: string },
): Promise<void> {
  const work = await Deno.makeTempDir({ prefix: `${NAME}-` });
  try {
    await Deno.copyFile(new URL("./placeholder-card.typ", import.meta.url), `${work}/card.typ`);
    await Deno.writeTextFile(`${work}/card.json`, JSON.stringify(card));

    const quarto = quartoCommand();
    let result: Deno.CommandOutput;
    try {
      result = await new Deno.Command(quarto, {
        args: [
          "typst", "compile", `${work}/card.typ`, `${work}/card.png`,
          "--root", work,
          "--input", "data=card.json",
          "--ignore-system-fonts",
          "--ppi", "144",
        ],
        stdout: "null",
        stderr: "piped",
      }).output();
    } catch (error) {
      throw new Error(`cannot start Quarto (${quarto}): ${(error as Error).message}`);
    }
    const stderr = new TextDecoder().decode(result.stderr);
    if (result.code !== 0) {
      const reason = stderr.replace(ANSI, "").split(/\r?\n/).find((line) => line.trim() !== "");
      throw new Error(`Typst failed: ${reason ?? `exit code ${result.code}`}`);
    }
    const warning = typstWarning(stderr);
    if (warning) throw new Error(`Typst warned, so no card was written: ${warning}`);

    await Deno.mkdir(imagesDir, { recursive: true });
    await Deno.copyFile(`${work}/card.png`, `${imagesDir}/${card.file}`);
  } finally {
    await Deno.remove(work, { recursive: true });
  }
}

/**
 * Returns IMAGES.md with `row` added, or replacing the row for the same file. Lines keep the
 * ending they had; lines added take the ending of their neighbour, and a new file uses LF.
 *
 * @param existing - The current IMAGES.md text; undefined or blank starts a new file.
 * @param capture - The "Capture it:" text, written only when a new file is started.
 */
function upsertRow(
  existing: string | undefined,
  capture: string,
  file: string,
  row: string,
): string {
  if (existing === undefined || existing.trim() === "") {
    const header = ["# Images", "", `Capture it: ${capture}`, "", TABLE_HEADER, TABLE_RULE];
    return [...header, row, ""].join("\n");
  }

  const lines: string[] = existing.match(/[^\n]*\n|[^\n]+$/g) ?? [];
  /** Returns the ending of `line`: CRLF, LF, or empty for a last line that has none. */
  const endingOf = (line: string) =>
    line.endsWith("\r\n") ? "\r\n" : line.endsWith("\n") ? "\n" : "";
  const fileEnding = /\r?\n/.exec(existing)?.[0] ?? "\n";

  const same = lines.findIndex((line) => line.startsWith(`| \`${file}\` |`));
  if (same >= 0) {
    lines[same] = row + endingOf(lines[same]);
    return lines.join("");
  }

  const lastRow = lines.findLastIndex((line) => line.startsWith("| `"));
  const after = lastRow >= 0 ? lastRow : lines.findLastIndex((line) => line.startsWith("| :---"));
  if (after >= 0) {
    const ending = endingOf(lines[after]) || fileEnding;
    if (endingOf(lines[after]) === "") lines[after] += ending;
    lines.splice(after + 1, 0, row + ending);
    return lines.join("");
  }

  const last = lines.length - 1;
  if (endingOf(lines[last]) === "") lines[last] += fileEnding;
  if (lines[last].trim() !== "") lines.push(fileEnding);
  lines.push(TABLE_HEADER + fileEnding, TABLE_RULE + fileEnding, row + fileEnding);
  return lines.join("");
}

/**
 * Returns the images folder as the card names it, with forward slashes: `<docs>/images` for a
 * relative `docs`, or the folder's own name plus `/images` for an absolute one, which would
 * otherwise print a path that exists only on the machine that drew the card.
 */
function shownFolder(docs: string): string {
  const slashed = docs.replace(/\\/g, "/");
  if (!/^([A-Za-z]:)?\//.test(slashed)) return `${slashed}/images`;
  const name = slashed.split("/").filter((part) => part !== "").pop();
  return `${name === undefined || /^[A-Za-z]:$/.test(name) ? "docs" : name}/images`;
}

/**
 * Draws the card, then writes its row to IMAGES.md; IMAGES.md is touched only after the card was
 * written.
 *
 * @throws Error on bad arguments, when no "Capture it:" text can be found, or when the card cannot
 * be drawn; the entry point below prints it on one stderr line and exits 1.
 */
async function main(argv: string[]): Promise<void> {
  const args = parseArgs(argv);
  const docs = args.docs.replace(/[\\/]+$/, "");
  const imagesDir = `${docs}/images`;
  const imagesMdPath = `${imagesDir}/IMAGES.md`;

  const imagesMd = await readIfExists(imagesMdPath);
  const capture = args.capture || captureFrom(imagesMd);
  if (!capture) {
    throw new Error(
      `no "Capture it:" text: pass --capture, or put a "Capture it:" line in ${imagesMdPath}`,
    );
  }

  await drawCard(imagesDir, {
    file: args.file,
    shows: args.shows,
    how: args.how,
    capture,
    folder: shownFolder(docs),
  });

  /** Escapes the pipes in a value so it stays inside one table cell. */
  const cell = (text: string) => text.replace(/\|/g, "\\|");
  const row = `| \`${args.file}\` | ${cell(args.section)} | ${cell(args.shows)} | ` +
    `${cell(args.how)} | placeholder: ${cell(args.why)} |`;
  await Deno.writeTextFile(imagesMdPath, upsertRow(imagesMd, capture, args.file, row));
  console.log(`${NAME}: wrote ${imagesDir}/${args.file} and its row in IMAGES.md`);
}

try {
  await main(Deno.args);
} catch (error) {
  console.error(`${NAME}: ${oneLine(error instanceof Error ? error.message : String(error))}`);
  Deno.exit(1);
}
