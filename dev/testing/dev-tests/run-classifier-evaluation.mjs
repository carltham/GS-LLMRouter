// Measures how reliably local Ollama models classify a request into kind + difficulty.
// Configure defaults in classifier-evaluation-settings.json. CLI: [--models a,b] [--repeats n] [--host url]
// Reads classifier-evaluation-prompts.json next to this file; writes a JSON report to ./classifier-evaluation-results/ (git-ignored). No dependencies.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, arg, i, all) => (arg.startsWith("--") ? [...pairs, [arg.slice(2), all[i + 1]]] : pairs), []));
const config = JSON.parse(await readFile(join(here, "classifier-evaluation-settings.json"), "utf8"));
const models = args.models ? args.models.split(",") : config.models;
const repeats = Number(args.repeats ?? config.repeats);
const host = args.host ?? config.host;
const timeoutMs = config.timeoutMs;
const KINDS = config.kinds;
const LEVELS = config.difficultyLevels;
const system = `${config.systemPrompt} Allowed kinds: ${JSON.stringify(KINDS)}. Allowed difficulty levels: ${JSON.stringify(LEVELS)}.`;

async function classify(model, prompt) {
  const started = performance.now();
  try {
    const response = await fetch(`${host}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model, stream: false, think: config.generation.think, format: config.generation.format,
        options: { temperature: config.generation.temperature, num_predict: config.generation.numPredict },

        messages: [{ role: "system", content: system }, { role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const ms = performance.now() - started;
    if (!response.ok) return { ms, error: `http ${response.status}` };
    const content = (await response.json()).message?.content ?? "";
    try {
      const parsed = JSON.parse(content);
      const valid = KINDS.includes(parsed.kind) && LEVELS.includes(parsed.difficulty);
      return { ms, valid, kind: parsed.kind, difficulty: parsed.difficulty, error: valid ? undefined : "bad-values" };
    } catch {
      return { ms, valid: false, error: "bad-json" };
    }
  } catch (error) {
    return { ms: performance.now() - started, error: error instanceof Error ? error.message : String(error) };
  }
}

const percentile = (values, p) => values.length ? [...values].sort((a, b) => a - b)[Math.min(values.length - 1, Math.floor(values.length * p))] : null;
const pct = (n, d) => (d ? Math.round((100 * n) / d) : 0);

const cases = JSON.parse(await readFile(join(here, "classifier-evaluation-prompts.json"), "utf8"));
const report = [];
for (const model of models) {
  await classify(model, "warm-up"); // load the model so latency excludes cold start
  const runs = [];
  for (const testCase of cases) {
    const results = [];
    for (let i = 0; i < repeats; i += 1) results.push(await classify(model, testCase.prompt));
    runs.push({ id: testCase.id, expected: testCase, results });
  }
  const all = runs.flatMap((run) => run.results.map((result) => ({ ...result, expected: run.expected })));
  const valid = all.filter((r) => r.valid);
  const consistent = runs.filter((run) => run.results.every((r) => r.valid && r.kind === run.results[0].kind && r.difficulty === run.results[0].difficulty));
  const stats = {
    model, calls: all.length,
    errors: all.filter((r) => r.error && !["bad-json", "bad-values"].includes(r.error)).length,
    validJsonPct: pct(valid.length, all.length),
    kindAccuracyPct: pct(valid.filter((r) => r.kind === r.expected.kind).length, all.length),
    difficultyExactPct: pct(valid.filter((r) => r.difficulty === r.expected.difficulty).length, all.length),
    difficultyWithinOnePct: pct(valid.filter((r) => Math.abs(LEVELS.indexOf(r.difficulty) - LEVELS.indexOf(r.expected.difficulty)) <= 1).length, all.length),
    consistentPct: pct(consistent.length, runs.length),
    medianMs: Math.round(percentile(all.map((r) => r.ms), 0.5) ?? 0),
    p95Ms: Math.round(percentile(all.map((r) => r.ms), 0.95) ?? 0),
  };
  report.push({ stats, runs });
  console.log(JSON.stringify(stats));
}

await mkdir(join(here, "classifier-evaluation-results"), { recursive: true });
const file = join(here, "classifier-evaluation-results", `classifications-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
await writeFile(file, JSON.stringify({ host, repeats, report }, null, 2));
console.table(report.map((entry) => entry.stats));
console.log(`Report: ${file}`);
