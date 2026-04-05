import type { Database } from "bun:sqlite";
import { join } from "node:path";
import { fetchBocRss, BOC_RSS_SOURCE } from "../connectors/boc-rss.ts";
import { fetchBocValetExemplar, BOC_VALET_SOURCE } from "../connectors/boc-valet.ts";
import { fetchStatcanRss, STATCAN_RSS_SOURCE } from "../connectors/statcan-rss.ts";
import { loadCatalogFromApi, loadCatalogFromFile } from "../connectors/statcan/catalog-loader.ts";
import { loadKeywordBuckets } from "../connectors/statcan/keywords-loader.ts";
import {
  isArchivedCube,
  scoreCubeTitles,
} from "../connectors/statcan/score-cubes.ts";
import { StatCanClient } from "../connectors/statcan/statcan-client.ts";
import {
  parseVectorIdList,
  resolveTargetProductIds,
} from "../connectors/statcan/target-ids.ts";
import * as jobRunsRepo from "../db/repositories/job-runs.ts";
import * as rawPayloadsRepo from "../db/repositories/raw-payloads.ts";
import * as statcanCatalogRepo from "../db/repositories/statcan-catalog.ts";
import * as statcanCursorRepo from "../db/repositories/statcan-cursor.ts";
import type { Env } from "../env.ts";
import type { FetchFn } from "../connectors/fetch-types.ts";
import { appendOperationalLog } from "../logging/operational.ts";
import { sha256Hex } from "../util/hash.ts";

export const STATCAN_CATALOG_SOURCE = "statcan-catalog-index" as const;
export const STATCAN_WDS_METADATA_SOURCE = "statcan-wds-metadata" as const;
export const STATCAN_WDS_DATA_SOURCE = "statcan-wds-data" as const;

