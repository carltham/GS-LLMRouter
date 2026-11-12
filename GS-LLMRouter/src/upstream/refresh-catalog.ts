import type { ModelCatalog } from "../catalog/model-catalog.js";
import { parseCatalog } from "../catalog/parse-catalog.js";
import type { RouterConfig } from "../config/router-config.js";

export async function refreshCatalog(config: RouterConfig, catalog: ModelCatalog): Promise<number> {
  const response = await fetch(new URL("models", `${config.baseUrl.href}/`), {
    headers: { authorization: `Bearer ${config.apiKey}`, accept: "application/json" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`RouteLLM model catalog returned HTTP ${response.status}`);
  const models = parseCatalog(await response.json());
  if (models.length === 0) throw new Error("RouteLLM returned an empty or unrecognized model catalog");
  catalog.sync(models);
  return models.length;
}
