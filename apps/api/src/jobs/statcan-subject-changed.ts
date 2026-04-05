import { StatCanClient } from "../connectors/statcan/statcan-client.ts";
import { extractChangedCubeProductIds } from "../connectors/statcan/wds-changed-parse.ts";
import * as catalogRepo from "../db/repositories/statcan-catalog.ts";
import * as rawPayloadsRepo from "../db/repositories/raw-payloads.ts";
import * as jobRunsRepo from "../db/repositories/job-runs.ts";
import * as subscriptionsRepo from "../db/repositories/statcan-subject-subscriptions.ts";
import { appendOperationalLog } from "../logging/operational.ts";
import { sha256Hex } from "../util/hash.ts";
import type { JobContext } from "./runners.ts";

const SOURCE_METADATA = "statcan-wds-metadata" as const;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * For each enabled global subject subscription, intersect StatCan “changed cubes today”
 * with catalog rows whose `subject_codes` match; store cube metadata for each hit (raw-first).
 */
export async function jobStatcanSubjectChangedIngest(
  ctx: JobContext,
): Promise<void> {
  const runId = jobRunsRepo.insertJobRun(ctx.db, "statcan-subject-changed-ingest");
  appendOperationalLog(ctx.db, ctx.env, {
    source: "job:statcan-subject-changed-ingest",
    level: "info",
    jobRunId: runId,
    message: "Job started",
  });

  const subs = subscriptionsRepo.listEnabledSubscriptions(ctx.db);
  if (subs.length === 0) {
    jobRunsRepo.finishJobRun(ctx.db, runId, "success", null);
    appendOperationalLog(ctx.db, ctx.env, {
      source: "job:statcan-subject-changed-ingest",
      level: "info",
      jobRunId: runId,
      message: "No enabled subject subscriptions",
    });
    return;
  }

  const client = StatCanClient.fromEnv(ctx.env, ctx.fetchImpl);
  const delay = ctx.env.STATCAN_REQUEST_DELAY_MS;
  const isoDate = new Date().toISOString().slice(0, 10);

  try {
    await sleep(delay);
    const changedRaw = await client.getChangedCubeList(isoDate);
    const changedIds = extractChangedCubeProductIds(changedRaw);

    let stored = 0;
    for (const sub of subs) {
      const candidates = catalogRepo.listProductIdsForSubjectCode(
        ctx.db,
        sub.subject_code,
      );
      const hits = candidates.filter((pid) => changedIds.has(pid));
      for (const productId of hits) {
        await sleep(delay);
        const data = await client.getCubeMetadata(productId);
        const body = JSON.stringify(data);
        const sha = sha256Hex(body);
        const inserted = rawPayloadsRepo.insertRawPayload(ctx.db, {
          source: SOURCE_METADATA,
          sourceKey: `subject:${sub.id}:changed-cube:${isoDate}:${productId}`,
          contentType: "application/json",
          body,
          sha256: sha,
          jobRunId: runId,
        });
        if (inserted) stored += 1;
      }
    }

    jobRunsRepo.finishJobRun(ctx.db, runId, "success", null);
    appendOperationalLog(ctx.db, ctx.env, {
      source: "job:statcan-subject-changed-ingest",
      level: "info",
      jobRunId: runId,
      message: `Processed subscriptions; stored ${stored} new metadata payload(s)`,
      detail: { subscriptionCount: subs.length, changedCubeCandidates: changedIds.size },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    jobRunsRepo.finishJobRun(ctx.db, runId, "failed", msg);
    appendOperationalLog(ctx.db, ctx.env, {
      source: "job:statcan-subject-changed-ingest",
      level: "error",
      jobRunId: runId,
      message: msg,
      detail: { stack: e instanceof Error ? e.stack : undefined },
    });
    throw e;
  }
}
