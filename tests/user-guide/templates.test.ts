import { assert, assertEquals, newTestDir, runQuarto, runScript, skillDir } from "./helpers.ts";

const templates = `${skillDir}/templates`;
const cardScript = `${skillDir}/scripts/placeholder-card.ts`;
const checkScript = `${skillDir}/scripts/check-guide.ts`;

const TOKENS: Record<string, string> = {
  "[[APP_NAME]]": "Sample Viewer",
  "[[COMPANY]]": "Sample Co",
  "[[AREA_NAME]]": "Library",
  "[[AREA_ID]]": "library",
  "[[CAPTURE_IT]]": "Press Print Screen.",
};

const TEXT_FILE = /\.(md|qmd|ya?ml)$/;

/** The line each template starts with while its text is still sample prose. */
const MARKER = "<!-- Template:";

/** A UI stack no skill file may name: the skill and its templates fit any desktop app. */
const PRODUCT_NAMES = /wpf/i;

async function filesUnder(root: string, dir = ""): Promise<string[]> {
  const found: string[] = [];
  for await (const entry of Deno.readDir(`${root}/${dir}`)) {
    const relative = dir === "" ? entry.name : `${dir}/${entry.name}`;
    if (entry.isDirectory) found.push(...await filesUnder(root, relative));
    else found.push(relative);
  }
  return found.sort();
}

/** Copies the starter templates into `to`, with every token replaced by its sample value. */
async function copyFilled(to: string): Promise<void> {
  for (const file of await filesUnder(templates)) {
    const target = `${to}/${file}`;
    await Deno.mkdir(target.replace(/\/[^/]*$/, ""), { recursive: true });
    if (!TEXT_FILE.test(file)) {
      await Deno.copyFile(`${templates}/${file}`, target);
      continue;
    }
    let text = await Deno.readTextFile(`${templates}/${file}`);
    for (const [token, value] of Object.entries(TOKENS)) text = text.replaceAll(token, value);
    await Deno.writeTextFile(target, text);
  }
}

/** Every picture the filled chapters point at, with the section its figure sits under. */
async function referencedImages(docs: string): Promise<Map<string, string>> {
  const found = new Map<string, string>();
  for (const file of await filesUnder(`${docs}/_chapters`)) {
    let section = "";
    for (const line of (await Deno.readTextFile(`${docs}/_chapters/${file}`)).split(/\r?\n/)) {
      section = /^#+ .*\{#(sec-[\w-]+)\}\s*$/.exec(line)?.[1] ?? section;
      for (const match of line.matchAll(/\(images\/([^)\s]+)\)/g)) {
        found.set(match[1], section);
      }
    }
  }
  return found;
}

/** The templates that carry a sample-text marker: the spine and every chapter. */
async function markedTemplates(): Promise<string[]> {
  const chapters = (await filesUnder(`${templates}/_chapters`)).map((name) => `_chapters/${name}`);
  return ["user-guide.qmd", ...chapters];
}

let built: Promise<string> | undefined;

/** The templates filled in and given a card per referenced picture, built once for every test. */
function filledGuide(): Promise<string> {
  built ??= (async () => {
    const docs = `${await newTestDir("templates")}/docs`;
    await copyFilled(docs);
    await Deno.mkdir(`${docs}/images`, { recursive: true });

    const images = await referencedImages(docs);
    assertEquals(
      ["01-main-window.png", "02-library-overview.png", "10-settings.png"],
      [...images.keys()].sort(),
      "pictures the templates reference",
    );
    for (const [file, section] of images) {
      assert(section !== "", `${file} is not under a heading with a {#sec-…} id`);
      const result = await runScript(cardScript, [
        "--docs", docs,
        "--file", file,
        "--section", section,
        "--shows", `The picture ${file} needs.`,
        "--how", "Open the screen it belongs to.",
        "--why", "new picture",
      ]);
      assertEquals(0, result.code, `card ${file} (stderr: ${result.stderr.trim()})`);
    }
    return docs;
  })();
  return built;
}

async function check(docs: string, ...flags: string[]) {
  const result = await runScript(checkScript, ["--docs", docs, ...flags]);
  const lines = result.stdout.split(/\r?\n/).filter((line) => line.trim() !== "");
  return {
    ...result,
    errors: lines.filter((line) => line.startsWith("ERROR: ")),
    warnings: lines.filter((line) => line.startsWith("WARN: ")),
  };
}

