import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

export interface CatalogModel {
  id: string;
  name: string;
  modelType: string;
  inputPrice: number | null;
  outputPrice: number | null;
  contextWindow: number | null;
  apiFormats: string[];
  toolsSupported: boolean | null;
  raw: unknown;
}

export interface ModelProfile {
  id: string;
  name: string;
  inputPrice: number | null;
  outputPrice: number | null;
  contextWindow: number | null;
  apiFormats: string[];
  toolsSupported: boolean | null;
  qualityTier: number | null;
  enabled: boolean;
}

export interface DecisionRecord {
  id: string;
  modelId: string;
  complexity: "simple" | "complex";
  successRate: number;
  feedbackCount: number;
}

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

export class ModelCatalog {
  private readonly db: DatabaseSync;

  constructor(path: string, blacklistPatterns: string[]) {
    mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS models (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        model_type TEXT NOT NULL,
        input_price REAL,
        output_price REAL,
        context_window INTEGER,
        api_formats TEXT NOT NULL,
        tools_supported INTEGER,
        quality_tier INTEGER,
        enabled INTEGER NOT NULL DEFAULT 1,
        available INTEGER NOT NULL DEFAULT 1,
        raw_json TEXT NOT NULL,
        catalog_updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS blacklist (
        pattern TEXT PRIMARY KEY COLLATE NOCASE
      );
      CREATE TABLE IF NOT EXISTS decisions (
        id TEXT PRIMARY KEY,
        model_id TEXT NOT NULL,
        complexity TEXT NOT NULL CHECK (complexity IN ('simple', 'complex')),
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS feedback (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        decision_id TEXT NOT NULL REFERENCES decisions(id),
        success INTEGER NOT NULL CHECK (success IN (0, 1)),
        note TEXT,
        created_at TEXT NOT NULL,
        UNIQUE (decision_id)
      );
      CREATE INDEX IF NOT EXISTS decisions_model_complexity ON decisions(model_id, complexity);
    `);
    this.seedBlacklist(blacklistPatterns);
  }

  close(): void {
    this.db.close();
  }

  private seedBlacklist(patterns: string[]): void {
    const insert = this.db.prepare("INSERT OR IGNORE INTO blacklist(pattern) VALUES (?)");
    for (const raw of patterns) {
      const pattern = raw.trim().toLocaleLowerCase("en-US");
      if (pattern) insert.run(pattern);
    }
  }

  setBlacklistedPattern(patternValue: string, blocked: boolean): void {
    const pattern = patternValue.trim().toLocaleLowerCase("en-US");
    if (!pattern || pattern.length > 100) throw new Error("Blacklist pattern must contain 1 to 100 characters");
    if (blocked) this.db.prepare("INSERT OR IGNORE INTO blacklist(pattern) VALUES (?)").run(pattern);
    else this.db.prepare("DELETE FROM blacklist WHERE pattern = ?").run(pattern);
  }

  blacklist(): string[] {
    return (this.db.prepare("SELECT pattern FROM blacklist ORDER BY pattern").all() as Array<{ pattern: string }>)
      .map(({ pattern }) => pattern);
  }

  isBlacklisted(model: Pick<CatalogModel, "id" | "name">): boolean {
    const haystack = `${model.id}\n${model.name}`.toLocaleLowerCase("en-US");
    return this.blacklist().some((pattern) => haystack.includes(pattern));
  }

  sync(models: CatalogModel[]): void {
    const now = new Date().toISOString();
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.db.prepare("UPDATE models SET available = 0").run();
      const upsert = this.db.prepare(`
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
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  listModels(): ModelProfile[] {
    const rows = this.db.prepare(`
      SELECT id, name, input_price, output_price, context_window, api_formats,
             tools_supported, quality_tier, enabled
      FROM models WHERE available = 1 ORDER BY id
    `).all() as Array<Record<string, unknown>>;
    return rows.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      inputPrice: typeof row.input_price === "number" ? row.input_price : null,
      outputPrice: typeof row.output_price === "number" ? row.output_price : null,
      contextWindow: typeof row.context_window === "number" ? row.context_window : null,
      apiFormats: JSON.parse(String(row.api_formats)) as string[],
      toolsSupported: typeof row.tools_supported === "number" ? row.tools_supported === 1 : null,
      qualityTier: typeof row.quality_tier === "number" ? row.quality_tier : null,
      enabled: row.enabled === 1,
    }));
  }

  profile(id: string, qualityTier: number, enabled: boolean, toolsSupported?: boolean): boolean {
    const result = this.db.prepare(`
      UPDATE models SET quality_tier = ?, enabled = ?,
        tools_supported = COALESCE(?, tools_supported)
      WHERE id = ? AND available = 1
    `).run(qualityTier, Number(enabled), toolsSupported === undefined ? null : Number(toolsSupported), id);
    return result.changes > 0;
  }

  select(complexity: "simple" | "complex", hasTools: boolean, estimatedInputTokens: number, expectedOutputTokens: number): DecisionRecord | null {
    const candidates = this.listModels().filter((model) => {
      if (!model.enabled || this.isBlacklisted(model)) return false;
      if (model.inputPrice === null || model.outputPrice === null) return false;
      if (model.apiFormats.length && !model.apiFormats.some((format) => /chat.?completions|openai.?chat/i.test(format))) return false;
      if (/image|embedding|classification|audio|speech/i.test(model.id)) return false;
      if (complexity === "complex" && (model.qualityTier ?? 1) < 3) return false;
      if (hasTools && model.toolsSupported !== true) return false;
      if (model.contextWindow !== null && model.contextWindow < estimatedInputTokens + expectedOutputTokens) return false;
      return true;
    });

    const scored = candidates.map((model) => {
      const feedback = this.db.prepare(`
        SELECT COUNT(feedback.success) AS total, SUM(feedback.success) AS successes
        FROM decisions LEFT JOIN feedback ON feedback.decision_id = decisions.id
        WHERE decisions.model_id = ? AND decisions.complexity = ? AND feedback.success IS NOT NULL
      `).get(model.id, complexity) as { total: number; successes: number | null };
      const count = Number(feedback.total || 0);
      const successRate = count >= 5 ? Number(feedback.successes || 0) / count : 0.5;
      const estimatedCost = (estimatedInputTokens * model.inputPrice! + expectedOutputTokens * model.outputPrice!) / 1_000_000;
      return { model, successRate, count, estimatedCost };
    });
    scored.sort((a, b) => b.successRate - a.successRate || a.estimatedCost - b.estimatedCost || a.model.id.localeCompare(b.model.id));
    const selected = scored[0];
    if (!selected) return null;

    const id = crypto.randomUUID();
    this.db.prepare("INSERT INTO decisions(id, model_id, complexity, created_at) VALUES (?, ?, ?, ?)")
      .run(id, selected.model.id, complexity, new Date().toISOString());
    return { id, modelId: selected.model.id, complexity, successRate: selected.successRate, feedbackCount: selected.count };
  }

  addFeedback(decisionId: string, success: boolean, note?: string): boolean {
    const decision = this.db.prepare("SELECT id FROM decisions WHERE id = ?").get(decisionId);
    if (!decision) return false;
    this.db.prepare("INSERT INTO feedback(decision_id, success, note, created_at) VALUES (?, ?, ?, ?)")
      .run(decisionId, Number(success), note?.slice(0, 500) ?? null, new Date().toISOString());
    return true;
  }
}
