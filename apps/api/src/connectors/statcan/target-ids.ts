import type { Database } from "bun:sqlite";
import type { Env } from "../../env.ts";
import { listKeywordTargets } from "../../db/repositories/statcan-catalog.ts";

export function parseProductIdList(csv: string): number[] {
  if (!csv.trim()) return [];
  return csv
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
}

function uniquePreserveOrder(ids: number[]): number[] {
  const seen = new Set<number>();
  const out: number[] = [];
  for (const id of ids) {
    if (!seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

/**
 * Resolves product IDs for metadata/data jobs from env + indexed catalog.
 */
export function resolveTargetProductIds(env: Env, db: Database): number[] {
  const explicit = parseProductIdList(env.STATCAN_PRODUCT_IDS);
  const max = env.STATCAN_MAX_CUBES_PER_JOB;
  const min = env.STATCAN_MIN_KEYWORD_SCORE;

  if (env.STATCAN_INGEST_MODE === "explicit") {
    return explicit.slice(0, max);
  }

  if (env.STATCAN_INGEST_MODE === "keyword") {
    return listKeywordTargets(db, min, max);
  }

  const kwLimit = Math.max(0, max - explicit.length);
  const kw =
    kwLimit > 0 ? listKeywordTargets(db, min, kwLimit) : [];
  return uniquePreserveOrder([...explicit, ...kw]).slice(0, max);
}

export function parseVectorIdList(csv: string): number[] {
  if (!csv.trim()) return [];
  return csv
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
}
