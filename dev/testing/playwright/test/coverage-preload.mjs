// Preloaded into the router process (node --import) when COVERAGE_DIR is set.
// Registers the instrumenting loader and dumps Istanbul counters on SIGTERM/SIGINT/exit.
import { register } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const coverageDir = process.env.COVERAGE_DIR;
const srcPrefix = resolve(process.cwd(), "src") + "/";
register("./coverage-loader.mjs", { parentURL: import.meta.url, data: { srcPrefix, appRoot: process.cwd() } });

let written = false;
function flush() {
  if (written || !globalThis.__coverage__) return;
  written = true;
  mkdirSync(coverageDir, { recursive: true });
  writeFileSync(join(coverageDir, `coverage-${process.pid}.json`), JSON.stringify(globalThis.__coverage__));
}
process.on("exit", flush);
for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => {
    flush();
    process.exit(0);
  });
}
