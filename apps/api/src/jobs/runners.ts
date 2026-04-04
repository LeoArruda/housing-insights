import type { Database } from "bun:sqlite";
import type { FetchFn } from "../connectors/fetch-types.ts";
import { fetchBocRss, BOC_RSS_SOURCE } from "../connectors/boc-rss.ts";
import { fetchBocValetExemplar, BOC_VALET_SOURCE } from "../connectors/boc-valet.ts";
import { fetchStatcanRss, STATCAN_RSS_SOURCE } from "../connectors/statcan-rss.ts";
import {
  fetchStatcanWdsExemplar,
  STATCAN_WDS_SOURCE,
} from "../connectors/statcan-wds.ts";
import * as jobRunsRepo from "../db/repositories/job-runs.ts";
import * as rawPayloadsRepo from "../db/repositories/raw-payloads.ts";
import type { Env } from "../env.ts";
import { sha256Hex } from "../util/hash.ts";

export type JobContext = {
  db: Database;
  env: Env;
  fetchImpl?: FetchFn;
};

async function runIngestJob(
  ctx: JobContext,
  jobName: string,
  source: string,
  load: () => Promise<{ body: string; contentType: string; sourceKey: string }>,
): Promise<void> {
  const runId = jobRunsRepo.insertJobRun(ctx.db, jobName);
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
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    jobRunsRepo.finishJobRun(ctx.db, runId, "failed", msg);
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

export async function jobStatcanWds(ctx: JobContext): Promise<void> {
  await runIngestJob(ctx, "statcan-wds", STATCAN_WDS_SOURCE, () =>
    fetchStatcanWdsExemplar(ctx.env, ctx.fetchImpl),
  );
}

export async function jobBocValet(ctx: JobContext): Promise<void> {
  await runIngestJob(ctx, "boc-valet", BOC_VALET_SOURCE, () =>
    fetchBocValetExemplar(ctx.env, ctx.fetchImpl),
  );
}
