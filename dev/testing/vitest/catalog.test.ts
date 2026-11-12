import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ModelCatalog } from "../../../GS-LLMRouter/src/catalog/model-catalog.js";
import { parseCatalog } from "../../../GS-LLMRouter/src/catalog/parse-catalog.js";
import type { CatalogModel } from "../../../GS-LLMRouter/src/catalog/types.js";

let directory: string;
let catalog: ModelCatalog;

function model(overrides: Partial<CatalogModel> = {}): CatalogModel {
  const id = overrides.id ?? "model-alpha";
  return {
    id,
    name: overrides.name ?? id,
    modelType: "text",
    inputPrice: 1,
    outputPrice: 2,
    contextWindow: 16_000,
    apiFormats: ["openai-chat-completions"],
    toolsSupported: true,
    raw: { id },
    ...overrides,
  };
}

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "gsllm-catalog-"));
  catalog = new ModelCatalog(join(directory, "router.sqlite"), [" SmAuG "]);
});

afterEach(() => {
  catalog.close();
  rmSync(directory, { recursive: true, force: true });
});

describe("parseCatalog", () => {
  it("accepts an array payload and maps model ids, names, and types", () => {
    expect(parseCatalog([{ id: " a ", name: "Alpha", model_type: "text" }])).toMatchObject([
      { id: "a", name: "Alpha", modelType: "text" },
    ]);
  });

  it("accepts data envelopes and supported id aliases", () => {
    expect(parseCatalog({ data: [{ model: "one" }, { model_id: "two" }] }).map(({ id }) => id)).toEqual(["one", "two"]);
  });

  it("skips non-object entries and entries without a usable id", () => {
    expect(parseCatalog({ data: [null, 1, [], {}, { id: "  " }, { id: "ok" }] })).toHaveLength(1);
  });

  it("throws when the payload has no data array", () => {
    expect(() => parseCatalog({ models: [] })).toThrow(/data array/);
  });

  it("parses price aliases and nested pricing values", () => {
    const parsed = parseCatalog({ data: [
      { id: "direct", prompt_price_per_1m_tokens: "0.5", completion_price_per_1m_tokens: 1.25 },
      { id: "nested", pricing: { input_cost_per_1m_tokens: 2, output_per_1m_tokens: "3" } },
    ] });
    expect(parsed.map(({ inputPrice, outputPrice }) => [inputPrice, outputPrice])).toEqual([[0.5, 1.25], [2, 3]]);
  });

  it("rejects negative, non-finite, and malformed prices as unavailable", () => {
    const parsed = parseCatalog({ data: [{ id: "bad", input_price_per_million_tokens: -1, output_price_per_million_tokens: "NaN" }] });
    expect(parsed[0]).toMatchObject({ inputPrice: null, outputPrice: null });
  });

  it("parses context, API formats, tool support, and defaults", () => {
    expect(parseCatalog({ data: [
      { id: "full", context_length: "32000", api_formats: ["openai-chat", 4], function_calling: true, type: "chat" },
      { id: "defaults", api_formats: "chat" },
    ] })).toEqual([
      expect.objectContaining({ id: "full", modelType: "chat", contextWindow: 32000, apiFormats: ["openai-chat"], toolsSupported: true }),
      expect.objectContaining({ id: "defaults", modelType: "text", name: "defaults", contextWindow: null, apiFormats: [], toolsSupported: null }),
    ]);
  });

  it("keeps the original record for diagnostics", () => {
    const raw = { id: "alpha", metadata: { owner: "provider" } };
    expect(parseCatalog([raw])[0].raw).toBe(raw);
  });
});

describe("ModelCatalog storage and blacklist", () => {
  it("creates its database directory and starts with normalized blacklist patterns", () => {
    expect(catalog.blacklist()).toEqual(["smaug"]);
  });

  it("ignores blank seed blacklist patterns", () => {
    const seeded = new ModelCatalog(join(directory, "nested", "seeded.sqlite"), ["", "  ", "Vendor"]);
    try {
      expect(seeded.blacklist()).toEqual(["vendor"]);
    } finally {
      seeded.close();
    }
  });

  it("matches blacklist patterns case-insensitively against both id and name", () => {
    expect(catalog.isBlacklisted({ id: "vendor-SMAUG-v2", name: "model" })).toBe(true);
    expect(catalog.isBlacklisted({ id: "safe", name: "Smaug family" })).toBe(true);
    expect(catalog.isBlacklisted({ id: "safe", name: "safe model" })).toBe(false);
  });

  it("adds and removes normalized patterns; duplicate adds are harmless", () => {
    catalog.setBlacklistedPattern("  Vendor  ", true);
    catalog.setBlacklistedPattern("vendor", true);
    expect(catalog.blacklist()).toEqual(["smaug", "vendor"]);
    catalog.setBlacklistedPattern("VENDOR", false);
    expect(catalog.blacklist()).toEqual(["smaug"]);
  });

  it.each(["", "   ", "x".repeat(101)])("rejects an invalid blacklist pattern (%s)", (pattern) => {
    expect(() => catalog.setBlacklistedPattern(pattern, true)).toThrow(/1 to 100 characters/);
  });

  it("syncs models, updates existing records, and marks removed records unavailable", () => {
    catalog.sync([model(), model({ id: "model-beta" })]);
    catalog.profile("model-alpha", 4, false);
    catalog.sync([model({ id: "model-alpha", name: "Updated" })]);
    expect(catalog.listModels()).toEqual([
      expect.objectContaining({ id: "model-alpha", name: "Updated", qualityTier: 4, enabled: false }),
    ]);
  });

  it("rolls back a failed catalog sync and keeps the previous rows available", () => {
    catalog.sync([model()]);
    expect(() => catalog.sync([model({ id: "bad", raw: { invalid: 1n } })])).toThrow();
    expect(catalog.listModels().map(({ id }) => id)).toEqual(["model-alpha"]);
  });

  it("profiles only currently available models and preserves omitted tool capability", () => {
    catalog.sync([model()]);
    expect(catalog.profile("missing", 3, true)).toBe(false);
    expect(catalog.profile("model-alpha", 5, false)).toBe(true);
    expect(catalog.listModels()[0]).toMatchObject({ qualityTier: 5, enabled: false, toolsSupported: true });
  });
});

