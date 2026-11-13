import type { DatabaseSync } from "node:sqlite";
import type { ModelProfile } from "./types.js";

export function listModels(db: DatabaseSync): ModelProfile[] {
  const rows = db.prepare(`
    SELECT id, name, input_price, output_price, context_window, api_formats,
           output_modalities, tools_supported, quality_tier, enabled
    FROM models WHERE available = 1 ORDER BY id
  `).all() as Array<Record<string, unknown>>;
  return rows.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    inputPrice: typeof row.input_price === "number" ? row.input_price : null,
    outputPrice: typeof row.output_price === "number" ? row.output_price : null,
    contextWindow: typeof row.context_window === "number" ? row.context_window : null,
    apiFormats: JSON.parse(String(row.api_formats)) as string[],
    outputModalities: JSON.parse(String(row.output_modalities ?? "[]")) as string[],
    toolsSupported: typeof row.tools_supported === "number" ? row.tools_supported === 1 : null,
    qualityTier: typeof row.quality_tier === "number" ? row.quality_tier : null,
    enabled: row.enabled === 1,
  }));
}

export function updateProfile(
  db: DatabaseSync,
  id: string,
  qualityTier: number,
  enabled: boolean,
  toolsSupported?: boolean,
): boolean {
  const result = db.prepare(`
    UPDATE models SET quality_tier = ?, enabled = ?,
      tools_supported = COALESCE(?, tools_supported)
    WHERE id = ? AND available = 1
  `).run(qualityTier, Number(enabled), toolsSupported === undefined ? null : Number(toolsSupported), id);
  return result.changes > 0;
}
