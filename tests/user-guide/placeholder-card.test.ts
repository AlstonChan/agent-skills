import { assert, assertEquals, newTestDir, pngSize, runScript, skillDir } from "./helpers.ts";

const script = `${skillDir}/scripts/placeholder-card.ts`;

const HEADER = "| File | Section | Shows | How to get there | Status |";
const RULE = "| :--- | :--- | :--- | :--- | :--- |";

interface Card {
  file: string;
  section: string;
  shows: string;
  how: string;
  why: string;
  capture?: string;
}

function card(overrides: Partial<Card> = {}): Card {
  return {
    file: "01-main-window.png",
    section: "sec-main-window",
    shows: "The main window after login.",
    how: "Start the app and log in.",
    why: "new picture",
    capture: "Press the capture hotkey.",
    ...overrides,
  };
}

function generate(docs: string, c: Card) {
  const args = [
    "--docs", docs,
    "--file", c.file,
    "--section", c.section,
    "--shows", c.shows,
    "--how", c.how,
    "--why", c.why,
  ];
  if (c.capture !== undefined) args.push("--capture", c.capture);
  return runScript(script, args);
}

async function generateOk(docs: string, c: Card): Promise<void> {
  const result = await generate(docs, c);
  assertEquals(0, result.code, `exit code of ${c.file} (stderr: ${result.stderr.trim()})`);
}

async function exists(path: string): Promise<boolean> {
  try {
    await Deno.stat(path);
    return true;
  } catch {
    return false;
  }
}

function imagesMd(docs: string): Promise<string> {
  return Deno.readTextFile(`${docs}/images/IMAGES.md`);
}

function rows(text: string): string[] {
  return text.split(/\r?\n/).filter((line) => line.startsWith("| `"));
}

/** Splits a table row on its unescaped pipes and trims the cells. */
function cells(row: string): string[] {
  return row.replace(/^\|/, "").replace(/\|$/, "").split(/(?<!\\)\|/).map((c) => c.trim());
}

