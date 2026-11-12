import type { DatabaseSync } from "node:sqlite";
import type { CatalogModel } from "./types.js";

export function seedBlacklist(db: DatabaseSync, patterns: string[]): void {
  const insert = db.prepare("INSERT OR IGNORE INTO blacklist(pattern) VALUES (?)");
  for (const raw of patterns) {
    const pattern = raw.trim().toLocaleLowerCase("en-US");
    if (pattern) insert.run(pattern);
  }
}

export function setBlacklistedPattern(db: DatabaseSync, patternValue: string, blocked: boolean): void {
  const pattern = patternValue.trim().toLocaleLowerCase("en-US");
  if (!pattern || pattern.length > 100) throw new Error("Blacklist pattern must contain 1 to 100 characters");
  if (blocked) db.prepare("INSERT OR IGNORE INTO blacklist(pattern) VALUES (?)").run(pattern);
  else db.prepare("DELETE FROM blacklist WHERE pattern = ?").run(pattern);
}

export function listBlacklist(db: DatabaseSync): string[] {
  return (db.prepare("SELECT pattern FROM blacklist ORDER BY pattern").all() as Array<{ pattern: string }>)
    .map(({ pattern }) => pattern);
}

export function isBlacklisted(db: DatabaseSync, model: Pick<CatalogModel, "id" | "name">): boolean {
  const haystack = `${model.id}\n${model.name}`.toLocaleLowerCase("en-US");
  return listBlacklist(db).some((pattern) => haystack.includes(pattern));
}
