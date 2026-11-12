import { assert, skillDir } from "./helpers.ts";

const skillFile = `${skillDir}/SKILL.md`;

/** Markdown link targets: `[text](target)`, without a `#fragment` or a `"title"`. */
const LINK = /\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

async function exists(path: string): Promise<boolean> {
  try {
    await Deno.stat(path);
    return true;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return false;
    throw error;
  }
}

/** The YAML front matter's lines, between the opening and closing `---`. */
function frontMatter(text: string): string[] {
  const lines = text.split(/\r?\n/);
  assert(lines[0] === "---", "SKILL.md does not open with a --- front matter line");
  const end = lines.indexOf("---", 1);
  assert(end > 0, "SKILL.md's front matter has no closing --- line");
  return lines.slice(1, end);
}

export const tests: Record<string, () => Promise<void>> = {
  "every link in SKILL.md resolves": async () => {
    const text = await Deno.readTextFile(skillFile);

    const meta = frontMatter(text);
    assert(meta.includes("name: user-guide"), "front matter has no `name: user-guide` line");
    const description = meta.find((line) => line.startsWith("description:"));
    assert(
      description !== undefined && description.slice("description:".length).replace(/['"\s]/g, "") !== "",
      "front matter has no non-empty description",
    );

    let relative = 0;
    for (const match of text.matchAll(LINK)) {
      const target = match[1].replace(/#.*$/, "");
      if (target === "" || /^[a-z][a-z0-9+.-]*:/i.test(target)) continue;
      relative++;
      assert(
        await exists(`${skillDir}/${target}`),
        `SKILL.md links ${match[1]}, which is not under skills/user-guide/`,
      );
    }
    assert(relative > 0, "SKILL.md links no file of the skill");
  },

  "SKILL.md links every reference file": async () => {
    const text = await Deno.readTextFile(skillFile);
    const linked = new Set([...text.matchAll(LINK)].map((match) => match[1].replace(/#.*$/, "")));
    for await (const entry of Deno.readDir(`${skillDir}/references`)) {
      if (!entry.isFile) continue;
      assert(
        linked.has(`references/${entry.name}`),
        `SKILL.md does not link references/${entry.name}`,
      );
    }
  },
};
