import { StatCanClient } from "../connectors/statcan/statcan-client.ts";
import * as rawPayloadsRepo from "../db/repositories/raw-payloads.ts";
import * as jobRunsRepo from "../db/repositories/job-runs.ts";
import * as schedulesRepo from "../db/repositories/statcan-product-schedules.ts";
import type { StatcanProductScheduleRow } from "../db/repositories/statcan-product-schedules.ts";
import {
  computeNextRunAfter,
  type ScheduleFrequency,
} from "../services/statcan-next-run.ts";
import { sha256Hex } from "../util/hash.ts";
import type { JobContext } from "./runners.ts";

/** Align with raw_payloads.source values used by global StatCan jobs. */
const STATCAN_WDS_METADATA_SOURCE = "statcan-wds-metadata" as const;
const STATCAN_WDS_DATA_SOURCE = "statcan-wds-data" as const;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function jobStatcanScheduledIngest(ctx: JobContext): Promise<void> {
  const runId = jobRunsRepo.insertJobRun(ctx.db, "statcan-scheduled-ingest");
  const nowIso = new Date().toISOString();
  const due = schedulesRepo.listDueSchedules(ctx.db, nowIso);

  if (due.length === 0) {
    jobRunsRepo.finishJobRun(ctx.db, runId, "success", null);
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
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    jobRunsRepo.finishJobRun(ctx.db, runId, "failed", msg);
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

  try {
    if (row.fetch_metadata) {
      const data = await client.getCubeMetadata(row.product_id);
      const body = JSON.stringify(data);
      const sha = sha256Hex(body);
      rawPayloadsRepo.insertRawPayload(ctx.db, {
        source: STATCAN_WDS_METADATA_SOURCE,
        sourceKey: `schedule:${row.id}:metadata:${row.product_id}`,
        contentType: "application/json",
        body,
        sha256: sha,
        jobRunId,
      });
    }

    if (row.fetch_data) {
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
      } else {
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
          console.warn(
            `[statcan-scheduled-ingest] schedule ${row.id} product ${row.product_id}: fetch_data set but no data_vector_id or coordinate; skipping data`,
          );
        }
      }
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
    console.error(
      `[statcan-scheduled-ingest] schedule ${row.id} product ${row.product_id}:`,
      msg,
    );
  }
}
