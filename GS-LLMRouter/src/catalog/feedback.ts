import type { DatabaseSync } from "node:sqlite";

export function addFeedback(db: DatabaseSync, decisionId: string, success: boolean, note?: string): boolean {
  const decision = db.prepare("SELECT id FROM decisions WHERE id = ?").get(decisionId);
  if (!decision) return false;
  db.prepare("INSERT INTO feedback(decision_id, success, note, created_at) VALUES (?, ?, ?, ?)")
    .run(decisionId, Number(success), note?.slice(0, 500) ?? null, new Date().toISOString());
  return true;
}
