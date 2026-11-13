/**
 * @file Shared by the user-guide tests: assertions, per-test folders, and runners for Quarto and
 * the skill's scripts. Runs under `quarto run`, so only Deno built-ins are used.
 */

import { quartoCommand } from "../../skills/user-guide/scripts/quarto.ts";

const here = import.meta.dirname;
if (here === undefined) {
  throw new Error("helpers.ts must be loaded from a file: URL");
}

/** The repository root, with the platform's own separators. */
export const repoRoot: string = await Deno.realPath(`${here}/../..`);

/** The folder of the skill under test. */
export const skillDir: string = `${repoRoot}/skills/user-guide`;

/**
 * Fails the test with `message` unless `cond` holds.
 *
 * @throws Error carrying `message` when `cond` is false.
 */
export function assert(cond: boolean, message: string): void {
  if (!cond) throw new Error(message);
}

/**
 * Fails the test unless `expected` and `actual` have the same JSON form. Values are compared by
 * their JSON text, so object key order matters and `undefined` properties are ignored.
 *
 * @param message - Names what is compared; the failure message adds both values to it.
 * @throws Error when the two values differ.
 */
export function assertEquals(expected: unknown, actual: unknown, message: string): void {
  if (JSON.stringify(expected) !== JSON.stringify(actual)) {
    throw new Error(
      `${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

/** Returns the system temporary folder, read off where `Deno.makeTempDir` puts a probe folder. */
async function systemTempDir(): Promise<string> {
  const probe = await Deno.makeTempDir();
  await Deno.remove(probe);
  return probe.replace(/[\\/][^\\/]*$/, "");
}

let runRoot: Promise<string> | undefined;

/**
 * Returns the folder every test folder of this run lives under: one subfolder per run of the
 * tests, inside a folder whose name holds a space on purpose, so two runs never touch each other's
 * folders. The path is fixed on the first call; newTestDir creates the folder.
 */
export function testRoot(): Promise<string> {
  runRoot ??= systemTempDir().then(
    (dir) => `${dir}/user guide tests/run-${crypto.randomUUID().slice(0, 8)}`,
  );
  return runRoot;
}

/**
 * Creates a fresh, empty folder for one test, under a path that contains a space.
 *
 * @param name - Becomes the start of the folder name, with each run of characters other than
 * letters, digits, `_` and `-` replaced by `-`.
 * @returns The folder's path.
 */
export async function newTestDir(name: string): Promise<string> {
  const root = await testRoot();
  await Deno.mkdir(root, { recursive: true });
  return await Deno.makeTempDir({ dir: root, prefix: `${name.replace(/[^\w-]+/g, "-")}-` });
}

/**
 * Runs `quarto <...args>` and collects its exit code and output. A non-zero exit code does not
 * throw; the caller asserts on it.
 */
export async function runQuarto(
  args: string[],
): Promise<{ code: number; stdout: string; stderr: string }> {
  const out = await new Deno.Command(quartoCommand(), {
    args,
    stdout: "piped",
    stderr: "piped",
  }).output();
  const decoder = new TextDecoder();
  return {
    code: out.code,
    stdout: decoder.decode(out.stdout),
    stderr: decoder.decode(out.stderr),
  };
}

/**
 * Runs `quarto run <script> ...args` and collects its exit code and output.
 *
 * @param script - Path of the TypeScript file to run.
 */
export function runScript(
  script: string,
  args: string[],
): Promise<{ code: number; stdout: string; stderr: string }> {
  return runQuarto(["run", script, ...args]);
}

/**
 * Reads the dimensions, in pixels, from a PNG's IHDR chunk (bytes 16-23, big-endian).
 *
 * @throws Error when the file is too short or does not start with the PNG signature.
 */
export async function pngSize(path: string): Promise<{ width: number; height: number }> {
  const bytes = await Deno.readFile(path);
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  assert(
    bytes.length >= 24 && signature.every((b, i) => bytes[i] === b),
    `${path} is not a PNG`,
  );
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}
