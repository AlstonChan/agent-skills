/**
 * @file Finds the Quarto executable for the scripts in this folder.
 */

/**
 * Returns the command that starts Quarto: the one beside `QUARTO_BIN_PATH` (which `quarto run`
 * sets), else `quarto` on the PATH.
 */
export function quartoCommand(): string {
  const bin = Deno.env.get("QUARTO_BIN_PATH");
  if (!bin) return "quarto";
  return `${bin.replace(/[\\/]+$/, "")}/${Deno.build.os === "windows" ? "quarto.exe" : "quarto"}`;
}
