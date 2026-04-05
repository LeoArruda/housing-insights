import { StatCanClient } from "../connectors/statcan/statcan-client.ts";
import {
  extractChangedCubeProductIds,
  extractChangedSeriesEntries,
} from "../connectors/statcan/wds-changed-parse.ts";
import * as rawPayloadsRepo from "../db/repositories/raw-payloads.ts";
import * as jobRunsRepo from "../db/repositories/job-runs.ts";
import * as schedulesRepo from "../db/repositories/statcan-product-schedules.ts";
import type { StatcanProductScheduleRow } from "../db/repositories/statcan-product-schedules.ts";
import {
  computeNextRunAfter,
  type ScheduleFrequency,
} from "../services/statcan-next-run.ts";
import { appendOperationalLog } from "../logging/operational.ts";
import { sha256Hex } from "../util/hash.ts";
import type { JobContext } from "./runners.ts";

const STATCAN_WDS_METADATA_SOURCE = "statcan-wds-metadata" as const;
const STATCAN_WDS_DATA_SOURCE = "statcan-wds-data" as const;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function scheduleMode(row: StatcanProductScheduleRow): string {
  return row.ingest_mode?.trim() || "latest_n";
}

export async function jobStatcanScheduledIngest(ctx: JobContext): Promise<void> {
  const runId = jobRunsRepo.insertJobRun(ctx.db, "statcan-scheduled-ingest");
  appendOperationalLog(ctx.db, ctx.env, {
    source: "job:statcan-scheduled-ingest",
    level: "info",
    jobRunId: runId,
    message: "Job started",
  });
  const nowIso = new Date().toISOString();
  const due = schedulesRepo.listDueSchedules(ctx.db, nowIso);

  if (due.length === 0) {
    jobRunsRepo.finishJobRun(ctx.db, runId, "success", null);
    appendOperationalLog(ctx.db, ctx.env, {
      source: "job:statcan-scheduled-ingest",
      level: "info",
      jobRunId: runId,
      message: "No due schedules",
    });
    return;
  }

  const client = StatCanClient.fromEnv(ctx.env, ctx.fetchImpl);
  const delay = ctx.env.STATCAN_REQUEST_DELAY_MS;
  const defaultLatestN = ctx.env.STATCAN_LATEST_N;
  const defaultCoord = ctx.env.STATCAN_DEFAULT_DATA_COORDINATE?.trim();

  try {
    for (const row of due) {
      await sleep(delay);
      await processOneSchedule(ctx, client, row, runId, defaultLatestN, defaultCoord);
    }
    jobRunsRepo.finishJobRun(ctx.db, runId, "success", null);
    appendOperationalLog(ctx.db, ctx.env, {
      source: "job:statcan-scheduled-ingest",
      level: "info",
      jobRunId: runId,
      message: `Processed ${due.length} due schedule(s)`,
      detail: { scheduleCount: due.length },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    jobRunsRepo.finishJobRun(ctx.db, runId, "failed", msg);
    appendOperationalLog(ctx.db, ctx.env, {
      source: "job:statcan-scheduled-ingest",
      level: "error",
      jobRunId: runId,
      message: msg,
      detail: { stack: e instanceof Error ? e.stack : undefined },
    });
    throw e;
  }
}

async function processOneSchedule(
  ctx: JobContext,
  client: StatCanClient,
  row: StatcanProductScheduleRow,
  jobRunId: number,
  defaultLatestN: number,
  defaultCoord: string | undefined,
): Promise<void> {
  const latestN = row.latest_n ?? defaultLatestN;
  const mode = scheduleMode(row);

  try {
    if (row.fetch_metadata) {
      const data = await client.getCubeMetadata(row.product_id);
      const body = JSON.stringify(data);
      const sha = sha256Hex(body);
      rawPayloadsRepo.insertRawPayload(ctx.db, {
        source: STATCAN_WDS_METADATA_SOURCE,
        sourceKey: `schedule:${row.id}:metadata:${row.product_id}:mode:${mode}`,
        contentType: "application/json",
        body,
        sha256: sha,
        jobRunId,
      });
    }

    if (row.fetch_data) {
      await ingestByMode(ctx, client, row, jobRunId, latestN, defaultCoord, mode);
    }

    const next = computeNextRunAfter(new Date(), {
      frequency: row.frequency as ScheduleFrequency,
      hourUtc: row.hour_utc,
      minuteUtc: row.minute_utc,
      dayOfWeek: row.day_of_week,
      dayOfMonth: row.day_of_month,
    });
    schedulesRepo.updateScheduleRunState(
      ctx.db,
      row.id,
      new Date().toISOString(),
      next.toISOString(),
      null,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const bump = new Date(Date.now() + 86_400_000);
    const failedAt = new Date().toISOString();
    schedulesRepo.updateScheduleRunState(
      ctx.db,
      row.id,
      failedAt,
      bump.toISOString(),
      msg,
    );
    appendOperationalLog(ctx.db, ctx.env, {
      source: "job:statcan-scheduled-ingest",
      level: "error",
      jobRunId,
      message: `Schedule ${row.id} product ${row.product_id} [${mode}]: ${msg}`,
      detail: {
        scheduleId: row.id,
        productId: row.product_id,
        ingest_mode: mode,
        stack: e instanceof Error ? e.stack : undefined,
      },
    });
  }
}

async function ingestByMode(
  ctx: JobContext,
  client: StatCanClient,
  row: StatcanProductScheduleRow,
  jobRunId: number,
  latestN: number,
  defaultCoord: string | undefined,
  mode: string,
): Promise<void> {
  switch (mode) {
    case "changed_series":
      await ingestChangedSeries(ctx, client, row, jobRunId);
      return;
    case "changed_cube":
      await ingestChangedCube(ctx, client, row, jobRunId, latestN, defaultCoord);
      return;
    case "bulk_range":
      await ingestBulkRange(ctx, client, row, jobRunId);
      return;
    case "full_table_csv":
      await ingestFullTableCsv(ctx, client, row, jobRunId);
      return;
    case "full_table_sdmx":
      await ingestFullTableSdmx(ctx, client, row, jobRunId);
      return;
    case "latest_n":
    default:
      await ingestLatestN(ctx, client, row, jobRunId, latestN, defaultCoord);
  }
}

async function ingestLatestN(
  ctx: JobContext,
  client: StatCanClient,
  row: StatcanProductScheduleRow,
  jobRunId: number,
  latestN: number,
  defaultCoord: string | undefined,
): Promise<void> {
  if (row.data_vector_id != null) {
    const data = await client.getDataFromVectorsAndLatestNPeriods(
      row.data_vector_id,
      latestN,
    );
    const body = JSON.stringify(data);
    const sha = sha256Hex(body);
    rawPayloadsRepo.insertRawPayload(ctx.db, {
      source: STATCAN_WDS_DATA_SOURCE,
      sourceKey: `schedule:${row.id}:data:vector:${row.data_vector_id}`,
      contentType: "application/json",
      body,
      sha256: sha,
      jobRunId,
    });
    return;
  }
  const coord = row.data_coordinate?.trim() || defaultCoord;
  if (coord) {
    const data = await client.getDataFromCubePidCoordAndLatestNPeriods(
      row.product_id,
      coord,
      latestN,
    );
    const body = JSON.stringify(data);
    const sha = sha256Hex(body);
    rawPayloadsRepo.insertRawPayload(ctx.db, {
      source: STATCAN_WDS_DATA_SOURCE,
      sourceKey: `schedule:${row.id}:data:cube:${row.product_id}:${coord}`,
      contentType: "application/json",
      body,
      sha256: sha,
      jobRunId,
    });
  } else {
    appendOperationalLog(ctx.db, ctx.env, {
      source: "job:statcan-scheduled-ingest",
      level: "warn",
      jobRunId,
      message: `Schedule ${row.id} product ${row.product_id}: fetch_data set but no data_vector_id or coordinate; skipping data`,
      detail: { scheduleId: row.id, productId: row.product_id, ingest_mode: "latest_n" },
    });
  }
}

async function ingestChangedSeries(
  ctx: JobContext,
  client: StatCanClient,
  row: StatcanProductScheduleRow,
  jobRunId: number,
): Promise<void> {
  const raw = await client.getChangedSeriesList();
  const entries = extractChangedSeriesEntries(raw);
  const match = entries.find(
    (e) =>
      e.productId === row.product_id &&
      (row.data_vector_id != null
        ? e.vectorId === row.data_vector_id
        : row.data_coordinate?.trim() === e.coordinate),
  );
  if (!match) {
    appendOperationalLog(ctx.db, ctx.env, {
      source: "job:statcan-scheduled-ingest",
      level: "info",
      jobRunId,
      message: `Schedule ${row.id}: no matching changed series for product ${row.product_id}; skipping data fetch`,
      detail: { scheduleId: row.id, ingest_mode: "changed_series" },
    });
    return;
  }
  let data: unknown;
  if (row.data_vector_id != null) {
    data = await client.getChangedSeriesDataFromVector(row.data_vector_id);
  } else if (row.data_coordinate?.trim()) {
    data = await client.getChangedSeriesDataFromCubePidCoord(
      row.product_id,
      row.data_coordinate.trim(),
    );
  } else {
    throw new Error(
      "changed_series requires data_vector_id or data_coordinate",
    );
  }
  const body = JSON.stringify(data);
  const sha = sha256Hex(body);
  rawPayloadsRepo.insertRawPayload(ctx.db, {
    source: STATCAN_WDS_DATA_SOURCE,
    sourceKey: `schedule:${row.id}:data:changed-series:${row.product_id}`,
    contentType: "application/json",
    body,
    sha256: sha,
    jobRunId,
  });
}

async function ingestChangedCube(
  ctx: JobContext,
  client: StatCanClient,
  row: StatcanProductScheduleRow,
  jobRunId: number,
  latestN: number,
  defaultCoord: string | undefined,
): Promise<void> {
  const isoDate = new Date().toISOString().slice(0, 10);
  const raw = await client.getChangedCubeList(isoDate);
  const ids = extractChangedCubeProductIds(raw);
  if (!ids.has(row.product_id)) {
    appendOperationalLog(ctx.db, ctx.env, {
      source: "job:statcan-scheduled-ingest",
      level: "info",
      jobRunId,
      message: `Schedule ${row.id}: product ${row.product_id} not in changed-cube list for ${isoDate}; skipping data fetch`,
      detail: { scheduleId: row.id, ingest_mode: "changed_cube" },
    });
    return;
  }
  await ingestLatestN(ctx, client, row, jobRunId, latestN, defaultCoord);
}

async function ingestBulkRange(
  ctx: JobContext,
  client: StatCanClient,
  row: StatcanProductScheduleRow,
  jobRunId: number,
): Promise<void> {
  if (row.data_vector_id == null) {
    throw new Error("bulk_range requires data_vector_id");
  }
  const start = row.bulk_release_start?.trim();
  const end = row.bulk_release_end?.trim();
  if (!start || !end) {
    throw new Error(
      "bulk_range requires bulk_release_start and bulk_release_end (ISO release window per WDS getBulkVectorDataByRange)",
    );
  }
  const data = await client.getBulkVectorDataByRange(
    [String(row.data_vector_id)],
    start,
    end,
  );
  const body = JSON.stringify(data);
  const sha = sha256Hex(body);
  rawPayloadsRepo.insertRawPayload(ctx.db, {
    source: STATCAN_WDS_DATA_SOURCE,
    sourceKey: `schedule:${row.id}:data:bulk-range:${row.data_vector_id}`,
    contentType: "application/json",
    body,
    sha256: sha,
    jobRunId,
  });
}

async function ingestFullTableCsv(
  ctx: JobContext,
  client: StatCanClient,
  row: StatcanProductScheduleRow,
  jobRunId: number,
): Promise<void> {
  const csv = await client.getFullTableDownloadCSV(row.product_id, "en");
  const sha = sha256Hex(csv);
  rawPayloadsRepo.insertRawPayload(ctx.db, {
    source: STATCAN_WDS_DATA_SOURCE,
    sourceKey: `schedule:${row.id}:full-table-csv:${row.product_id}:en`,
    contentType: "text/csv",
    body: csv,
    sha256: sha,
    jobRunId,
  });
}

async function ingestFullTableSdmx(
  ctx: JobContext,
  client: StatCanClient,
  row: StatcanProductScheduleRow,
  jobRunId: number,
): Promise<void> {
  const b64 = await client.getFullTableDownloadSDMXBase64(row.product_id);
  const sha = sha256Hex(b64);
  rawPayloadsRepo.insertRawPayload(ctx.db, {
    source: STATCAN_WDS_DATA_SOURCE,
    sourceKey: `schedule:${row.id}:full-table-sdmx:${row.product_id}`,
    contentType: "application/octet-stream",
    body: b64,
    sha256: sha,
    jobRunId,
  });
}
