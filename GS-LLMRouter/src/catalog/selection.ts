import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { isBlacklisted } from "./blacklist.js";
import { listModels } from "./profiles.js";
import type { Complexity, DecisionRecord, ModelProfile } from "./types.js";

function isEligible(
  db: DatabaseSync,
  model: ModelProfile,
  complexity: Complexity,
  hasTools: boolean,
  estimatedInputTokens: number,
  expectedOutputTokens: number,
): boolean {
  if (!model.enabled || isBlacklisted(db, model)) return false;
  if (model.inputPrice === null || model.outputPrice === null) return false;
  if (model.apiFormats.length && !model.apiFormats.some((format) => /chat.?completions|openai.?chat/i.test(format))) return false;
  if (/image|embedding|classification|audio|speech/i.test(model.id)) return false;
  if (complexity === "complex" && (model.qualityTier ?? 1) < 3) return false;
  if (hasTools && model.toolsSupported !== true) return false;
  if (model.contextWindow !== null && model.contextWindow < estimatedInputTokens + expectedOutputTokens) return false;
  return true;
}

function feedbackStats(db: DatabaseSync, modelId: string, complexity: Complexity): { count: number; successRate: number } {
  const feedback = db.prepare(`
    SELECT COUNT(feedback.success) AS total, SUM(feedback.success) AS successes
    FROM decisions LEFT JOIN feedback ON feedback.decision_id = decisions.id
    WHERE decisions.model_id = ? AND decisions.complexity = ? AND feedback.success IS NOT NULL
  `).get(modelId, complexity) as { total: number; successes: number | null };
  const count = Number(feedback.total || 0);
  return { count, successRate: count >= 5 ? Number(feedback.successes || 0) / count : 0.5 };
}

export function selectModel(
  db: DatabaseSync,
  complexity: Complexity,
  hasTools: boolean,
  estimatedInputTokens: number,
  expectedOutputTokens: number,
): DecisionRecord | null {
  const candidates = listModels(db).filter((model) =>
    isEligible(db, model, complexity, hasTools, estimatedInputTokens, expectedOutputTokens));

  const scored = candidates.map((model) => {
    const { count, successRate } = feedbackStats(db, model.id, complexity);
    const estimatedCost = (estimatedInputTokens * model.inputPrice! + expectedOutputTokens * model.outputPrice!) / 1_000_000;
    return { model, successRate, count, estimatedCost };
  });
  scored.sort((a, b) => b.successRate - a.successRate || a.estimatedCost - b.estimatedCost || a.model.id.localeCompare(b.model.id));
  const selected = scored[0];
  if (!selected) return null;

  const id = randomUUID();
  db.prepare("INSERT INTO decisions(id, model_id, complexity, created_at) VALUES (?, ?, ?, ?)")
    .run(id, selected.model.id, complexity, new Date().toISOString());
  return { id, modelId: selected.model.id, complexity, successRate: selected.successRate, feedbackCount: selected.count };
}
