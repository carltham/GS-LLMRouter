import type { DatabaseSync } from "node:sqlite";
import { isBlacklisted, listBlacklist, seedBlacklist, setBlacklistedPattern } from "./blacklist.js";
import { addFeedback } from "./feedback.js";
import { listModels, updateProfile } from "./profiles.js";
import { openDatabase } from "./schema.js";
import { selectModel } from "./selection.js";
import { syncModels } from "./sync.js";
import type { CatalogModel, Complexity, DecisionRecord, ModelProfile } from "./types.js";

/** Facade over the SQLite-backed catalog; each method delegates to one concern module. */
export class ModelCatalog {
  private readonly db: DatabaseSync;

  constructor(path: string, blacklistPatterns: string[]) {
    this.db = openDatabase(path);
    seedBlacklist(this.db, blacklistPatterns);
  }

  close(): void {
    this.db.close();
  }

  setBlacklistedPattern(patternValue: string, blocked: boolean): void {
    setBlacklistedPattern(this.db, patternValue, blocked);
  }

  blacklist(): string[] {
    return listBlacklist(this.db);
  }

  isBlacklisted(model: Pick<CatalogModel, "id" | "name">): boolean {
    return isBlacklisted(this.db, model);
  }

  sync(models: CatalogModel[]): void {
    syncModels(this.db, models);
  }

  listModels(): ModelProfile[] {
    return listModels(this.db);
  }

  profile(id: string, qualityTier: number, enabled: boolean, toolsSupported?: boolean): boolean {
    return updateProfile(this.db, id, qualityTier, enabled, toolsSupported);
  }

  select(complexity: Complexity, hasTools: boolean, estimatedInputTokens: number, expectedOutputTokens: number): DecisionRecord | null {
    return selectModel(this.db, complexity, hasTools, estimatedInputTokens, expectedOutputTokens);
  }

  addFeedback(decisionId: string, success: boolean, note?: string): boolean {
    return addFeedback(this.db, decisionId, success, note);
  }
}
