import type { CatalogModel } from "./types.js";

function object(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function firstValue(source: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    const value = source[key];
    if (value !== undefined && value !== null) return value;
  }
  return undefined;
}

function numeric(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value)) && Number(value) >= 0) {
    return Number(value);
  }
  return null;
}

function priceValue(source: Record<string, unknown>, keys: string[]): number | null {
  const direct = numeric(firstValue(source, keys));
  if (direct !== null) return direct;
  const pricing = object(source.pricing);
  if (!pricing) return null;
  return numeric(firstValue(pricing, keys));
}

export function parseCatalog(payload: unknown): CatalogModel[] {
  const root = object(payload);
  const rawModels = Array.isArray(payload) ? payload : root?.data;
  if (!Array.isArray(rawModels)) throw new Error("RouteLLM model catalog did not contain a data array");

  const models: CatalogModel[] = [];
  for (const raw of rawModels) {
    const item = object(raw);
    if (!item) continue;
    const idValue = firstValue(item, ["id", "model", "model_id"]);
    if (typeof idValue !== "string" || !idValue.trim()) continue;
    const id = idValue.trim();
    const apiFormatsValue = item.api_formats;
    const apiFormats = Array.isArray(apiFormatsValue)
      ? apiFormatsValue.filter((format): format is string => typeof format === "string")
      : [];
    const modelTypeValue = firstValue(item, ["model_type", "type"]);
    const modelType = typeof modelTypeValue === "string" ? modelTypeValue : "text";
    const nameValue = item.name;
    const contextWindow = numeric(firstValue(item, ["context_window", "context_length", "max_context_length"]));
    const toolsValue = firstValue(item, ["supports_tools", "tool_calling", "function_calling"]);

    models.push({
      id,
      name: typeof nameValue === "string" ? nameValue : id,
      modelType,
      inputPrice: priceValue(item, ["input_price_per_million_tokens", "input_cost_per_1m_tokens", "input_per_1m_tokens", "prompt_price_per_1m_tokens", "prompt"]),
      outputPrice: priceValue(item, ["output_price_per_million_tokens", "output_cost_per_1m_tokens", "output_per_1m_tokens", "completion_price_per_1m_tokens", "completion"]),
      contextWindow,
      apiFormats,
      toolsSupported: typeof toolsValue === "boolean" ? toolsValue : null,
      raw,
    });
  }
  return models;
}
