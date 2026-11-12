// Draws the standard "REPLACE ME" card for a screenshot that has not been taken yet and records
// it in docs/images/IMAGES.md.
//
//   quarto run placeholder-card.ts --docs <dir> --file <name.png> --section <sec-id>
//       --shows <text> --how <text> --why <text> [--capture <text>]
//
// Writes <dir>/images/<name.png> and upserts that picture's row in <dir>/images/IMAGES.md.
// --capture defaults to the "Capture it:" line of IMAGES.md; a new IMAGES.md needs it.
// Exits 0 on success; on failure exits 1 with one message line on stderr.

const NAME = "placeholder-card";
const REQUIRED = ["docs", "file", "section", "shows", "how", "why"] as const;
const OPTIONAL = ["capture"] as const;

const TABLE_HEADER = "| File | Section | Shows | How to get there | Status |";
const TABLE_RULE = "| :--- | :--- | :--- | :--- | :--- |";

function quartoCommand(): string {
  const bin = Deno.env.get("QUARTO_BIN_PATH");
  if (!bin) return "quarto";
  return `${bin.replace(/[\\/]+$/, "")}/${Deno.build.os === "windows" ? "quarto.exe" : "quarto"}`;
}

/** Collapses every run of whitespace, newlines included, so a value stays on one table line. */
function oneLine(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function parseArgs(argv: string[]): Record<string, string> {
  const known: readonly string[] = [...REQUIRED, ...OPTIONAL];
  const values: Record<string, string> = {};
  for (let i = 0; i < argv.length; i += 2) {
    const flag = argv[i];
    if (!flag.startsWith("--") || !known.includes(flag.slice(2))) {
      throw new Error(`unknown argument ${flag}`);
    }
    if (i + 1 >= argv.length) throw new Error(`missing a value for ${flag}`);
    values[flag.slice(2)] = oneLine(argv[i + 1]);
  }
  for (const name of REQUIRED) {
    if (!values[name]) throw new Error(`missing --${name}`);
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*\.png$/.test(values.file)) {
    throw new Error(`--file must be a plain file name ending in .png, not "${values.file}"`);
  }
  return values;
}

/** The text after "Capture it:", or null when the line is missing, empty or still a template slot. */
function captureFrom(imagesMd: string | undefined): string | null {
  const match = /^Capture it:[ \t]*(.*?)[ \t]*\r?$/m.exec(imagesMd ?? "");
  if (!match || match[1] === "" || match[1].includes("[[")) return null;
  return match[1];
}

async function readIfExists(path: string): Promise<string | undefined> {
  try {
    return await Deno.readTextFile(path);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return undefined;
    throw error;
  }
}

async function drawCard(
  output: string,
  card: { file: string; shows: string; how: string; capture: string },
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
          "typst", "compile", `${work}/card.typ`, output,
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
    if (result.code !== 0) {
      const reason = new TextDecoder().decode(result.stderr).split(/\r?\n/)
        .find((line) => line.trim() !== "");
      throw new Error(`Typst failed: ${reason ?? `exit code ${result.code}`}`);
    }
  } finally {
    await Deno.remove(work, { recursive: true });
  }
}

/**
 * Returns IMAGES.md with `row` added, or replacing the row for the same file. Lines keep the
 * ending they had; lines added take the ending of their neighbour, and a new file uses LF.
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

  await Deno.mkdir(imagesDir, { recursive: true });
  await drawCard(`${imagesDir}/${args.file}`, {
    file: args.file,
    shows: args.shows,
    how: args.how,
    capture,
  });

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
