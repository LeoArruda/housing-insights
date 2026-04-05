import * as jobRunsRepo from "../db/repositories/job-runs.ts";
import { appendOperationalLog } from "../logging/operational.ts";
import {
  insertBatchWithObservations,
  insertNormalizeError,
  listPendingStatcanWdsDataPayloads,
} from "../db/repositories/statcan-wds-normalization.ts";
import { parseStatcanWdsDataBody } from "../services/statcan-wds-data-parse.ts";
import type { JobContext } from "./runners.ts";

export const STATCAN_WDS_DATA_NORMALIZE_JOB = "statcan-wds-data-normalize" as const;

function isRawPayloadIdUniqueViolation(message: string): boolean {
  return (
    message.includes("UNIQUE constraint failed") &&
    message.includes("statcan_wds_data_batch.raw_payload_id")
  );
}

export async function jobStatcanWdsDataNormalize(
  ctx: JobContext,
): Promise<void> {
  const runId = jobRunsRepo.insertJobRun(ctx.db, STATCAN_WDS_DATA_NORMALIZE_JOB);
  const limit = ctx.env.STATCAN_WDS_NORMALIZE_BATCH_LIMIT;
  let ok = 0;
  let err = 0;
  let skippedRace = 0;

  appendOperationalLog(ctx.db, ctx.env, {
    source: `job:${STATCAN_WDS_DATA_NORMALIZE_JOB}`,
    level: "info",
    jobRunId: runId,
    message: "Job started",
  });

  try {
    const pending = listPendingStatcanWdsDataPayloads(ctx.db, limit);

    for (const row of pending) {
      const parsed = parseStatcanWdsDataBody(row.body);
      if (!parsed.ok) {
        insertNormalizeError(ctx.db, row.id, parsed.error);
        err += 1;
        continue;
      }

      const d = parsed.data;
      const vectorId = d.vectorId ?? null;
      const coordinate = d.coordinate ?? null;

      try {
        insertBatchWithObservations(ctx.db, {
          rawPayloadId: row.id,
          productId: d.productId,
          vectorId,
          coordinate,
          points: d.vectorDataPoint.map((p) => ({
            refPer: p.refPer,
            value: p.value,
            decimals: p.decimals,
          })),
        });
        ok += 1;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (isRawPayloadIdUniqueViolation(msg)) {
          skippedRace += 1;
          continue;
        }
        insertNormalizeError(ctx.db, row.id, msg);
        err += 1;
      }
    }

    jobRunsRepo.finishJobRun(ctx.db, runId, "success", null);
    appendOperationalLog(ctx.db, ctx.env, {
      source: `job:${STATCAN_WDS_DATA_NORMALIZE_JOB}`,
      level: "info",
      jobRunId: runId,
      message: `Normalize batch complete: scanned=${pending.length} ok=${ok} err=${err} skipped_race=${skippedRace}`,
      detail: {
        scanned: pending.length,
        ok,
        err,
        skippedRace,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    jobRunsRepo.finishJobRun(ctx.db, runId, "failed", msg);
    appendOperationalLog(ctx.db, ctx.env, {
      source: `job:${STATCAN_WDS_DATA_NORMALIZE_JOB}`,
      level: "error",
      jobRunId: runId,
      message: msg,
      detail: { stack: e instanceof Error ? e.stack : undefined },
    });
    throw e;
  }
}
