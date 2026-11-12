import { describe, expect, it, vi } from "vitest";
import { ModelCatalog } from "../../../GS-LLMRouter/src/catalog/model-catalog.js";
import type { DecisionRecord } from "../../../GS-LLMRouter/src/catalog/types.js";
import { routeRequest } from "../../../GS-LLMRouter/src/routing/route-request.js";
import { ROUTER_ALIAS, type ChatRequest } from "../../../GS-LLMRouter/src/routing/types.js";

function fakeCatalog(decision: DecisionRecord | null = {
  id: "decision-1",
  modelId: "provider/model-a",
  complexity: "simple",
  successRate: 0.5,
  feedbackCount: 0,
}) {
  return { select: vi.fn(() => decision) } as unknown as ModelCatalog & { select: ReturnType<typeof vi.fn> };
}

describe("routeRequest", () => {
  it("exports the only public model alias", () => {
    expect(ROUTER_ALIAS).toBe("route-llm");
  });

  it("estimates at least one input token and defaults output to 1024", () => {
    const catalog = fakeCatalog();
    expect(routeRequest({ messages: [{ content: "" }] }, catalog)).toMatchObject({
      estimatedInputTokens: 1,
      estimatedOutputTokens: 1024,
    });
    expect(catalog.select).toHaveBeenCalledWith("simple", false, 1, 1024);
  });

  it("extracts text from string and multimodal message content", () => {
    const catalog = fakeCatalog();
    routeRequest({ messages: [
      { content: "hello" },
      { content: [{ type: "text", text: "world" }, { text: 42 }, null, "ignored"] },
      null,
      { role: "assistant" },
      { content: 12 },
    ] }, catalog);
    expect(catalog.select).toHaveBeenCalledWith("simple", false, 5, 1024);
  });

  it.each([
    "debug",
    "refactor",
    "implement",
    "design",
    "analyse",
    "analyze",
    "architecture",
    "migrate",
    "security review",
  ])("classifies keyword request '%s' as complex", (keyword) => {
    const catalog = fakeCatalog();
    routeRequest({ messages: [{ content: `please ${keyword} this` }] }, catalog);
    expect(catalog.select).toHaveBeenCalledWith("complex", false, expect.any(Number), 1024);
  });

  it("classifies over-4000-character requests and tool calls as complex", () => {
    const longCatalog = fakeCatalog();
    routeRequest({ messages: [{ content: "x".repeat(4001) }] }, longCatalog);
    expect(longCatalog.select).toHaveBeenCalledWith("complex", false, 1001, 1024);

    const toolCatalog = fakeCatalog();
    routeRequest({ messages: [], tools: [{ type: "function" }] }, toolCatalog);
    expect(toolCatalog.select).toHaveBeenCalledWith("complex", true, 1, 1024);
  });

  it("uses max_completion_tokens before max_tokens and clamps output to 8192", () => {
    const preferred = fakeCatalog();
    routeRequest({ max_completion_tokens: "35", max_tokens: 9_000 }, preferred);
    expect(preferred.select).toHaveBeenCalledWith("simple", false, 1, 35);

    const clamped = fakeCatalog();
    routeRequest({ max_tokens: 90_000 }, clamped);
    expect(clamped.select).toHaveBeenCalledWith("simple", false, 1, 8192);
  });

  it.each([0, -1, 1.5, "bad", Number.MAX_SAFE_INTEGER + 1])("ignores invalid output token setting %s", (value) => {
    const catalog = fakeCatalog();
    routeRequest({ max_completion_tokens: value, max_tokens: value }, catalog);
    expect(catalog.select).toHaveBeenCalledWith("simple", false, 1, 1024);
  });

  it("returns null when the catalog has no eligible model", () => {
    expect(routeRequest({} as ChatRequest, fakeCatalog(null))).toBeNull();
  });

  it("treats missing or malformed messages as empty text", () => {
    const catalog = fakeCatalog();
    routeRequest({ messages: "invalid" }, catalog);
    expect(catalog.select).toHaveBeenCalledWith("simple", false, 1, 1024);
  });
});
