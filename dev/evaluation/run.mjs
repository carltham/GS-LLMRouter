#!/usr/bin/env node
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const usage = "Usage: node dev/evaluation/run.mjs --mode self-test|model-quality|routing-quality|all";
const args = process.argv.slice(2);
const modeIndex = args.indexOf("--mode");
const mode = modeIndex >= 0 ? args[modeIndex + 1] : "";
if (!mode || !["self-test", "model-quality", "routing-quality", "all"].includes(mode)) {
  console.error(usage);
  process.exit(2);
}

const readJson = async (path) => JSON.parse(await readFile(resolve(root, path), "utf8"));
const [modelCases, routingCases, modelRules, routingRules] = await Promise.all([
  readJson("cases/model-quality.json"),
  readJson("cases/routing-quality.json"),
  readJson("rules/model-quality.json"),
  readJson("rules/routing-quality.json"),
]);

function matchesCheck(text, check) {
  if (check.type === "exact") return text.trim() === check.value;
  if (check.type === "contains") return text.includes(check.value);
  if (check.type === "not-contains") return !text.includes(check.value);
  if (check.type === "json-equals") {
    try {
      return JSON.stringify(sortKeys(JSON.parse(text))) === JSON.stringify(sortKeys(check.value));
    } catch {
      return false;
    }
  }
  if (check.type === "regex") return new RegExp(check.value, check.flags ?? "").test(text);
  throw new Error(`Unsupported evaluation check: ${check.type}`);
}

function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortKeys(value[key])]));
  }
  return value;
}

function checkModelCase(text, item) {
  return item.checks.every((check) => matchesCheck(text, check));
}

function validateData() {
  assert(modelCases.length > 0, "Model-quality dataset must not be empty");
  assert(routingCases.length > 0, "Routing-quality dataset must not be empty");
  const modelIds = new Set();
  const presentCategories = new Set(modelCases.map((item) => item.category));
  for (const [category, rule] of Object.entries(modelRules.categories)) {
    if (rule.required) assert(presentCategories.has(category), `Required model-quality category has no cases: ${category}`);
  }
  for (const item of modelCases) {
    assert(item.id && !modelIds.has(item.id) && item.category && Array.isArray(item.messages) && item.messages.length, `Invalid or duplicate model-quality case: ${item.id}`);
    modelIds.add(item.id);
    assert(Number.isFinite(item.weight) && item.weight > 0, `Invalid weight: ${item.id}`);
    assert(item.checks?.length, `No scoring checks: ${item.id}`);
    assert(item.max_completion_tokens <= modelRules.operationalLimits.maxCompletionTokensPerCase, `Token cap exceeds rule: ${item.id}`);
    item.checks.forEach((check) => matchesCheck(check.type === "exact" ? check.value : "", check));
  }
  for (const item of routingCases) {
    assert(item.id && ["simple", "complex"].includes(item.expectedComplexity), "Invalid routing scenario");
    assert(Array.isArray(item.messages) && item.messages.length, `Missing messages: ${item.id}`);
  }
}

function selfTest() {
  validateData();
  assert.equal(matchesCheck("  EVAL_PING_7F3A\n", { type: "exact", value: "EVAL_PING_7F3A" }), true);
  assert.equal(matchesCheck('{"count":3,"status":"ok"}', { type: "json-equals", value: { status: "ok", count: 3 } }), true);
  assert.equal(matchesCheck("not json", { type: "json-equals", value: {} }), false);
  assert.equal(matchesCheck("answer is 42", { type: "contains", value: "42" }), true);
  assert.equal(matchesCheck("safe", { type: "not-contains", value: "unsafe" }), true);
  assert.equal(matchesCheck("42", { type: "regex", value: "^\\d+$" }), true);
  const catalogFixture = new Map([["safe-chat", {
    id: "safe-chat", name: "Safe Chat", enabled: true, inputPrice: 1, outputPrice: 2,
    outputModalities: ["text"], qualityTier: 3, toolsSupported: true,
  }]]);
  assert.deepEqual(routePolicyFailures(routingCases[1], "safe-chat", catalogFixture, []), []);
  assert(routePolicyFailures(routingCases[1], "missing", catalogFixture, []).includes("unknown-or-disabled-model"));
  assert(routePolicyFailures(routingCases[2], "safe-chat", catalogFixture, ["safe"] ).includes("blacklisted-model-selected"));
  console.log(`Evaluation data and scorer self-test passed (${modelCases.length} model cases, ${routingCases.length} routing scenarios).`);
}

const now = () => new Date().toISOString();
function reportPath() {
  return resolve(root, "results", `evaluation-${now().replaceAll(":", "-")}.json`);
}

