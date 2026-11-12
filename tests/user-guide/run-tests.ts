// Runs every *.test.ts beside this file. Each exports `tests: Record<string, () => Promise<void>>`.
//
//   quarto run tests/user-guide/run-tests.ts [name-fragment ...]
//
// With fragments, only test files whose name contains one of them run.

import { testRoot } from "./helpers.ts";

const here = import.meta.dirname;
if (here === undefined) {
  throw new Error("run-tests.ts must be loaded from a file: URL");
}

const fragments = Deno.args;
const files: string[] = [];
for await (const entry of Deno.readDir(here)) {
  if (!entry.isFile || !entry.name.endsWith(".test.ts")) continue;
  if (fragments.length > 0 && !fragments.some((f) => entry.name.includes(f))) continue;
  files.push(entry.name);
}
files.sort();

let passed = 0;
let failed = 0;
for (const file of files) {
  const module = await import(new URL(file, import.meta.url).href);
  const tests = module.tests as Record<string, () => Promise<void>>;
  for (const [name, run] of Object.entries(tests)) {
    try {
      await run();
      console.log(`PASS ${name}`);
      passed++;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(`FAIL ${name}: ${message}`);
      failed++;
    }
  }
}

if (passed + failed === 0) {
  console.log("FAIL no tests found");
  Deno.exit(1);
}
console.log(`${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log(`test folders kept in ${await testRoot()}`);
  Deno.exit(1);
}
await Deno.remove(await testRoot(), { recursive: true });
