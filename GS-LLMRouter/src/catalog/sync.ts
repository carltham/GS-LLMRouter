import type { DatabaseSync } from "node:sqlite";
import type { CatalogModel } from "./types.js";

export function syncModels(db: DatabaseSync, models: CatalogModel[]): void {
  const now = new Date().toISOString();
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare("UPDATE models SET available = 0").run();
    const upsert = db.prepare(`
      INSERT INTO models (
        id, name, model_type, input_price, output_price, context_window, api_formats,
        tools_supported, raw_json, catalog_updated_at, available
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        model_type = excluded.model_type,
        input_price = excluded.input_price,
        output_price = excluded.output_price,
        context_window = excluded.context_window,
        api_formats = excluded.api_formats,
        tools_supported = excluded.tools_supported,
        raw_json = excluded.raw_json,
        catalog_updated_at = excluded.catalog_updated_at,
        available = 1
    `);
    for (const model of models) {
      upsert.run(
        model.id,
        model.name,
        model.modelType,
        model.inputPrice,
        model.outputPrice,
        model.contextWindow,
        JSON.stringify(model.apiFormats),
        model.toolsSupported === null ? null : Number(model.toolsSupported),
        JSON.stringify(model.raw),
        now,
      );
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
