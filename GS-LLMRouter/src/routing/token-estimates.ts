import type { ChatRequest } from "./types.js";

function positiveInteger(value: unknown): number | null {
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

export function estimateInputTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

export function estimateOutputTokens(body: ChatRequest): number {
  return Math.min(
    8192,
    positiveInteger(body.max_completion_tokens) ?? positiveInteger(body.max_tokens) ?? 1024,
  );
}
