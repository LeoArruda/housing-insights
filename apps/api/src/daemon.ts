#!/usr/bin/env bun
import { Cron } from "croner";
import { openDatabase } from "./db/database.ts";
import { migrationsDirectory, runMigrations } from "./db/migrate.ts";
import { loadEnv } from "./env.ts";
import { runJobByName } from "./jobs/registry.ts";
import type { JobContext } from "./jobs/runners.ts";

function schedule(
  expression: string,
  label: string,
  run: () => Promise<void>,
): Cron {
  return new Cron(expression, () => {
    void run().catch((e) => {
      console.error(`[daemon] ${label} error:`, e);
    });
  });
}

const env = loadEnv();
const db = openDatabase(env.DATABASE_PATH);
runMigrations(db, migrationsDirectory());

const ctx: JobContext = { db, env };

schedule(env.DAEMON_STATCAN_RSS_CRON, "statcan-rss", () =>
  runJobByName(ctx, "statcan-rss"),
);
schedule(env.DAEMON_BOC_RSS_CRON, "boc-rss", () =>
  runJobByName(ctx, "boc-rss"),
);
schedule(env.DAEMON_STATCAN_CATALOG_CRON, "statcan-catalog-index", () =>
  runJobByName(ctx, "statcan-catalog-index"),
);
schedule(env.DAEMON_STATCAN_WDS_METADATA_CRON, "statcan-wds-metadata", () =>
  runJobByName(ctx, "statcan-wds-metadata"),
);
schedule(env.DAEMON_STATCAN_WDS_DATA_CRON, "statcan-wds-data", () =>
  runJobByName(ctx, "statcan-wds-data"),
);
schedule(
  env.DAEMON_STATCAN_SCHEDULE_TICK_CRON,
  "statcan-scheduled-ingest",
  () => runJobByName(ctx, "statcan-scheduled-ingest"),
);
schedule(env.DAEMON_BOC_VALET_CRON, "boc-valet", () =>
  runJobByName(ctx, "boc-valet"),
);

const normalizeCron = env.DAEMON_STATCAN_WDS_DATA_NORMALIZE_CRON?.trim();
if (normalizeCron) {
  schedule(normalizeCron, "statcan-wds-data-normalize", () =>
    runJobByName(ctx, "statcan-wds-data-normalize"),
  );
}

console.info(
  `Daemon started (database: ${env.DATABASE_PATH}). Cron jobs registered.`,
);

await new Promise(() => {});
