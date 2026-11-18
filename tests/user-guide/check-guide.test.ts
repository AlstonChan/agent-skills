/**
 * @file Pins check-guide.ts by running it on small guides built on disk: a clean guide passes, and
 * each rule (placeholders, orphan or missing pictures, uncaptioned tables, template tokens and
 * markers, render warnings and failures) gives its ERROR or WARN line, with `--draft` softening
 * some of them and `--no-render` skipping the render.
 */

import { assert, assertEquals, newTestDir, runScript, skillDir } from "./helpers.ts";

const script = `${skillDir}/scripts/check-guide.ts`;
const cardScript = `${skillDir}/scripts/placeholder-card.ts`;

const HEADER = "| File | Section | Shows | How to get there | Status |";
const RULE = "| :--- | :--- | :--- | :--- | :--- |";
const MAIN_ROW =
  "| `01-main-window.png` | sec-getting-started | The main window. | Start the app. | captured |";

const SPINE = [
  "---",
  'title: "Sample Viewer User Guide"',
  'subtitle: "Unversioned"',
  'author: "Sample Company"',
  "---",
  "",
  "{{< include _chapters/01-getting-started.md >}}",
  "",
].join("\n");

const CHAPTER = [
  "# Getting started {#sec-getting-started}",
  "",
  "Open the app. The window is shown in @fig-main and the options in @tbl-options.",
  "",
  "| Option | Meaning |",
  "| :--- | :--- |",
  "| Fast | Skips the preview. |",
  "",
  ": Options of the viewer {#tbl-options}",
  "",
  "![The main window.](images/01-main-window.png){#fig-main}",
  "",
].join("\n");

const QUARTO_YML = ["project:", "  type: default", "", "format: typst", ""].join("\n");

/** Returns the text of an IMAGES.md that holds `rows` under the standard header. */
const imagesMd = (...rows: string[]) =>
  ["# Images", "", "Capture it: Press the capture hotkey.", "", HEADER, RULE, ...rows, ""].join(
    "\n",
  );

let card: Promise<Uint8Array> | undefined;

/**
 * Returns the bytes of one placeholder card, drawn by the real generator the first time it is
 * needed and reused after that.
 */
function cardPng(): Promise<Uint8Array> {
  card ??= (async () => {
    const dir = await newTestDir("check-card");
    const result = await runScript(cardScript, [
      "--docs", dir,
      "--file", "card.png",
      "--section", "sec-getting-started",
      "--shows", "The main window.",
      "--how", "Start the app.",
      "--why", "new picture",
      "--capture", "Press the capture hotkey.",
    ]);
    assertEquals(0, result.code, `fixture card exit code (stderr: ${result.stderr.trim()})`);
    return await Deno.readFile(`${dir}/images/card.png`);
  })();
  return card;
}

/**
 * Builds a minimal guide that passes every check: one chapter, one captioned table, one captured
 * image.
 *
 * @param name - Names the test folder the guide is built in.
 * @param folder - The guide folder's name inside it, so a test can use a name with spaces.
 * @returns The guide folder's path.
 */
async function buildGuide(name: string, folder = "docs"): Promise<string> {
  const docs = `${await newTestDir(name)}/${folder}`;
  await Deno.mkdir(`${docs}/_chapters`, { recursive: true });
  await Deno.mkdir(`${docs}/images`);
  await Deno.writeTextFile(`${docs}/_quarto.yml`, QUARTO_YML);
  await Deno.writeTextFile(`${docs}/user-guide.qmd`, SPINE);
  await Deno.writeTextFile(`${docs}/_chapters/01-getting-started.md`, CHAPTER);
  await Deno.writeFile(`${docs}/images/01-main-window.png`, await cardPng());
  await Deno.writeTextFile(`${docs}/images/IMAGES.md`, imagesMd(MAIN_ROW));
  return docs;
}

/** Appends `text` to the existing file at `path`. */
async function appendTo(path: string, text: string): Promise<void> {
  await Deno.writeTextFile(path, (await Deno.readTextFile(path)) + text);
}

/**
 * Runs check-guide.ts on `docs` with the extra `flags`, and sorts its output lines into `errors`
 * and `warnings` beside the raw result.
 *
 * @throws Error when an output line is neither an `ERROR: ` nor a `WARN: ` line.
 */
