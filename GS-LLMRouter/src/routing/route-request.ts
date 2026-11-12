import type { ModelCatalog } from "../catalog/model-catalog.js";
import { classifyComplexity } from "./complexity.js";
import { messageText } from "./message-text.js";
import { estimateInputTokens, estimateOutputTokens } from "./token-estimates.js";
import type { ChatRequest, RoutingResult } from "./types.js";

export function routeRequest(body: ChatRequest, catalog: ModelCatalog): RoutingResult | null {
  const text = messageText(body);
  const hasTools = Array.isArray(body.tools) && body.tools.length > 0;
  const complexity = classifyComplexity(text, hasTools);
  const estimatedInputTokens = estimateInputTokens(text);
  const estimatedOutputTokens = estimateOutputTokens(body);
  const decision = catalog.select(complexity, hasTools, estimatedInputTokens, estimatedOutputTokens);
  return decision ? { decision, estimatedInputTokens, estimatedOutputTokens } : null;
}
