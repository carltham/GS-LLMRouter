import type { Complexity } from "../catalog/types.js";

export function classifyComplexity(text: string, hasTools: boolean): Complexity {
  return hasTools || text.length > 4000 || /\b(debug|refactor|implement|design|analy[sz]e|architecture|migrate|security review)\b/i.test(text)
    ? "complex"
    : "simple";
}