async function check(docs: string, ...flags: string[]) {
  const result = await runScript(script, ["--docs", docs, ...flags]);
  const lines = result.stdout.split(/\r?\n/).filter((line) => line.trim() !== "");
  for (const line of lines) {
    assert(/^(ERROR|WARN): \S/.test(line), `every output line is ERROR: or WARN: text: ${line}`);
  }
  return {
    ...result,
    errors: lines.filter((line) => line.startsWith("ERROR: ")),
    warnings: lines.filter((line) => line.startsWith("WARN: ")),
  };
}

/** Formats a run's exit code and both output streams for an assertion message. */
function describe(result: { code: number; stdout: string; stderr: string }): string {
  return `exit ${result.code}, stdout: ${result.stdout.trim()}, stderr: ${result.stderr.trim()}`;
}

/** Test cases run by run-tests.ts, keyed by name. */
export const tests: Record<string, () => Promise<void>> = {
  "clean guide passes": async () => {
    const docs = await buildGuide("check-clean", "docs  with spaces");
    const result = await check(docs);
    assertEquals(0, result.code, `exit code (${describe(result)})`);
    assertEquals([], result.errors, "ERROR lines");
    assertEquals([], result.warnings, "WARN lines");
  },

  "placeholder fails, draft warns": async () => {
    const docs = await buildGuide("check-placeholder");
    const made = await runScript(cardScript, [
      "--docs", docs,
      "--file", "02-settings.png",
      "--section", "sec-settings",
      "--shows", "The settings window.",
      "--how", "Open Settings.",
      "--why", "new picture",
    ]);
    assertEquals(0, made.code, `exit code of the second card (stderr: ${made.stderr.trim()})`);
    await Deno.writeTextFile(
      `${docs}/_chapters/02-settings.md`,
      "# Settings {#sec-settings}\n\n![The settings window.](images/02-settings.png)\n",
    );

    const strict = await check(docs, "--no-render");
    assertEquals(1, strict.code, `exit code (${describe(strict)})`);
    assertEquals(1, strict.errors.length, `ERROR lines: ${strict.errors.join(" / ")}`);
    assert(strict.errors[0].includes("02-settings.png"), `names the file: ${strict.errors[0]}`);

    const draft = await check(docs, "--draft");
    assertEquals(0, draft.code, `exit code with --draft (${describe(draft)})`);
    assertEquals([], draft.errors, "ERROR lines with --draft");
    assertEquals(1, draft.warnings.length, `WARN lines: ${draft.warnings.join(" / ")}`);
    assert(draft.warnings[0].includes("02-settings.png"), `names the file: ${draft.warnings[0]}`);
  },

  "a picture no chapter uses fails, draft warns": async () => {
    const docs = await buildGuide("check-unused");
    await Deno.writeFile(`${docs}/images/01-spare.png`, await cardPng());
    await Deno.writeTextFile(
      `${docs}/images/IMAGES.md`,
      imagesMd(MAIN_ROW, "| `01-spare.png` | sec-getting-started | Spare. | Nowhere. | captured |"),
    );
    await appendTo(
      `${docs}/_chapters/01-getting-started.md`,
      "\n```markdown\n![Only an example.](images/01-spare.png)\n```\n",
    );

    const strict = await check(docs, "--no-render");
    assertEquals(1, strict.code, `exit code (${describe(strict)})`);
    assertEquals(1, strict.errors.length, `ERROR lines: ${strict.errors.join(" / ")}`);
    assert(strict.errors[0].includes("01-spare.png"), `names the file: ${strict.errors[0]}`);

    const draft = await check(docs, "--draft", "--no-render");
    assertEquals(0, draft.code, `exit code with --draft (${describe(draft)})`);
    assertEquals(1, draft.warnings.length, `WARN lines: ${draft.warnings.join(" / ")}`);
  },

  "a picture named for another chapter warns": async () => {
    const docs = await buildGuide("check-prefix");
    const chapter = `${docs}/_chapters/01-getting-started.md`;
    await Deno.writeTextFile(
      chapter,
      CHAPTER.replace("images/01-main-window.png", "images/07-main-window.png"),
    );
    await Deno.rename(`${docs}/images/01-main-window.png`, `${docs}/images/07-main-window.png`);
    await Deno.writeTextFile(
      `${docs}/images/IMAGES.md`,
      imagesMd(MAIN_ROW.replace("01-main-window.png", "07-main-window.png")),
    );

    const result = await check(docs, "--no-render");
    assertEquals(0, result.code, `a warning does not fail the check (${describe(result)})`);
    assertEquals(1, result.warnings.length, `WARN lines: ${result.warnings.join(" / ")}`);
    assert(
      result.warnings[0].includes("rename it 01-main-window.png"),
      `names the new name: ${result.warnings[0]}`,
    );

    await Deno.writeTextFile(
      `${docs}/_chapters/07-reference.md`,
      "# Reference {#sec-reference}\n\n![Again.](images/07-main-window.png)\n",
    );
    const shared = await check(docs, "--no-render");
    assertEquals([], shared.warnings, "a picture named for one of the chapters using it");
  },

  "a picture under a heading without an id fails, a callout title does not count": async () => {
    const docs = await buildGuide("check-heading-id");
    const chapter = `${docs}/_chapters/01-getting-started.md`;
    const figure = "![The main window.](images/01-main-window.png){#fig-main}";
    const callout = [
      "## Find the main window {#sec-getting-started-window}",
      "",
      "::: {.callout-note}",
      "## Nothing to set up",
      "",
      "The window opens by itself.",
      ":::",
      "",
      figure,
      "",
    ].join("\n");
    await Deno.writeTextFile(chapter, CHAPTER.replace(figure, callout));
    const clean = await check(docs, "--no-render");
    assertEquals(0, clean.code, `a callout title is not the picture's heading (${describe(clean)})`);

    await Deno.writeTextFile(chapter, CHAPTER.replace(figure, `## The window\n\n${figure}`));
    const result = await check(docs, "--draft", "--no-render");
    assertEquals(1, result.code, `exit code, --draft included (${describe(result)})`);
    assertEquals(1, result.errors.length, `ERROR lines: ${result.errors.join(" / ")}`);
    assert(
      result.errors[0].includes('"The window"') && result.errors[0].includes("01-main-window.png"),
      `names the heading and the picture: ${result.errors[0]}`,
    );
  },

  "a missing IMAGES.md names the template": async () => {
    const docs = await buildGuide("check-no-images-md");
    await Deno.remove(`${docs}/images/IMAGES.md`);
    const result = await check(docs, "--no-render");
    assertEquals(1, result.code, `exit code (${describe(result)})`);
    assertEquals(1, result.errors.length, `ERROR lines: ${result.errors.join(" / ")}`);
    assert(
      result.errors[0].includes("templates/images/IMAGES.md"),
      `points at the template: ${result.errors[0]}`,
    );
  },

  "orphan image fails": async () => {
    const docs = await buildGuide("check-orphan");
    await Deno.writeFile(`${docs}/images/stray.png`, await cardPng());
    const result = await check(docs, "--no-render");
    assertEquals(1, result.code, `exit code (${describe(result)})`);
    assertEquals(1, result.errors.length, `ERROR lines: ${result.errors.join(" / ")}`);
    assert(result.errors[0].includes("stray.png"), `names the file: ${result.errors[0]}`);
  },

  "image extensions are matched without regard to case": async () => {
    const docs = await buildGuide("check-extension-case");
    await Deno.writeFile(`${docs}/images/Stray.PNG`, await cardPng());
    const result = await check(docs, "--no-render");
    assertEquals(1, result.code, `exit code (${describe(result)})`);
    assert(result.errors.some((line) => line.includes("Stray.PNG")), "names Stray.PNG");
  },

  "files that are not images are ignored": async () => {
    const docs = await buildGuide("check-not-images");
    await Deno.writeTextFile(`${docs}/images/notes.txt`, "scratch");
    const result = await check(docs, "--no-render");
    assertEquals(0, result.code, `exit code (${describe(result)})`);

    await Deno.writeTextFile(
      `${docs}/images/IMAGES.md`,
      imagesMd(MAIN_ROW, "| `notes.txt` | sec-x | Notes. | Open them. | captured |"),
    );
    const listed = await check(docs, "--no-render");
    assertEquals(0, listed.code, `exit code with a row for the file (${describe(listed)})`);
  },

  "row without file fails": async () => {
    const docs = await buildGuide("check-ghost");
    await Deno.writeTextFile(
      `${docs}/images/IMAGES.md`,
      imagesMd(MAIN_ROW, "| `ghost.png` | sec-x | Nothing. | Nowhere. | captured |"),
    );
    const result = await check(docs, "--no-render");
    assertEquals(1, result.code, `exit code (${describe(result)})`);
    assertEquals(1, result.errors.length, `ERROR lines: ${result.errors.join(" / ")}`);
    assert(result.errors[0].includes("ghost.png"), `names the file: ${result.errors[0]}`);
  },

  "a row with an unreadable status fails": async () => {
    const docs = await buildGuide("check-status");
    await Deno.writeTextFile(
      `${docs}/images/IMAGES.md`,
      imagesMd(
        "| `01-main-window.png` | sec-getting-started | The main window. | Start the app. | todo |",
      ),
    );
    const result = await check(docs, "--no-render");
    assertEquals(1, result.code, `exit code (${describe(result)})`);
    assertEquals(1, result.errors.length, `ERROR lines: ${result.errors.join(" / ")}`);
    assert(result.errors[0].includes("01-main-window.png"), `names the file: ${result.errors[0]}`);
  },

  "uncaptioned table fails": async () => {
    const docs = await buildGuide("check-uncaptioned");
    await appendTo(
      `${docs}/_chapters/01-getting-started.md`,
      ["", "| Key | Action |", "| :--- | :--- |", "| F1 | Help |", "", "Some text after.", ""]
        .join("\n"),
    );
    const result = await check(docs, "--no-render");
    assertEquals(1, result.code, `exit code (${describe(result)})`);
    assertEquals(1, result.errors.length, `ERROR lines: ${result.errors.join(" / ")}`);
    assert(
      result.errors[0].includes("01-getting-started.md"),
      `names the chapter: ${result.errors[0]}`,
    );
  },

  "a caption without an id and a table at the end of the file fail": async () => {
    const docs = await buildGuide("check-caption-id");
    const chapter = `${docs}/_chapters/01-getting-started.md`;
    await appendTo(
      chapter,
      ["", "| Key | Action |", "| :--- | :--- |", "| F1 | Help |", "", ": Keys", ""].join("\n"),
    );
    const noId = await check(docs, "--no-render");
    assertEquals(1, noId.code, `exit code with a caption lacking an id (${describe(noId)})`);
    assertEquals(1, noId.errors.length, `ERROR lines: ${noId.errors.join(" / ")}`);

    await Deno.writeTextFile(
      chapter,
      CHAPTER + ["| Key | Action |", "| :--- | :--- |", "| F1 | Help |"].join("\n"),
    );
    const atEnd = await check(docs, "--no-render");
    assertEquals(1, atEnd.code, `exit code with a table ending the file (${describe(atEnd)})`);
    assertEquals(1, atEnd.errors.length, `ERROR lines: ${atEnd.errors.join(" / ")}`);
  },

  "a caption may wrap and may follow blank lines": async () => {
    const docs = await buildGuide("check-caption-wrap");
    await appendTo(
      `${docs}/_chapters/01-getting-started.md`,
      [
        "",
        "| Key | Action |",
        "| :--- | :--- |",
        "| F1 | Help |",
        "",
        "",
        ": Keys of the viewer, listed in the order",
        "they appear on the toolbar {#tbl-keys}",
        "",
      ].join("\n"),
    );
    const result = await check(docs, "--no-render");
    assertEquals(0, result.code, `exit code (${describe(result)})`);
  },

  "a table inside a code fence needs no caption": async () => {
    const docs = await buildGuide("check-fence");
    await appendTo(
      `${docs}/_chapters/01-getting-started.md`,
      [
        "",
        "```markdown",
        "| Key | Action |",
        "| :--- | :--- |",
        "| F1 | Help |",
        "```",
        "",
        "A line is not a table: a | b",
        "---",
        "",
      ].join("\n"),
    );
    const result = await check(docs, "--no-render");
    assertEquals(0, result.code, `exit code (${describe(result)})`);
  },

  "CRLF chapters are read": async () => {
    const docs = await buildGuide("check-crlf");
    const chapter = `${docs}/_chapters/01-getting-started.md`;
    await Deno.writeTextFile(chapter, CHAPTER.replace(/\n/g, "\r\n"));
    const clean = await check(docs, "--no-render");
    assertEquals(0, clean.code, `exit code of a captioned table (${describe(clean)})`);

    await appendTo(
      chapter,
      "\r\n| Key | Action |\r\n| :--- | :--- |\r\n| F1 | Help |\r\n\r\nText.\r\n",
    );
    const result = await check(docs, "--no-render");
    assertEquals(1, result.code, `exit code of an uncaptioned table (${describe(result)})`);
  },

  "template token fails": async () => {
    const chapterDocs = await buildGuide("check-token-chapter");
    await appendTo(
      `${chapterDocs}/_chapters/01-getting-started.md`,
      "\nWelcome to [[APP_NAME]].\n",
    );
    const inChapter = await check(chapterDocs, "--no-render");
    assertEquals(1, inChapter.code, `exit code (${describe(inChapter)})`);
    assertEquals(1, inChapter.errors.length, `ERROR lines: ${inChapter.errors.join(" / ")}`);
    assert(inChapter.errors[0].includes("[[APP_NAME]]"), `names the token: ${inChapter.errors[0]}`);
    assert(
      inChapter.errors[0].includes("01-getting-started.md"),
      `names the chapter: ${inChapter.errors[0]}`,
    );

    const spineDocs = await buildGuide("check-token-spine");
    await appendTo(`${spineDocs}/user-guide.qmd`, "\nBy [[COMPANY]].\n");
    const inSpine = await check(spineDocs, "--no-render");
    assertEquals(1, inSpine.code, `exit code (${describe(inSpine)})`);
    assertEquals(1, inSpine.errors.length, `ERROR lines: ${inSpine.errors.join(" / ")}`);
    assert(inSpine.errors[0].includes("user-guide.qmd"), `names the spine: ${inSpine.errors[0]}`);
  },

  "template marker fails, draft warns": async () => {
    const marker =
      "<!-- Template: sample text below, rewrite it from the code, then delete this line. -->";

    const docs = await buildGuide("check-marker-chapter");
    await appendTo(`${docs}/_chapters/01-getting-started.md`, `\n${marker}\n`);
    const strict = await check(docs, "--no-render");
    assertEquals(1, strict.code, `exit code (${describe(strict)})`);
    assertEquals(1, strict.errors.length, `ERROR lines: ${strict.errors.join(" / ")}`);
    assert(
      strict.errors[0].includes("_chapters/01-getting-started.md:"),
      `names the chapter and line: ${strict.errors[0]}`,
    );
    assert(strict.errors[0].includes("template marker"), `says what it is: ${strict.errors[0]}`);

    const draft = await check(docs, "--draft", "--no-render");
    assertEquals(0, draft.code, `exit code with --draft (${describe(draft)})`);
    assertEquals([], draft.errors, "ERROR lines with --draft");
    assertEquals(1, draft.warnings.length, `WARN lines: ${draft.warnings.join(" / ")}`);
    assert(
      draft.warnings[0].includes("01-getting-started.md"),
      `names the chapter: ${draft.warnings[0]}`,
    );

    const spineDocs = await buildGuide("check-marker-spine");
    await appendTo(`${spineDocs}/user-guide.qmd`, `\n${marker}\n`);
    const inSpine = await check(spineDocs, "--no-render");
    assertEquals(1, inSpine.code, `exit code (${describe(inSpine)})`);
    assertEquals(1, inSpine.errors.length, `ERROR lines: ${inSpine.errors.join(" / ")}`);
    assert(inSpine.errors[0].includes("user-guide.qmd:"), `names the spine: ${inSpine.errors[0]}`);

    const ordinary = await buildGuide("check-marker-ordinary-comment");
    await appendTo(
      `${ordinary}/_chapters/01-getting-started.md`,
      "\n<!-- An ordinary comment about a template word. -->\n",
    );
    const clean = await check(ordinary, "--no-render");
    assertEquals(0, clean.code, `an ordinary comment is not a marker (${describe(clean)})`);
    assertEquals([], clean.errors, "ERROR lines for an ordinary comment");
  },

  "broken cross-reference fails": async () => {
    const docs = await buildGuide("check-xref");
    await appendTo(`${docs}/_chapters/01-getting-started.md`, "\nSee @sec-nowhere.\n");

    const skipped = await check(docs, "--no-render");
    assertEquals(0, skipped.code, `exit code with --no-render (${describe(skipped)})`);

    const result = await check(docs);
    assertEquals(1, result.code, `exit code (${describe(result)})`);
    assert(
      result.errors.some((line) => line.includes("sec-nowhere")),
      `an ERROR names the reference: ${result.errors.join(" / ")}`,
    );
    assert(!result.stdout.includes("\u001b"), "colour codes are removed from the echoed line");
  },

  "a title that says warning is not a render warning": async () => {
    const docs = await buildGuide("check-title-warning");
    const spine = `${docs}/user-guide.qmd`;
    await Deno.writeTextFile(
      spine,
      (await Deno.readTextFile(spine)).replace("Sample Viewer", "Warning Monitor"),
    );
    const result = await check(docs);
    assertEquals(0, result.code, `exit code (${describe(result)})`);
  },

  "a render failure is reported": async () => {
    const docs = await buildGuide("check-render-failure");
    await appendTo(`${docs}/_chapters/01-getting-started.md`, "\n![Gone.](images/gone.png)\n");
    const result = await check(docs);
    assertEquals(1, result.code, `exit code (${describe(result)})`);
    assert(result.errors.length >= 1, "at least one ERROR line");
    assert(
      result.errors.some((line) => line.includes("gone.png")),
      `an ERROR names the missing picture: ${result.errors.join(" / ")}`,
    );
  },

  "missing IMAGES.md is one line": async () => {
    const docs = await buildGuide("check-no-images-md");
    await Deno.remove(`${docs}/images/IMAGES.md`);
    const result = await check(docs, "--no-render");
    assertEquals(1, result.code, `exit code (${describe(result)})`);
    assertEquals(1, result.errors.length, `ERROR lines: ${result.errors.join(" / ")}`);
    assert(result.errors[0].includes("IMAGES.md"), `names IMAGES.md: ${result.errors[0]}`);
    assertEquals("", result.stderr.trim(), "stderr");
  },

  "missing spine is one line": async () => {
    const docs = `${await newTestDir("check-no-spine")}/docs`;
    await Deno.mkdir(`${docs}/_chapters`, { recursive: true });
    await Deno.writeTextFile(
      `${docs}/_chapters/01-getting-started.md`,
      "Welcome to [[APP_NAME]].\n",
    );
    const result = await check(docs);
    assertEquals(1, result.code, `exit code (${describe(result)})`);
    assertEquals(1, result.errors.length, `ERROR lines: ${result.errors.join(" / ")}`);
    assert(result.errors[0].includes("user-guide.qmd"), `names the spine: ${result.errors[0]}`);
    assertEquals([], result.warnings, "WARN lines");
    assertEquals("", result.stderr.trim(), "stderr");
  },

  "every problem is reported in one run": async () => {
    const docs = await buildGuide("check-all-problems");
    await Deno.writeFile(`${docs}/images/stray.png`, await cardPng());
    await Deno.writeFile(`${docs}/images/soon.png`, await cardPng());
    await Deno.writeTextFile(
      `${docs}/images/IMAGES.md`,
      imagesMd(
        MAIN_ROW,
        "| `ghost.png` | sec-x | Nothing. | Nowhere. | captured |",
        "| `soon.png` | sec-x | Later. | Later. | placeholder: new picture |",
      ),
    );
    await appendTo(
      `${docs}/_chapters/01-getting-started.md`,
      "\n[[AREA_NAME]]\n\n| Key | Action |\n| :--- | :--- |\n| F1 | Help |\n\nText.\n",
    );
    const result = await check(docs, "--no-render");
    assertEquals(1, result.code, `exit code (${describe(result)})`);
    const fragments = [
      "stray.png",
      "ghost.png",
      "soon.png is still a placeholder",
      "no chapter uses soon.png",
      "[[AREA_NAME]]",
      "table",
    ];
    for (const fragment of fragments) {
      assert(
        result.errors.some((line) => line.includes(fragment)),
        `an ERROR mentions ${fragment}: ${result.errors.join(" / ")}`,
      );
    }
    assertEquals(6, result.errors.length, `ERROR lines: ${result.errors.join(" / ")}`);
  },

  "a missing --docs is one line": async () => {
    const result = await runScript(script, []);
    assertEquals(1, result.code, `exit code (${describe(result)})`);
    const lines = result.stdout.split(/\r?\n/).filter((line) => line.trim() !== "");
    assertEquals(1, lines.length, `output lines: ${result.stdout.trim()}`);
    assert(/^ERROR: .*--docs/.test(lines[0]), `names the argument: ${lines[0]}`);
  },
};
