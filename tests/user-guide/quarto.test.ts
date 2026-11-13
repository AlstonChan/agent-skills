/**
 * @file Pins how `quartoCommand` finds Quarto: beside `QUARTO_BIN_PATH` with any trailing
 * separators removed, else `quarto` on the PATH.
 */

import { assertEquals } from "./helpers.ts";
import { quartoCommand } from "../../skills/user-guide/scripts/quarto.ts";

const exe = Deno.build.os === "windows" ? "quarto.exe" : "quarto";

/**
 * Runs `run` with `QUARTO_BIN_PATH` set to `value`, or unset when `value` is undefined, and puts
 * the previous value back afterwards even if `run` throws.
 */
function withBinPath(value: string | undefined, run: () => void): void {
  const before = Deno.env.get("QUARTO_BIN_PATH");
  try {
    if (value === undefined) Deno.env.delete("QUARTO_BIN_PATH");
    else Deno.env.set("QUARTO_BIN_PATH", value);
    run();
  } finally {
    if (before === undefined) Deno.env.delete("QUARTO_BIN_PATH");
    else Deno.env.set("QUARTO_BIN_PATH", before);
  }
}

/** Test cases run by run-tests.ts, keyed by name. */
export const tests: Record<string, () => Promise<void>> = {
  "a trailing backslash on the bin path is stripped": () => {
    withBinPath("C:\\Program Files\\Quarto\\bin\\", () => {
      assertEquals(`C:\\Program Files\\Quarto\\bin/${exe}`, quartoCommand(), "command");
    });
    withBinPath("C:\\Program Files\\Quarto\\bin\\\\", () => {
      assertEquals(`C:\\Program Files\\Quarto\\bin/${exe}`, quartoCommand(), "command");
    });
    return Promise.resolve();
  },

  "a trailing slash on the bin path is stripped": () => {
    withBinPath("/opt/quarto/bin/", () => {
      assertEquals(`/opt/quarto/bin/${exe}`, quartoCommand(), "command");
    });
    withBinPath("/opt/quarto/bin//", () => {
      assertEquals(`/opt/quarto/bin/${exe}`, quartoCommand(), "command");
    });
    return Promise.resolve();
  },

  "a bin path without a trailing separator is used as given": () => {
    withBinPath("/opt/quarto/bin", () => {
      assertEquals(`/opt/quarto/bin/${exe}`, quartoCommand(), "command");
    });
    return Promise.resolve();
  },

  "without a bin path the command is quarto on the PATH": () => {
    withBinPath(undefined, () => {
      assertEquals("quarto", quartoCommand(), "command");
    });
    return Promise.resolve();
  },
};
