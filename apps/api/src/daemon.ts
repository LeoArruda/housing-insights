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
schedule(env.DAEMON_STATCAN_WDS_CRON, "statcan-wds", () =>
  runJobByName(ctx, "statcan-wds"),
);
schedule(env.DAEMON_BOC_VALET_CRON, "boc-valet", () =>
  runJobByName(ctx, "boc-valet"),
);

console.info(
  `Daemon started (database: ${env.DATABASE_PATH}). Cron jobs registered.`,
);

await new Promise(() => {});
