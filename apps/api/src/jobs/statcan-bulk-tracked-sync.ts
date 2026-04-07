/**
 * Bulk tracked datasets: full-table download + `getChangedCubeList` incremental (Option A).
 *
 * Idempotency: `raw_payloads` dedupes on `(source, sha256)`; `source_key` includes product and channel.
 * Concurrency: `STATCAN_BULK_TRACKED_PARALLEL` caps parallel product processing per job run.
 */
import { StatCanClient } from "../connectors/statcan/statcan-client.ts";
import { fetchPortalZipFirstCsv } from "../connectors/statcan/statcan-portal-zip.ts";
import { extractChangedCubeProductIds } from "../connectors/statcan/wds-changed-parse.ts";
import type { StatcanTrackedDatasetRow } from "../db/repositories/statcan-tracked-datasets.ts";
import * as trackedRepo from "../db/repositories/statcan-tracked-datasets.ts";
import * as rawPayloadsRepo from "../db/repositories/raw-payloads.ts";
import * as jobRunsRepo from "../db/repositories/job-runs.ts";
import { appendOperationalLog } from "../logging/operational.ts";
import {
  computeNextRunAfter,
  type ScheduleFrequency,
} from "../services/statcan-next-run.ts";
import { sha256Hex } from "../util/hash.ts";
import type { JobContext } from "./runners.ts";

export const STATCAN_BULK_FULL_TABLE_SOURCE = "statcan-bulk-full-table" as const;