describe("ModelCatalog selection and feedback", () => {
  it("selects by estimated cost, then model id, and records a decision", () => {
    catalog.sync([model({ id: "z-expensive", inputPrice: 2 }), model({ id: "a-cheap" })]);
    const decision = catalog.select("simple", false, 100, 100);
    expect(decision).toMatchObject({ modelId: "a-cheap", complexity: "simple", successRate: 0.5, feedbackCount: 0 });
    expect(decision?.id).toBeTruthy();
  });

  it("returns no model when candidates fail any eligibility rule", () => {
    const rejected: Array<[string, CatalogModel, "simple" | "complex", boolean]> = [
      ["disabled", model(), "simple", false],
      ["missing input price", model({ inputPrice: null }), "simple", true],
      ["missing output price", model({ outputPrice: null }), "simple", true],
      ["unsupported format", model({ apiFormats: ["embeddings"] }), "simple", true],
      ["non-text identifier", model({ id: "image-model" }), "simple", true],
      ["low quality for complex requests", model({ id: "low-quality" }), "complex", true],
      ["unknown tool support", model({ toolsSupported: null }), "simple", true],
      ["insufficient context", model({ contextWindow: 20 }), "simple", true],
      ["blacklisted", model({ id: "safe-id", name: "SMaug model" }), "simple", true],
    ];
    for (const [label, candidate, complexity, enabled] of rejected) {
      catalog.sync([candidate]);
      if (label === "disabled") catalog.profile(candidate.id, 3, enabled);
      const tools = label === "unknown tool support";
      const inputTokens = label === "insufficient context" ? 15 : 1;
      const outputTokens = label === "insufficient context" ? 10 : 1;
      expect(catalog.select(complexity, tools, inputTokens, outputTokens), label).toBeNull();
    }
  });

  it("allows complex requests only for profiles with quality tier at least three", () => {
    catalog.sync([model({ id: "qualified" }), model({ id: "unqualified" })]);
    catalog.profile("qualified", 3, true);
    catalog.profile("unqualified", 2, true);
    expect(catalog.select("complex", false, 1, 1)?.modelId).toBe("qualified");
  });

  it("requires explicit tool support for tool requests", () => {
    catalog.sync([model({ id: "yes", toolsSupported: true }), model({ id: "no", toolsSupported: false })]);
    expect(catalog.select("simple", true, 1, 1)?.modelId).toBe("yes");
  });

  it("ranks models by measured success rate after five feedback records", () => {
    catalog.sync([model({ id: "alpha" }), model({ id: "beta", inputPrice: 0 })]);
    catalog.profile("alpha", 3, false);
    for (let index = 0; index < 5; index += 1) {
      const decision = catalog.select("simple", false, 1, 1)!;
      expect(decision.modelId).toBe("beta");
      catalog.addFeedback(decision.id, false);
    }
    catalog.profile("alpha", 3, true);
    expect(catalog.select("simple", false, 1, 1)).toMatchObject({ modelId: "alpha", successRate: 0.5, feedbackCount: 0 });
  });

  it("uses neutral success rate below the five-feedback threshold", () => {
    catalog.sync([model()]);
    const decision = catalog.select("simple", false, 1, 1)!;
    for (let index = 0; index < 4; index += 1) {
      const next = index === 0 ? decision : catalog.select("simple", false, 1, 1)!;
      catalog.addFeedback(next.id, true);
    }
    expect(catalog.select("simple", false, 1, 1)).toMatchObject({ successRate: 0.5, feedbackCount: 4 });
  });

  it("records feedback once per decision and returns false for unknown decisions", () => {
    catalog.sync([model()]);
    const decision = catalog.select("simple", false, 1, 1)!;
    expect(catalog.addFeedback("unknown", true)).toBe(false);
    expect(catalog.addFeedback(decision.id, true, "good result")).toBe(true);
    expect(() => catalog.addFeedback(decision.id, false)).toThrow();
  });
});
