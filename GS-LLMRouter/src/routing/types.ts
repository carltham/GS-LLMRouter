import type { DecisionRecord } from "../catalog/types.js";

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
