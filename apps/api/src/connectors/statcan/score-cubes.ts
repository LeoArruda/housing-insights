export type KeywordBuckets = {
  housing: string[];
  macro: string[];
};

export type CubeScores = {
  housingScore: number;
  macroScore: number;
};

/** Normalize for substring matching (lowercase, collapse punctuation). */
export function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function countKeywordHits(normalizedText: string, keywords: string[]): number {
  let score = 0;
  for (const kw of keywords) {
    const k = normalizeForMatch(kw);
    if (k.length < 2) continue;
    if (normalizedText.includes(k)) score += 1;
  }
  return score;
}

export function scoreCubeTitles(
  cubeTitleEn: string | undefined,
  cubeTitleFr: string | undefined,
  buckets: KeywordBuckets,
): CubeScores {
  const blob = normalizeForMatch(`${cubeTitleEn ?? ""} ${cubeTitleFr ?? ""}`);
  return {
    housingScore: countKeywordHits(blob, buckets.housing),
    macroScore: countKeywordHits(blob, buckets.macro),
  };
}

export function isArchivedCube(archived: string | number | undefined): boolean {
  if (archived === undefined) return false;
  return String(archived) === "1";
}
