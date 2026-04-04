import type { KeywordBuckets } from "./score-cubes.ts";

export async function loadKeywordBuckets(path: string): Promise<KeywordBuckets> {
  const file = Bun.file(path);
  if (!(await file.exists())) {
    throw new Error(`Keyword config not found: ${path}`);
  }
  const parsed: unknown = await file.json();
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("housing" in parsed) ||
    !("macro" in parsed)
  ) {
    throw new Error("Keyword config must have { housing: string[], macro: string[] }");
  }
  const o = parsed as { housing: unknown; macro: unknown };
  if (!Array.isArray(o.housing) || !Array.isArray(o.macro)) {
    throw new Error("housing and macro must be arrays");
  }
  return {
    housing: o.housing.map(String),
    macro: o.macro.map(String),
  };
}