export type JobContext = {
  db: Database;
  env: Env;
  fetchImpl?: FetchFn;
};

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function runIngestJob(
  ctx: JobContext,
  jobName: string,
  source: string,
  load: () => Promise<{ body: string; contentType: string; sourceKey: string }>,
): Promise<void> {
  const runId = jobRunsRepo.insertJobRun(ctx.db, jobName);
  appendOperationalLog(ctx.db, ctx.env, {
    source: `job:${jobName}`,
    level: "info",
    jobRunId: runId,
    message: "Job started",
  });
  try {
    const payload = await load();
    const sha = sha256Hex(payload.body);
    rawPayloadsRepo.insertRawPayload(ctx.db, {
      source,
      sourceKey: payload.sourceKey,
      contentType: payload.contentType,
      body: payload.body,
      sha256: sha,
      jobRunId: runId,
    });
    jobRunsRepo.finishJobRun(ctx.db, runId, "success", null);
    appendOperationalLog(ctx.db, ctx.env, {
      source: `job:${jobName}`,
      level: "info",
      jobRunId: runId,
      message: "Job completed successfully",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    jobRunsRepo.finishJobRun(ctx.db, runId, "failed", msg);
    appendOperationalLog(ctx.db, ctx.env, {
      source: `job:${jobName}`,
      level: "error",
      jobRunId: runId,
      message: msg,
      detail: { stack: e instanceof Error ? e.stack : undefined },
    });
    throw e;
  }
}

export async function jobStatcanRss(ctx: JobContext): Promise<void> {
  await runIngestJob(ctx, "statcan-rss", STATCAN_RSS_SOURCE, () =>
    fetchStatcanRss(ctx.env, ctx.fetchImpl),
  );
}

export async function jobBocRss(ctx: JobContext): Promise<void> {
  await runIngestJob(ctx, "boc-rss", BOC_RSS_SOURCE, () =>
    fetchBocRss(ctx.env, ctx.fetchImpl),
  );
}

export async function jobBocValet(ctx: JobContext): Promise<void> {
  await runIngestJob(ctx, "boc-valet", BOC_VALET_SOURCE, () =>
    fetchBocValetExemplar(ctx.env, ctx.fetchImpl),
  );
}

const defaultKeywordsPath = join(
  import.meta.dir,
  "../../config/statcan-keywords.json",
);

export async function jobStatcanCatalogIndex(ctx: JobContext): Promise<void> {
  const runId = jobRunsRepo.insertJobRun(ctx.db, "statcan-catalog-index");
  appendOperationalLog(ctx.db, ctx.env, {
    source: "job:statcan-catalog-index",
    level: "info",
    jobRunId: runId,
    message: "Job started",
  });
  try {
    const kwPath = ctx.env.STATCAN_KEYWORDS_PATH ?? defaultKeywordsPath;
    const buckets = await loadKeywordBuckets(kwPath);
    const client = StatCanClient.fromEnv(ctx.env, ctx.fetchImpl);

    let rows: Awaited<ReturnType<typeof loadCatalogFromFile>>;
    if (ctx.env.STATCAN_CATALOG_FROM_API) {
      rows = await loadCatalogFromApi(client);
    } else {
      const p = ctx.env.STATCAN_CATALOG_PATH;
      if (!p?.trim()) {
        throw new Error(
          "Set STATCAN_CATALOG_PATH to a JSON file, or set STATCAN_CATALOG_FROM_API=true",
        );
      }
      rows = await loadCatalogFromFile(p);
    }

    const min = ctx.env.STATCAN_MIN_KEYWORD_SCORE;
    const now = new Date().toISOString();
    let inserted = 0;

    for (const row of rows) {
      if (isArchivedCube(row.archived)) continue;
      const scores = scoreCubeTitles(row.cubeTitleEn, row.cubeTitleFr, buckets);
      if (scores.housingScore < min && scores.macroScore < min) continue;

      statcanCatalogRepo.upsertCubeCatalog(ctx.db, {
        product_id: row.productId,
        cansim_id: row.cansimId ?? null,
        cube_title_en: row.cubeTitleEn ?? null,
        cube_title_fr: row.cubeTitleFr ?? null,
        archived: row.archived !== undefined ? String(row.archived) : null,
        frequency_code: row.frequencyCode ?? null,
        subject_codes: row.subjectCode
          ? JSON.stringify(row.subjectCode)
          : null,
        housing_score: scores.housingScore,
        macro_score: scores.macroScore,
        indexed_at: now,
        raw_json: JSON.stringify(row),
      });
      inserted += 1;
    }

    jobRunsRepo.finishJobRun(ctx.db, runId, "success", null);
    appendOperationalLog(ctx.db, ctx.env, {
      source: "job:statcan-catalog-index",
      level: "info",
      jobRunId: runId,
      message: `Indexed ${inserted} cubes (min score ${min}, from ${rows.length} source rows)`,
      detail: { inserted, minScore: min, sourceRows: rows.length },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    jobRunsRepo.finishJobRun(ctx.db, runId, "failed", msg);
    appendOperationalLog(ctx.db, ctx.env, {
      source: "job:statcan-catalog-index",
      level: "error",
      jobRunId: runId,
      message: msg,
      detail: { stack: e instanceof Error ? e.stack : undefined },
    });
    throw e;
  }
}

export async function jobStatcanWdsMetadata(ctx: JobContext): Promise<void> {
  const runId = jobRunsRepo.insertJobRun(ctx.db, "statcan-wds-metadata");
  appendOperationalLog(ctx.db, ctx.env, {
    source: "job:statcan-wds-metadata",
    level: "info",
    jobRunId: runId,
    message: "Job started",
  });
  try {
    const client = StatCanClient.fromEnv(ctx.env, ctx.fetchImpl);
    const ids = resolveTargetProductIds(ctx.env, ctx.db);
    const delay = ctx.env.STATCAN_REQUEST_DELAY_MS;

    for (const productId of ids) {
      await sleep(delay);
      const data = await client.getCubeMetadata(productId);
      const body = JSON.stringify(data);
      const sha = sha256Hex(body);
      rawPayloadsRepo.insertRawPayload(ctx.db, {
        source: STATCAN_WDS_METADATA_SOURCE,
        sourceKey: `metadata:${productId}`,
        contentType: "application/json",
        body,
        sha256: sha,
        jobRunId: runId,
      });
      statcanCursorRepo.upsertCursorMetadata(
        ctx.db,
        productId,
        sha,
        new Date().toISOString(),
      );
      statcanCursorRepo.setCursorError(ctx.db, productId, null);
    }

    jobRunsRepo.finishJobRun(ctx.db, runId, "success", null);
    appendOperationalLog(ctx.db, ctx.env, {
      source: "job:statcan-wds-metadata",
      level: "info",
      jobRunId: runId,
      message: "Job completed successfully",
      detail: { productCount: ids.length },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    jobRunsRepo.finishJobRun(ctx.db, runId, "failed", msg);
    appendOperationalLog(ctx.db, ctx.env, {
      source: "job:statcan-wds-metadata",
      level: "error",
      jobRunId: runId,
      message: msg,
      detail: { stack: e instanceof Error ? e.stack : undefined },
    });
    throw e;
  }
}

export async function jobStatcanWdsData(ctx: JobContext): Promise<void> {
  const runId = jobRunsRepo.insertJobRun(ctx.db, "statcan-wds-data");
  appendOperationalLog(ctx.db, ctx.env, {
    source: "job:statcan-wds-data",
    level: "info",
    jobRunId: runId,
    message: "Job started",
  });
  try {
    const client = StatCanClient.fromEnv(ctx.env, ctx.fetchImpl);
    const delay = ctx.env.STATCAN_REQUEST_DELAY_MS;
    const latestN = ctx.env.STATCAN_LATEST_N;
    const vectors = parseVectorIdList(ctx.env.STATCAN_DATA_VECTOR_IDS);

    if (vectors.length > 0) {
      for (const vectorId of vectors) {
        await sleep(delay);
        const data = await client.getDataFromVectorsAndLatestNPeriods(
          vectorId,
          latestN,
        );
        const body = JSON.stringify(data);
        const sha = sha256Hex(body);
        rawPayloadsRepo.insertRawPayload(ctx.db, {
          source: STATCAN_WDS_DATA_SOURCE,
          sourceKey: `data:vector:${vectorId}`,
          contentType: "application/json",
          body,
          sha256: sha,
          jobRunId: runId,
        });
      }
      jobRunsRepo.finishJobRun(ctx.db, runId, "success", null);
      appendOperationalLog(ctx.db, ctx.env, {
        source: "job:statcan-wds-data",
        level: "info",
        jobRunId: runId,
        message: "Job completed successfully",
        detail: { mode: "vectors", count: vectors.length },
      });
      return;
    }

    const coord = ctx.env.STATCAN_DEFAULT_DATA_COORDINATE?.trim();
    if (!coord) {
      appendOperationalLog(ctx.db, ctx.env, {
        source: "job:statcan-wds-data",
        level: "warn",
        jobRunId: runId,
        message:
          "Set STATCAN_DATA_VECTOR_IDS or STATCAN_DEFAULT_DATA_COORDINATE; nothing fetched",
      });
      jobRunsRepo.finishJobRun(ctx.db, runId, "success", null);
      appendOperationalLog(ctx.db, ctx.env, {
        source: "job:statcan-wds-data",
        level: "info",
        jobRunId: runId,
        message: "Job completed (no data path configured)",
      });
      return;
    }

    const ids = resolveTargetProductIds(ctx.env, ctx.db);
    for (const productId of ids) {
      await sleep(delay);
      const data = await client.getDataFromCubePidCoordAndLatestNPeriods(
        productId,
        coord,
        latestN,
      );
      const body = JSON.stringify(data);
      const sha = sha256Hex(body);
      rawPayloadsRepo.insertRawPayload(ctx.db, {
        source: STATCAN_WDS_DATA_SOURCE,
        sourceKey: `data:cube:${productId}:${coord}`,
        contentType: "application/json",
        body,
        sha256: sha,
        jobRunId: runId,
      });
      statcanCursorRepo.upsertCursorData(
        ctx.db,
        productId,
        new Date().toISOString(),
      );
    }

    jobRunsRepo.finishJobRun(ctx.db, runId, "success", null);
    appendOperationalLog(ctx.db, ctx.env, {
      source: "job:statcan-wds-data",
      level: "info",
      jobRunId: runId,
      message: "Job completed successfully",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    jobRunsRepo.finishJobRun(ctx.db, runId, "failed", msg);
    appendOperationalLog(ctx.db, ctx.env, {
      source: "job:statcan-wds-data",
      level: "error",
      jobRunId: runId,
      message: msg,
      detail: { stack: e instanceof Error ? e.stack : undefined },
    });
    throw e;
  }
}
