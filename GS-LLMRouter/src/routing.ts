import type { ModelCatalog, DecisionRecord } from "./catalog.js";

export const ROUTER_ALIAS = "route-llm";

export interface ChatRequest {
  model?: unknown;
  messages?: unknown;
  tools?: unknown;
  max_tokens?: unknown;
  max_completion_tokens?: unknown;
  [key: string]: unknown;
}

export interface RoutingResult {
  decision: DecisionRecord;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
}

function messageText(body: ChatRequest): string {
  if (!Array.isArray(body.messages)) return "";
  return body.messages.map((message) => {
    if (typeof message !== "object" || message === null || !("content" in message)) return "";
    const content = message.content;
    if (typeof content === "string") return content;
    if (!Array.isArray(content)) return "";
    return content.map((part) => {
      if (typeof part === "object" && part !== null && "text" in part && typeof part.text === "string") return part.text;
      return "";
    }).join(" ");
  }).join(" ");
}

function positiveInteger(value: unknown): number | null {
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

export function routeRequest(body: ChatRequest, catalog: ModelCatalog): RoutingResult | null {
  const text = messageText(body);
  const hasTools = Array.isArray(body.tools) && body.tools.length > 0;
  const complexity: "simple" | "complex" =
    hasTools || text.length > 4000 || /\b(debug|refactor|implement|design|analy[sz]e|architecture|migrate|security review)\b/i.test(text)
      ? "complex"
      : "simple";
  const estimatedInputTokens = Math.max(1, Math.ceil(text.length / 4));
  const estimatedOutputTokens = Math.min(
    8192,
    positiveInteger(body.max_completion_tokens) ?? positiveInteger(body.max_tokens) ?? 1024,
  );
  const decision = catalog.select(complexity, hasTools, estimatedInputTokens, estimatedOutputTokens);
  return decision ? { decision, estimatedInputTokens, estimatedOutputTokens } : null;
}
