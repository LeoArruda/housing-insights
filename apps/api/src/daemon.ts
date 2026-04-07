#!/usr/bin/env bun
import { Cron } from "croner";
import { openDatabase } from "./db/database.ts";
import { migrationsDirectory, runMigrations } from "./db/migrate.ts";
import { loadEnv } from "./env.ts";
import { runJobByName } from "./jobs/registry.ts";
import type { JobContext } from "./jobs/runners.ts";
import {
  appendOperationalLog,
  pruneOperationalLogsByRetention,
} from "./logging/operational.ts";

function schedule(
  env: ReturnType<typeof loadEnv>,
  db: ReturnType<typeof openDatabase>,
  expression: string,
  label: string,
  run: () => Promise<void>,
): Cron {
  return new Cron(expression, () => {
    void run().catch((e) => {
      console.error(`[daemon] ${label} error:`, e);
      const msg = e instanceof Error ? e.message : String(e);
      appendOperationalLog(db, env, {
        source: "daemon",
        level: "error",
        message: `[daemon] ${label}: ${msg}`,
        detail: {
          label,
          stack: e instanceof Error ? e.stack : undefined,
        },
      });
    });
  });
}

const env = loadEnv();
const db = openDatabase(env.DATABASE_PATH);
runMigrations(db, migrationsDirectory());

const ctx: JobContext = { db, env };

schedule(env, db, env.DAEMON_STATCAN_RSS_CRON, "statcan-rss", () =>
  runJobByName(ctx, "statcan-rss"),
);
schedule(env, db, env.DAEMON_BOC_RSS_CRON, "boc-rss", () =>
  runJobByName(ctx, "boc-rss"),
);
schedule(env, db, env.DAEMON_STATCAN_CATALOG_CRON, "statcan-catalog-index", () =>
  runJobByName(ctx, "statcan-catalog-index"),
);
schedule(env, db, env.DAEMON_STATCAN_WDS_METADATA_CRON, "statcan-wds-metadata", () =>
  runJobByName(ctx, "statcan-wds-metadata"),
);
schedule(env, db, env.DAEMON_STATCAN_WDS_DATA_CRON, "statcan-wds-data", () =>
  runJobByName(ctx, "statcan-wds-data"),
);
schedule(
  env,
  db,
  env.DAEMON_STATCAN_SCHEDULE_TICK_CRON,
  "statcan-scheduled-ingest",
  () => runJobByName(ctx, "statcan-scheduled-ingest"),
);
const bulkTrackedCron = env.DAEMON_STATCAN_BULK_TRACKED_CRON?.trim();
if (bulkTrackedCron) {
  schedule(env, db, bulkTrackedCron, "statcan-bulk-tracked-sync", () =>
    runJobByName(ctx, "statcan-bulk-tracked-sync"),
  );
}
schedule(env, db, env.DAEMON_BOC_VALET_CRON, "boc-valet", () =>
  runJobByName(ctx, "boc-valet"),
);

const normalizeCron = env.DAEMON_STATCAN_WDS_DATA_NORMALIZE_CRON?.trim();
if (normalizeCron) {
  schedule(env, db, normalizeCron, "statcan-wds-data-normalize", () =>
    runJobByName(ctx, "statcan-wds-data-normalize"),
  );
}

const pruneCron = env.DAEMON_OPERATIONS_LOG_PRUNE_CRON?.trim();
if (pruneCron) {
  schedule(env, db, pruneCron, "operations-log-prune", async () => {
    try {
      const n = pruneOperationalLogsByRetention(db, env);
      if (n > 0) {
        appendOperationalLog(db, env, {
          source: "daemon",
          level: "info",
          message: `Operational log prune removed ${n} row(s)`,
          detail: { retentionDays: env.OPERATIONS_LOG_RETENTION_DAYS },
        });
      }
    } catch (e) {
      console.error("[daemon] operations-log-prune error:", e);
      appendOperationalLog(db, env, {
        source: "daemon",
        level: "error",
        message: `operations-log-prune failed: ${e instanceof Error ? e.message : String(e)}`,
        detail: { stack: e instanceof Error ? e.stack : undefined },
      });
    }
  });
}

console.info(
  `Daemon started (database: ${env.DATABASE_PATH}). Cron jobs registered.`,
);

await new Promise(() => {});
