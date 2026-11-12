// Node ESM loader hook: transpiles the router's own TypeScript (GS-LLMRouter/src/**) with esbuild
// and Istanbul-instruments it, with a source map so reports map back to the .ts files.
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { createInstrumenter } = require("istanbul-lib-instrument");
const instrumenter = createInstrumenter({ esModules: true, produceSourceMap: false, compact: false });

let srcPrefix = "";
let esbuild;
export function initialize(data) {
  srcPrefix = data.srcPrefix;
  esbuild = createRequire(data.appRoot + "/")("esbuild");
}

export async function load(url, context, nextLoad) {
  const result = await nextLoad(url, context);
  if (!url.startsWith("file://") || result.format !== "module" || result.source == null) return result;
  const file = fileURLToPath(url);
  if (!file.startsWith(srcPrefix) || file.includes("node_modules")) return result;

  // tsx transpiles later in the chain, so transpile here with the same esbuild to get JS + a source map.
  const { code, map } = esbuild.transformSync(result.source.toString(), {
    loader: "ts", format: "esm", target: "node20", sourcemap: true, sourcefile: file,
  });
  const instrumented = instrumenter.instrumentSync(code, file, JSON.parse(map));
  return { ...result, source: instrumented };
}