export const tests: Record<string, () => Promise<void>> = {
  "card is written and row added": async () => {
    const docs = await newTestDir("card-written");
    await generateOk(docs, card());

    const size = await pngSize(`${docs}/images/01-main-window.png`);
    assertEquals(1200, size.width, "card width in pixels (600pt at 144 ppi)");

    const md = await imagesMd(docs);
    assertEquals(
      [
        "# Images",
        "",
        "Capture it: Press the capture hotkey.",
        "",
        HEADER,
        RULE,
        "| `01-main-window.png` | sec-main-window | The main window after login. | " +
        "Start the app and log in. | placeholder: new picture |",
        "",
      ].join("\n"),
      md,
      "new IMAGES.md",
    );
  },

  "cards share one width": async () => {
    const docs = await newTestDir("card-width");
    const lengths = [10, 300, 1500];
    const sizes = [];
    for (const length of lengths) {
      const file = `card-${length}.png`;
      const shows = "word ".repeat(Math.ceil(length / 5)).slice(0, length).trim();
      await generateOk(docs, card({ file, shows }));
      sizes.push(await pngSize(`${docs}/images/${file}`));
    }
    assertEquals(sizes[0].width, sizes[1].width, "10 and 300 character widths");
    assertEquals(sizes[0].width, sizes[2].width, "10 and 1500 character widths");
    assert(
      sizes[2].height > sizes[0].height,
      `1500 characters (${sizes[2].height}px) is taller than 10 (${sizes[0].height}px)`,
    );
  },

  "same inputs give the same bytes": async () => {
    const first = await newTestDir("card-bytes-a");
    const second = await newTestDir("card-bytes-b");
    await generateOk(first, card());
    await generateOk(second, card());
    const a = await Deno.readFile(`${first}/images/01-main-window.png`);
    const b = await Deno.readFile(`${second}/images/01-main-window.png`);
    assertEquals(a.length, b.length, "PNG length");
    assert(a.every((byte, i) => byte === b[i]), "PNG bytes differ between two runs");
  },

  "special characters render literally": async () => {
    const docs = await newTestDir("card-special");
    const shows = 'Click #Save, then $5 *bold* _x_ <a> "q" C:\\path\\ 5 µm é';
    await generateOk(docs, card({ shows }));
    await pngSize(`${docs}/images/01-main-window.png`);
    const [row] = rows(await imagesMd(docs));
    assertEquals(shows, cells(row)[2], "Shows cell");
  },

  "pipe is escaped in the row": async () => {
    const docs = await newTestDir("card-pipe");
    await generateOk(docs, card({ shows: "A | B", how: "C | D", why: "E | F" }));
    const found = rows(await imagesMd(docs));
    assertEquals(1, found.length, "row count");
    assert(found[0].includes("A \\| B"), `Shows keeps its pipe escaped: ${found[0]}`);
    assert(found[0].includes("C \\| D"), `How keeps its pipe escaped: ${found[0]}`);
    assertEquals(5, cells(found[0]).length, "cells in the row");
    assertEquals("placeholder: E \\| F", cells(found[0])[4], "Status cell");
  },

  "newlines in a value do not break the row": async () => {
    const docs = await newTestDir("card-newline");
    await generateOk(docs, card({ how: "Open the menu.\r\nChoose  Save.\nDone." }));
    const text = await imagesMd(docs);
    const found = rows(text);
    assertEquals(1, found.length, "row count");
    assertEquals("Open the menu. Choose Save. Done.", cells(found[0])[3], "How cell");
  },

  "regenerating updates the row": async () => {
    const docs = await newTestDir("card-regenerate");
    await generateOk(docs, card({ why: "new picture" }));
    await generateOk(docs, card({ why: "the toolbar changed" }));
    const found = rows(await imagesMd(docs));
    assertEquals(1, found.length, "row count");
    assertEquals(
      "placeholder: the toolbar changed",
      cells(found[0])[4],
      "Status of the regenerated row",
    );
  },

  "a new file is appended after the existing rows": async () => {
    const docs = await newTestDir("card-append");
    await generateOk(docs, card({ file: "a.png" }));
    await generateOk(docs, card({ file: "b.png" }));
    await generateOk(docs, card({ file: "a.png", why: "stale" }));
    const found = rows(await imagesMd(docs));
    assertEquals(
      ["`a.png`", "`b.png`"],
      found.map((row) => cells(row)[0]),
      "rows in order",
    );
    assertEquals("placeholder: stale", cells(found[0])[4], "a.png status");
  },

  "a hand-written IMAGES.md without a table gets one": async () => {
    const docs = await newTestDir("card-no-table");
    await Deno.mkdir(`${docs}/images`);
    await Deno.writeTextFile(`${docs}/images/IMAGES.md`, "# Images\n\nCapture it: Press F12.");
    await generateOk(docs, card({ capture: undefined }));
    assertEquals(
      [
        "# Images",
        "",
        "Capture it: Press F12.",
        "",
        HEADER,
        RULE,
        "| `01-main-window.png` | sec-main-window | The main window after login. | " +
        "Start the app and log in. | placeholder: new picture |",
        "",
      ].join("\n"),
      await imagesMd(docs),
      "IMAGES.md",
    );
  },

  "capture text comes from IMAGES.md": async () => {
    const docs = await newTestDir("card-capture");
    await Deno.mkdir(`${docs}/images`);
    const md = `${docs}/images/IMAGES.md`;
    const withLine = ["# Images", "", "Capture it: Press F12.", "", HEADER, RULE, ""].join("\n");

    await Deno.writeTextFile(md, withLine);
    await generateOk(docs, card({ capture: undefined }));

    const problems: Array<[string, string | null]> = [
      ["no Capture it line", ["# Images", "", HEADER, RULE, ""].join("\n")],
      ["unfilled Capture it line", withLine.replace("Press F12.", "[[CAPTURE_IT]]")],
      ["no IMAGES.md", null],
    ];
    for (const [name, content] of problems) {
      const dir = await newTestDir("card-capture-missing");
      if (content !== null) {
        await Deno.mkdir(`${dir}/images`);
        await Deno.writeTextFile(`${dir}/images/IMAGES.md`, content);
      }
      const result = await generate(dir, card({ capture: undefined }));
      assertEquals(1, result.code, `exit code with ${name}`);
      assert(
        result.stderr.includes("Capture it"),
        `message names Capture it with ${name}: ${result.stderr.trim()}`,
      );
      assert(
        !(await exists(`${dir}/images/01-main-window.png`)),
        `no card is written with ${name}`,
      );
    }
  },

  "a missing argument is one line on stderr": async () => {
    const docs = await newTestDir("card-missing-arg");
    const result = await runScript(script, [
      "--docs", docs,
      "--file", "01-main-window.png",
      "--section", "sec-main-window",
      "--shows", "The main window.",
      "--how", "Start the app.",
    ]);
    assertEquals(1, result.code, "exit code");
    const lines = result.stderr.split(/\r?\n/).filter((line) => line.trim() !== "");
    assertEquals(1, lines.length, `lines on stderr: ${result.stderr.trim()}`);
    assert(lines[0].includes("--why"), `message names the argument: ${lines[0]}`);
  },

  "a docs folder name with two spaces is used as written": async () => {
    const docs = `${await newTestDir("card-double-space")}/two  spaces`;
    await generateOk(docs, card());
    await pngSize(`${docs}/images/01-main-window.png`);
    assertEquals(1, rows(await imagesMd(docs)).length, "row count");
  },

  "a Typst warning refuses the card and changes nothing": async () => {
    // Typst only warns, and still exits 0, when the card names a font it does not embed. The
    // script runs from a copy of its own folder whose template names such a font, so the
    // production template and the script stay as they are.
    const scripts = `${await newTestDir("card-warning")}/scripts`;
    await Deno.mkdir(scripts);
    for (const name of ["placeholder-card.ts", "quarto.ts"]) {
      await Deno.copyFile(`${skillDir}/scripts/${name}`, `${scripts}/${name}`);
    }
    const template = await Deno.readTextFile(`${skillDir}/scripts/placeholder-card.typ`);
    const broken = template.replace('font: "DejaVu Sans Mono"', 'font: "No Such Font"');
    assert(broken !== template, "the card template no longer names DejaVu Sans Mono");
    const copy = `${scripts}/placeholder-card.typ`;
    const args = (docs: string, why = "new picture") => [
      "--docs", docs,
      "--file", "01-main-window.png",
      "--section", "sec-main-window",
      "--shows", "The main window.",
      "--how", "Start the app.",
      "--why", why,
      "--capture", "Press the capture hotkey.",
    ];

    await Deno.writeTextFile(copy, template);
    const control = await newTestDir("card-warning-control");
    const ok = await runScript(`${scripts}/placeholder-card.ts`, args(control));
    assertEquals(0, ok.code, `the copied script draws a card (stderr: ${ok.stderr.trim()})`);
    await pngSize(`${control}/images/01-main-window.png`);

    await Deno.writeTextFile(copy, broken);
    const fresh = await newTestDir("card-warning-fresh");
    const refused = await runScript(`${scripts}/placeholder-card.ts`, args(fresh));
    assertEquals(1, refused.code, "exit code");
    const lines = refused.stderr.split(/\r?\n/).filter((line) => line.trim() !== "");
    assertEquals(1, lines.length, `lines on stderr: ${refused.stderr.trim()}`);
    assert(
      lines[0].includes("warning: unknown font family"),
      `the line names the warning: ${lines[0]}`,
    );
    assert(!(await exists(`${fresh}/images`)), "no images folder is made for a refused card");

    const kept = await newTestDir("card-warning-kept");
    await generateOk(kept, card());
    const pngBefore = await Deno.readFile(`${kept}/images/01-main-window.png`);
    const mdBefore = await imagesMd(kept);
    const again = await runScript(
      `${scripts}/placeholder-card.ts`,
      args(kept, "stale: the toolbar moved"),
    );
    assertEquals(1, again.code, "exit code when a card already exists");
    const after = await Deno.readFile(`${kept}/images/01-main-window.png`);
    assert(
      after.length === pngBefore.length && after.every((byte, i) => byte === pngBefore[i]),
      "the existing picture is left as it was",
    );
    assertEquals(mdBefore, await imagesMd(kept), "IMAGES.md is left as it was");
  },

  "CRLF is kept": async () => {
    const docs = await newTestDir("card-crlf");
    await Deno.mkdir(`${docs}/images`);
    const md = `${docs}/images/IMAGES.md`;
    await Deno.writeTextFile(
      md,
      ["# Images", "", "Capture it: Press F12.", "", HEADER, RULE, ""].join("\r\n"),
    );

    await generateOk(docs, card({ file: "a.png", capture: undefined }));
    await generateOk(docs, card({ file: "b.png", capture: undefined }));
    await generateOk(docs, card({ file: "a.png", why: "stale", capture: undefined }));

    const text = await Deno.readTextFile(md);
    assertEquals(2, rows(text).length, "row count");
    assert(text.includes("\r\n"), "file still has CRLF endings");
    assert(!/(^|[^\r])\n/.test(text), "no bare LF was introduced");
  },
};