const JOB_NAME = "statcan-bulk-tracked-sync" as const;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Calendar date in UTC for `getChangedCubeList` — previous UTC day (release alignment). */
export function utcYesterdayDateString(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function nextRunAfterSuccess(row: StatcanTrackedDatasetRow): string {
  return computeNextRunAfter(new Date(), {
    frequency: row.frequency as ScheduleFrequency,
    hourUtc: row.hour_utc,
    minuteUtc: row.minute_utc,
    dayOfWeek: row.day_of_week,
    dayOfMonth: row.day_of_month,
  }).toISOString();
}

function bumpNextAfterError(): string {
  return new Date(Date.now() + 86_400_000).toISOString();
}

async function loadFullTable(
  ctx: JobContext,
  client: StatCanClient,
  row: StatcanTrackedDatasetRow,
  jobRunId: number,
): Promise<{ inserted: boolean; sha256: string }> {
  const pid = row.product_id;
  if (row.download_channel === "statcan_portal_zip") {
    const { csvText, sourceKey } = await fetchPortalZipFirstCsv(pid, {
      fetchImpl: ctx.fetchImpl ?? fetch,
      userAgent: ctx.env.HTTP_USER_AGENT,
      lang: "en",
    });
    const sha = sha256Hex(csvText);
    const inserted = rawPayloadsRepo.insertRawPayload(ctx.db, {
      source: STATCAN_BULK_FULL_TABLE_SOURCE,
      sourceKey: `${sourceKey}:sha:${sha.slice(0, 16)}`,
      contentType: "text/csv",
      body: csvText,
      sha256: sha,
      jobRunId,
    });
    return { inserted, sha256: sha };
  }
  const csvText = await client.getFullTableDownloadCSV(pid, "en");
  const sha = sha256Hex(csvText);
  const inserted = rawPayloadsRepo.insertRawPayload(ctx.db, {
    source: STATCAN_BULK_FULL_TABLE_SOURCE,
    sourceKey: `bulk:wds:csv:${pid}:en:sha:${sha.slice(0, 16)}`,
    contentType: "text/csv",
    body: csvText,
    sha256: sha,
    jobRunId,
  });
  return { inserted, sha256: sha };
}

/**
 * One tracked row: initial full load, or change-detection + optional full reload.
 */
export async function processOneTrackedDataset(
  ctx: JobContext,
  client: StatCanClient,
  row: StatcanTrackedDatasetRow,
  jobRunId: number,
): Promise<void> {
  const delay = ctx.env.STATCAN_REQUEST_DELAY_MS;
  const nowIso = new Date().toISOString();

  try {
    if (row.last_full_download_at == null) {
      await sleep(delay);
      await loadFullTable(ctx, client, row, jobRunId);
      trackedRepo.updateTrackedRunState(ctx.db, row.id, {
        last_full_download_at: nowIso,
        last_changed_check_at: nowIso,
        last_error: null,
        status: "active",
        next_run_at: nextRunAfterSuccess({
          ...row,
          last_full_download_at: nowIso,
        }),
      });
      return;
    }

    const queryDate = utcYesterdayDateString();
    await sleep(delay);
    const changedRaw = await client.getChangedCubeList(queryDate);
    const changedIds = extractChangedCubeProductIds(changedRaw);

    if (changedIds.has(row.product_id)) {
      await sleep(delay);
      await loadFullTable(ctx, client, row, jobRunId);
    }

    trackedRepo.updateTrackedRunState(ctx.db, row.id, {
      last_full_download_at: changedIds.has(row.product_id)
        ? nowIso
        : row.last_full_download_at,
      last_changed_check_at: nowIso,
      last_changed_query_date: queryDate,
      last_error: null,
      status: "active",
      next_run_at: nextRunAfterSuccess(row),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    trackedRepo.updateTrackedRunState(ctx.db, row.id, {
      last_error: msg,
      status: "error",
      next_run_at: bumpNextAfterError(),
    });
    appendOperationalLog(ctx.db, ctx.env, {
      source: `job:${JOB_NAME}`,
      level: "error",
      jobRunId,
      message: `Tracked dataset ${row.id} product ${row.product_id}: ${msg}`,
      detail: {
        trackedId: row.id,
        productId: row.product_id,
        stack: e instanceof Error ? e.stack : undefined,
      },
    });
  }
}

async function runBatchParallel(
  ctx: JobContext,
  client: StatCanClient,
  rows: StatcanTrackedDatasetRow[],
  jobRunId: number,
  parallel: number,
): Promise<void> {
  const queue = [...rows];
  const n = Math.max(1, Math.min(parallel, queue.length));
  async function worker(): Promise<void> {
    for (;;) {
      const row = queue.shift();
      if (!row) return;
      await processOneTrackedDataset(ctx, client, row, jobRunId);
    }
  }
  await Promise.all(Array.from({ length: n }, () => worker()));
}

export async function jobStatcanBulkTrackedSync(ctx: JobContext): Promise<void> {
  const runId = jobRunsRepo.insertJobRun(ctx.db, JOB_NAME);
  appendOperationalLog(ctx.db, ctx.env, {
    source: `job:${JOB_NAME}`,
    level: "info",
    jobRunId: runId,
    message: "Job started",
  });

  const nowIso = new Date().toISOString();
  const due = trackedRepo.listDueTrackedDatasets(ctx.db, nowIso);

  if (due.length === 0) {
    jobRunsRepo.finishJobRun(ctx.db, runId, "success", null);
    appendOperationalLog(ctx.db, ctx.env, {
      source: `job:${JOB_NAME}`,
      level: "info",
      jobRunId: runId,
      message: "No due tracked datasets",
    });
    return;
  }

  const client = StatCanClient.fromEnv(ctx.env, ctx.fetchImpl);
  const parallel = ctx.env.STATCAN_BULK_TRACKED_PARALLEL;

  try {
    await runBatchParallel(ctx, client, due, runId, parallel);
    jobRunsRepo.finishJobRun(ctx.db, runId, "success", null);
    appendOperationalLog(ctx.db, ctx.env, {
      source: `job:${JOB_NAME}`,
      level: "info",
      jobRunId: runId,
      message: `Processed ${due.length} tracked dataset(s)`,
      detail: { count: due.length },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    jobRunsRepo.finishJobRun(ctx.db, runId, "failed", msg);
    appendOperationalLog(ctx.db, ctx.env, {
      source: `job:${JOB_NAME}`,
      level: "error",
      jobRunId: runId,
      message: msg,
      detail: { stack: e instanceof Error ? e.stack : undefined },
    });
    throw e;
  }
}

/** Manual refresh: same pipeline as a scheduled tick for one row (re-read row by id). */
export async function runBulkTrackedDatasetRefresh(
  ctx: JobContext,
  trackedId: number,
): Promise<void> {
  const runId = jobRunsRepo.insertJobRun(ctx.db, JOB_NAME);
  appendOperationalLog(ctx.db, ctx.env, {
    source: `job:${JOB_NAME}`,
    level: "info",
    jobRunId: runId,
    message: "Manual refresh",
    detail: { trackedId },
  });
  const row = trackedRepo.getTrackedById(ctx.db, trackedId);
  if (!row) {
    jobRunsRepo.finishJobRun(ctx.db, runId, "failed", "Not found");
    throw new Error("Tracked dataset not found");
  }
  if (row.enabled !== 1) {
    jobRunsRepo.finishJobRun(ctx.db, runId, "failed", "Disabled");
    throw new Error("Tracked dataset is disabled");
  }
  const client = StatCanClient.fromEnv(ctx.env, ctx.fetchImpl);
  try {
    await processOneTrackedDataset(ctx, client, row, runId);
    const after = trackedRepo.getTrackedById(ctx.db, trackedId);
    if (after?.status === "error" && after.last_error) {
      jobRunsRepo.finishJobRun(ctx.db, runId, "failed", after.last_error);
      return;
    }
    jobRunsRepo.finishJobRun(ctx.db, runId, "success", null);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    jobRunsRepo.finishJobRun(ctx.db, runId, "failed", msg);
    throw e;
  }
}
