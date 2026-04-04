import { afterAll, describe, expect, it } from "bun:test";
import { readFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import type { FetchFn } from "../src/connectors/fetch-types.ts";
import { wdsPaths } from "../src/connectors/statcan/wds-routes.ts";
import { openDatabase } from "../src/db/database.ts";
import { migrationsDirectory, runMigrations } from "../src/db/migrate.ts";
import { loadEnv } from "../src/env.ts";
import { runJobByName } from "../src/jobs/registry.ts";
import type { JobContext } from "../src/jobs/runners.ts";

const tmpDb = join(import.meta.dir, "_test_statcan_scheduled.sqlite");
const fixtureDir = join(import.meta.dir, "fixtures");

describe("statcan-scheduled-ingest", () => {
  afterAll(() => {
    try {
      unlinkSync(tmpDb);
    } catch {
      /* ignore */
    }
  });

  it("processes due schedule with mocked WDS vector fetch", async () => {
    const vectorBody = readFileSync(
      join(fixtureDir, "wds-vector-data-response.json"),
      "utf-8",
    );
    const fetchImpl: FetchFn = async (url) => {
      if (url === wdsPaths.getDataFromVectorsAndLatestNPeriods) {
        return new Response(vectorBody, {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response("unexpected", { status: 500 });
    };

    const env = loadEnv({
      DATABASE_PATH: tmpDb,
      STATCAN_REQUEST_DELAY_MS: "0",
    });
    const db = openDatabase(env.DATABASE_PATH);
    runMigrations(db, migrationsDirectory());
    db.run(`DELETE FROM statcan_product_schedules`);
    db.run(
      `INSERT INTO statcan_product_schedules (
        product_id, frequency, hour_utc, minute_utc, day_of_week, day_of_month,
        latest_n, data_coordinate, data_vector_id, fetch_metadata, fetch_data,
        enabled, next_run_at, created_at, updated_at
      ) VALUES (?, 'daily', 6, 0, NULL, NULL, 3, NULL, ?, 0, 1, 1, ?, datetime('now'), datetime('now'))`,
      [99_999_999, 32_164_132, "2000-01-01T00:00:00.000Z"],
    );

    const ctx: JobContext = { db, env, fetchImpl };
    await runJobByName(ctx, "statcan-scheduled-ingest");

    const runs = db
      .query(
        `SELECT status FROM job_runs WHERE job_name = ? ORDER BY id DESC LIMIT 1`,
      )
      .get("statcan-scheduled-ingest") as { status: string };
    expect(runs.status).toBe("success");

    const raw = db
      .query(
        `SELECT COUNT(*) as c FROM raw_payloads WHERE source = ? AND source_key LIKE ?`,
      )
      .get("statcan-wds-data", "schedule:%:data:vector:%") as { c: number };
    expect(raw.c).toBe(1);

    const row = db
      .query(
        `SELECT next_run_at, last_error FROM statcan_product_schedules WHERE product_id = ?`,
      )
      .get(99_999_999) as { next_run_at: string; last_error: string | null };
    expect(row.last_error).toBeNull();
    expect(new Date(row.next_run_at).getTime()).toBeGreaterThan(
      Date.parse("2000-01-01T00:00:00.000Z"),
    );

    db.close();
  });
});
