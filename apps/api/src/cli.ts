#!/usr/bin/env bun
import { openDatabase } from "./db/database.ts";
import { migrationsDirectory, runMigrations } from "./db/migrate.ts";
import { loadEnv } from "./env.ts";
import {
  isJobName,
  JOB_NAMES,
  runJobByName,
} from "./jobs/registry.ts";
import type { JobContext } from "./jobs/runners.ts";

function printHelp(): void {
  console.log(`housing-insights api CLI

Usage:
  bun run src/cli.ts migrate
  bun run src/cli.ts job list
  bun run src/cli.ts job run <name>
  bun run src/cli.ts job run-all

Jobs: ${JOB_NAMES.join(", ")}
`);
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const [cmd, sub, ...rest] = argv;

  if (!cmd || cmd === "help" || cmd === "--help") {
    printHelp();
    process.exit(0);
  }

  if (cmd === "migrate") {
    const env = loadEnv();
    const db = openDatabase(env.DATABASE_PATH);
    runMigrations(db, migrationsDirectory());
    console.info("Migrations applied.");
    db.close();
    return;
  }

  if (cmd === "job") {
    const env = loadEnv();
    const db = openDatabase(env.DATABASE_PATH);
    runMigrations(db, migrationsDirectory());
    const ctx: JobContext = { db, env };

    if (sub === "list") {
      for (const name of JOB_NAMES) {
        console.log(name);
      }
      db.close();
      return;
    }

    if (sub === "run") {
      const name = rest[0];
      if (!name || !isJobName(name)) {
        console.error("Expected job name:", JOB_NAMES.join(", "));
        process.exit(1);
      }
      try {
        await runJobByName(ctx, name);
        console.info(`Job ${name} completed.`);
        db.close();
      } catch {
        db.close();
        process.exit(1);
      }
      return;
    }

    if (sub === "run-all") {
      let failed = false;
      for (const name of JOB_NAMES) {
        try {
          await runJobByName(ctx, name);
          console.info(`Job ${name} completed.`);
        } catch {
          failed = true;
          console.error(`Job ${name} failed.`);
        }
      }
      db.close();
      process.exit(failed ? 1 : 0);
    }
  }

  printHelp();
  process.exit(1);
}

await main();
