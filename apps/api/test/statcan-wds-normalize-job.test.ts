import { describe, expect, it } from "bun:test";
import { readFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { openDatabase } from "../src/db/database.ts";
import { migrationsDirectory, runMigrations } from "../src/db/migrate.ts";
import { loadEnv } from "../src/env.ts";
import * as normRepo from "../src/db/repositories/statcan-wds-normalization.ts";
import { jobStatcanWdsDataNormalize } from "../src/jobs/statcan-wds-normalize.ts";
import type { JobContext } from "../src/jobs/runners.ts";
import { sha256Hex } from "../src/util/hash.ts";

const tmpDb = join(import.meta.dir, "_test_wds_normalize.sqlite");
const fixtureDir = join(import.meta.dir, "fixtures");

describe("statcan-wds-data-normalize job", () => {
  it("normalizes pending raw_payload into batch + observations; idempotent second run", async () => {
    try {
      unlinkSync(tmpDb);
    } catch {
      /* ignore */
    }
    const env = loadEnv({ DATABASE_PATH: tmpDb });
    const db = openDatabase(env.DATABASE_PATH);
    runMigrations(db, migrationsDirectory());

    const body = readFileSync(
      join(fixtureDir, "wds-vector-data-response.json"),
      "utf-8",
    );
    const sha = sha256Hex(body);
    db.run(
      `INSERT INTO raw_payloads (source, source_key, fetched_at, content_type, body, sha256, job_run_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        normRepo.STATCAN_WDS_DATA_SOURCE,
        "data:vector:32164132",
        new Date().toISOString(),
        "application/json",
        body,
        sha,
        null,
      ],
    );

    const ctx: JobContext = { db, env };
    await jobStatcanWdsDataNormalize(ctx);

    const batchCount = db
      .query("SELECT COUNT(*) AS c FROM statcan_wds_data_batch")
      .get() as { c: number };
    expect(batchCount.c).toBe(1);

    const obsCount = db
      .query("SELECT COUNT(*) AS c FROM statcan_wds_data_observation")
      .get() as { c: number };
    expect(obsCount.c).toBe(1);

    const errCount = db
      .query("SELECT COUNT(*) AS c FROM statcan_wds_normalize_error")
      .get() as { c: number };
    expect(errCount.c).toBe(0);

    await jobStatcanWdsDataNormalize(ctx);
    const batchCount2 = db
      .query("SELECT COUNT(*) AS c FROM statcan_wds_data_batch")
      .get() as { c: number };
    expect(batchCount2.c).toBe(1);

    db.close();
    try {
      unlinkSync(tmpDb);
    } catch {
      /* ignore */
    }
  });

  it("records normalize_error for bad body", async () => {
    try {
      unlinkSync(tmpDb);
    } catch {
      /* ignore */
    }
    const env = loadEnv({ DATABASE_PATH: tmpDb });
    const db = openDatabase(env.DATABASE_PATH);
    runMigrations(db, migrationsDirectory());

    const body = "{not valid";
    const sha = sha256Hex(body);
    db.run(
      `INSERT INTO raw_payloads (source, source_key, fetched_at, content_type, body, sha256, job_run_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        normRepo.STATCAN_WDS_DATA_SOURCE,
        "bad:1",
        new Date().toISOString(),
        "application/json",
        body,
        sha,
        null,
      ],
    );

    const ctx: JobContext = { db, env };
    await jobStatcanWdsDataNormalize(ctx);

    const batchCount = db
      .query("SELECT COUNT(*) AS c FROM statcan_wds_data_batch")
      .get() as { c: number };
    expect(batchCount.c).toBe(0);

    const errCount = db
      .query("SELECT COUNT(*) AS c FROM statcan_wds_normalize_error")
      .get() as { c: number };
    expect(errCount.c).toBeGreaterThanOrEqual(1);

    db.close();
    try {
      unlinkSync(tmpDb);
    } catch {
      /* ignore */
    }
  });
});