function credentials() {
  const apiKey = process.env.EVAL_API_KEY || process.env.ABACUSAI_GS_EBS_BRAIN_KEY;
  if (!apiKey) throw new Error("Set EVAL_API_KEY or ABACUSAI_GS_EBS_BRAIN_KEY in the environment; do not place credentials in files or arguments.");
  return apiKey;
}

function completionUrl(base) {
  const url = new URL(base);
  url.pathname = `${url.pathname.replace(/\/+$/, "")}/chat/completions`;
  return url;
}

async function postCompletion(url, apiKey, body, timeoutMs) {
  const response = await fetch(url, {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`Completion request failed with HTTP ${response.status}`);
  return response;
}

async function evalModelQuality() {
  const targets = (process.env.EVAL_TARGET_MODELS ?? "").split(",").map((model) => model.trim()).filter(Boolean);
  if (!targets.length) throw new Error("Set EVAL_TARGET_MODELS to one or more exact catalog model IDs (comma-separated).");
  const apiKey = credentials();
  const base = process.env.EVAL_BASE_URL || process.env.ROUTELLM_BASE_URL || "https://routellm.abacus.ai/v1";
  const url = completionUrl(base);
  const timeoutMs = Number(process.env.EVAL_TIMEOUT_MS || 60_000);
  const results = [];

  for (const model of targets) {
    for (const item of modelCases) {
      const started = performance.now();
      let passed = false;
      let status = "ok";
      let usage = null;
      try {
        const response = await postCompletion(url, apiKey, {
          model,
          messages: item.messages,
          max_completion_tokens: item.max_completion_tokens,
          temperature: 0,
        }, timeoutMs);
        const body = await response.json();
        const choice = body.choices?.[0];
        const text = typeof choice?.message?.content === "string" ? choice.message.content : "";
        usage = body.usage ?? null;
        const modelMatches = !modelRules.requireReturnedModelMatch || body.model === model;
        passed = modelMatches && checkModelCase(text, item);
        if (!modelMatches) status = "response-model-mismatch";
        else if (!passed) status = "scoring-check-failed";
        const outputTokens = usage?.completion_tokens ?? usage?.output_tokens;
        if (typeof outputTokens === "number" && outputTokens > item.max_completion_tokens) {
          passed = false;
          status = "completion-token-cap-exceeded";
        }
      } catch (error) {
        status = error instanceof Error ? error.message : "request-failed";
      }
      results.push({ model, caseId: item.id, category: item.category, weight: item.weight, required: item.required, passed, status, latencyMs: Math.round(performance.now() - started), usage });
      console.log(`${passed ? "PASS" : "FAIL"} model=${model} case=${item.id} latencyMs=${results.at(-1).latencyMs}${status === "ok" ? "" : ` status=${status}`}`);
    }
  }

  const summaries = targets.map((model) => {
    const rows = results.filter((row) => row.model === model);
    const totalWeight = rows.reduce((sum, row) => sum + row.weight, 0);
    const score = totalWeight ? rows.reduce((sum, row) => sum + (row.passed ? row.weight : 0), 0) / totalWeight : 0;
    const requiredPassed = rows.filter((row) => row.required).every((row) => row.passed);
    const categories = Object.entries(modelRules.categories).map(([category, rule]) => {
      const categoryRows = rows.filter((row) => row.category === category);
      return { category, passed: categoryRows.length > 0 && categoryRows.every((row) => row.passed), required: rule.required === true };
    });
    const categoriesPassed = categories.every((category) => !category.required || category.passed);
    const latencyPassed = rows.every((row) => row.latencyMs <= modelRules.operationalLimits.maxCaseLatencyMs);
    const passed = score >= modelRules.minimumWeightedScore && (!modelRules.allRequiredCasesMustPass || requiredPassed) && categoriesPassed && latencyPassed;
    return { model, score, requiredPassed, categories, categoriesPassed, latencyPassed, passed };
  });
  summaries.forEach((summary) => console.log(`${summary.passed ? "PASS" : "FAIL"} model-summary model=${summary.model} weightedScore=${(summary.score * 100).toFixed(1)}% requiredCases=${summary.requiredPassed ? "pass" : "fail"} requiredCategories=${summary.categoriesPassed ? "pass" : "fail"}`));
  return { kind: "model-quality", summaries, results };
}

function blacklisted(model, patterns) {
  const haystack = `${model.id}\n${model.name}`.toLocaleLowerCase("en-US");
  return patterns.some((pattern) => haystack.includes(pattern.toLocaleLowerCase("en-US")));
}

function routePolicyFailures(item, selectedId, models, patterns) {
  const failures = [];
  const chosen = selectedId ? models.get(selectedId) : undefined;
  if (routingRules.requireKnownEnabledModel && (!chosen || chosen.enabled !== true)) failures.push("unknown-or-disabled-model");
  if (chosen && routingRules.requireKnownPrices && (chosen.inputPrice === null || chosen.inputPrice === undefined || chosen.outputPrice === null || chosen.outputPrice === undefined)) failures.push("unknown-price");
  if (chosen && routingRules.requireTextOutput && !chosen.outputModalities?.includes("text")) failures.push("no-confirmed-text-output");
  if (chosen && routingRules.requireNotBlacklisted && blacklisted(chosen, patterns)) failures.push("blacklisted-model-selected");
  if (chosen && item.expectedComplexity === "complex" && (chosen.qualityTier ?? 1) < routingRules.requireQualityTierForComplex) failures.push("complex-tier-below-threshold");
  if (chosen && item.requiresTools && routingRules.requireToolSupportWhenToolsRequested && chosen.toolsSupported !== true) failures.push("tools-not-supported");
  return failures;
}

async function evalRoutingQuality() {
  const routerUrl = new URL(process.env.EVAL_ROUTER_URL || "http://127.0.0.1:8000");
  const adminToken = process.env.EVAL_ROUTER_ADMIN_TOKEN || process.env.ROUTER_ADMIN_TOKEN;
  if (!adminToken) throw new Error("Set EVAL_ROUTER_ADMIN_TOKEN or ROUTER_ADMIN_TOKEN to query the running router admin API.");
  const admin = await fetch(new URL("/admin/models", routerUrl), { headers: { authorization: `Bearer ${adminToken}`, accept: "application/json" } });
  if (!admin.ok) throw new Error(`Router admin catalog request failed with HTTP ${admin.status}`);
  const catalog = await admin.json();
  const models = new Map(catalog.data.map((model) => [model.id, model]));
  const patterns = catalog.blacklist ?? [];
  const results = [];

  for (const item of routingCases) {
    const started = performance.now();
    let selectedId = null;
    let failures = [];
    try {
      const response = await fetch(new URL("/v1/chat/completions", routerUrl), {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ model: "route-llm", messages: item.messages, tools: item.tools, tool_choice: item.tool_choice, max_completion_tokens: item.max_completion_tokens }),
        signal: AbortSignal.timeout(Number(process.env.EVAL_TIMEOUT_MS || 60_000)),
      });
      selectedId = response.headers.get("x-router-selected-model");
      const decisionId = response.headers.get("x-router-decision-id");
      if (routingRules.requireDecisionHeader && !decisionId) failures.push("missing-decision-id");
      if (!response.ok) {
        failures.push(`router-http-${response.status}`);
      } else {
        // Drain the response to complete and measure the full request.
        await response.arrayBuffer();
      }
      failures.push(...routePolicyFailures(item, selectedId, models, patterns));
    } catch (error) {
      failures.push(error instanceof Error ? error.message : "request-failed");
    }
    const passed = failures.length === 0;
    const result = { caseId: item.id, expectedComplexity: item.expectedComplexity, selectedId, passed, failures, latencyMs: Math.round(performance.now() - started) };
    results.push(result);
    console.log(`${passed ? "PASS" : "FAIL"} routing-case=${item.id} complexity=${item.expectedComplexity} selected=${selectedId ?? "none"} latencyMs=${result.latencyMs}${failures.length ? ` failures=${failures.join(",")}` : ""}`);
  }

  const expected = new Set(routingRules.requiredScenarios);
  const observed = new Set(results.map(({ caseId }) => caseId));
  for (const id of expected) if (!observed.has(id)) results.push({ caseId: id, expectedComplexity: "unknown", selectedId: null, passed: false, failures: ["required-scenario-missing"], latencyMs: 0 });
  const passed = results.length > 0 && results.every((row) => row.passed);
  console.log(`${passed ? "PASS" : "FAIL"} routing-summary passed=${results.filter((row) => row.passed).length}/${results.length}`);
  return { kind: "routing-quality", passed, results };
}

async function saveReport(report) {
  const path = reportPath();
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify({ createdAt: now(), ...report }, null, 2)}\n`, { flag: "wx" });
  console.log(`Report: ${path}`);
}

try {
  if (mode === "self-test") {
    selfTest();
  } else {
    validateData();
    const report = { mode, suites: [] };
    if (mode === "model-quality" || mode === "all") report.suites.push(await evalModelQuality());
    if (mode === "routing-quality" || mode === "all") report.suites.push(await evalRoutingQuality());
    await saveReport(report);
    if (report.suites.some((suite) => suite.kind === "routing-quality" && !suite.passed)
      || report.suites.some((suite) => suite.kind === "model-quality" && suite.summaries.some((summary) => !summary.passed))) {
      process.exitCode = 1;
    }
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : "Evaluation failed");
  process.exitCode = 1;
}
