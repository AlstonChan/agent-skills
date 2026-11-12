import { assert, assertEquals, newTestDir, runScript, skillDir } from "./helpers.ts";

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
      assert(line.includes("placeholder"), `only placeholder warnings are expected: ${line}`);
    }
    assertEquals(3, result.warnings.length, "one placeholder warning per card");
    const pdf = await Deno.stat(`${docs}/_output/user-guide.pdf`);
    assert(pdf.isFile && pdf.size > 0, "_output/user-guide.pdf is a non-empty file");
  },

  "templates fail a release check while cards remain": async () => {
    const docs = await filledGuide();
    const result = await check(docs, "--no-render");
    assertEquals(1, result.code, `exit code (stdout: ${result.stdout.trim()})`);
    assertEquals(3, result.errors.length, "one error per placeholder card");
    for (const line of result.errors) {
      assert(line.includes("still a placeholder"), `only placeholder errors are expected: ${line}`);
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
    for (const file of await filesUnder(skillDir)) {
      if (!/\.(md|qmd|ya?ml|ts|typ)$/.test(file)) continue;
      const text = await Deno.readTextFile(`${skillDir}/${file}`);
      const hit = PRODUCT_NAMES.exec(text);
      assert(hit === null, `skills/user-guide/${file} names a product: ${hit?.[0]}`);
    }
  },
};