export const tests: Record<string, () => Promise<void>> = {
  "templates render clean": async () => {
    const docs = await filledGuide();
    const result = await check(docs, "--draft");
    assertEquals(0, result.code, `exit code (stdout: ${result.stdout.trim()})`);
    assertEquals([], result.errors, "ERROR lines");
    for (const line of result.warnings) {
      assert(
        line.includes("placeholder") || line.includes("template marker"),
        `only placeholder and marker warnings are expected: ${line}`,
      );
    }
    assertEquals(
      3,
      result.warnings.filter((line) => line.includes("placeholder")).length,
      "one placeholder warning per card",
    );
    assertEquals(
      (await markedTemplates()).length,
      result.warnings.filter((line) => line.includes("template marker")).length,
      "one marker warning per template",
    );
    const pdf = await Deno.stat(`${docs}/_output/user-guide.pdf`);
    assert(pdf.isFile && pdf.size > 0, "_output/user-guide.pdf is a non-empty file");
  },

  "a version stamp reaches the typeset guide and the List of Tables is built": async () => {
    const docs = await filledGuide();
    const result = await runQuarto([
      "render",
      `${docs}/user-guide.qmd`,
      "-M",
      "subtitle=Version 9.9.9",
    ]);
    assertEquals(0, result.code, `exit code (stderr: ${result.stderr.trim()})`);
    const typ = await Deno.readTextFile(`${docs}/user-guide.typ`);
    assert(typ.includes("subtitle: [Version 9.9.9]"), "the title page carries the stamp");
    assert(
      typ.includes("Sample Viewer User Guide --- Version 9.9.9"),
      "the running header carries the stamp",
    );
    assert(!typ.includes("Unversioned"), "the default subtitle is replaced, not shown as well");
    assert(
      /#outline\(\s*title: \[List of Tables\],\s*target: figure\.where\(kind: "quarto-float-tbl"\),?\s*\)/
        .test(typ),
      "the List of Tables outline is in the typeset guide",
    );
    const pdf = await Deno.stat(`${docs}/_output/user-guide.pdf`);
    assert(pdf.isFile && pdf.size > 0, "_output/user-guide.pdf is a non-empty file");
  },

  "templates fail a release check while cards and markers remain": async () => {
    const docs = await filledGuide();
    const result = await check(docs, "--no-render");
    assertEquals(1, result.code, `exit code (stdout: ${result.stdout.trim()})`);

    const markers = result.errors.filter((line) => line.includes("template marker"));
    const cards = result.errors.filter((line) => line.includes("still a placeholder"));
    assertEquals(3, cards.length, "one error per placeholder card");
    const files = await markedTemplates();
    assertEquals(files.length, markers.length, "one error per template marker");
    for (const file of files) {
      assert(
        markers.some((line) => line.startsWith(`ERROR: ${file}:`)),
        `no marker error names ${file}: ${markers.join(" / ")}`,
      );
    }
    assertEquals(cards.length + markers.length, result.errors.length, "no other errors");
  },

  "every template carries exactly one sample-text marker": async () => {
    for (const file of await markedTemplates()) {
      const text = await Deno.readTextFile(`${templates}/${file}`);
      const lines = text.split(/\r?\n/).filter((line) => line.includes(MARKER));
      assertEquals(1, lines.length, `lines holding ${MARKER} in ${file}`);
      assert(!lines[0].includes("[["), `${file}: the marker line must not hold a token`);
      assert(
        lines[0].trimEnd().endsWith("-->") && lines[0].trimStart().startsWith(MARKER),
        `${file}: the marker is a whole one-line comment: ${lines[0]}`,
      );
    }
  },

  "templates use only the documented tokens": async () => {
    const allowed = new Set(Object.keys(TOKENS));
    const seen = new Map<string, string[]>();
    for (const file of await filesUnder(templates)) {
      if (!TEXT_FILE.test(file)) continue;
      const text = await Deno.readTextFile(`${templates}/${file}`);
      for (const token of text.match(/\[\[[^\[\]\r\n]*\]\]/g) ?? []) {
        assert(allowed.has(token), `${file} holds ${token}, which is not a documented token`);
        seen.set(token, [...(seen.get(token) ?? []), file]);
      }
    }
    assertEquals(["images/IMAGES.md"], seen.get("[[CAPTURE_IT]]"), "files holding [[CAPTURE_IT]]");
    for (const token of Object.keys(TOKENS)) {
      assert(seen.has(token), `no template uses ${token}`);
    }
  },

  "skill files name no product": async () => {
    const strict = new TextDecoder("utf-8", { fatal: true });
    let scanned = 0;
    for (const file of await filesUnder(skillDir)) {
      let text: string;
      try {
        text = strict.decode(await Deno.readFile(`${skillDir}/${file}`));
      } catch (error) {
        if (error instanceof TypeError) continue;
        throw error;
      }
      scanned++;
      const hit = PRODUCT_NAMES.exec(text);
      assert(hit === null, `skills/user-guide/${file} names a product: ${hit?.[0]}`);
    }
    assert(scanned > 0, "no file under skills/user-guide/ was scanned");
  },
};
