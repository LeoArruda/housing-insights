import { afterAll, describe, expect, it } from "bun:test";
import { readFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import type { FetchFn } from "../src/connectors/fetch-types.ts";
import { openDatabase } from "../src/db/database.ts";
import { migrationsDirectory, runMigrations } from "../src/db/migrate.ts";
import { loadEnv } from "../src/env.ts";
import { runJobByName } from "../src/jobs/registry.ts";
import type { JobContext } from "../src/jobs/runners.ts";

const tmpDb = join(import.meta.dir, "_test_runners.sqlite");
const fixtureDir = join(import.meta.dir, "fixtures");

function mockFetchFromFile(path: string, contentType: string): FetchFn {
  const body = readFileSync(path, "utf-8");
  return async () =>
    new Response(body, {
      status: 200,
      headers: { "content-type": contentType },
    });
}

describe("job runners (fixture fetch)", () => {
  afterAll(() => {
    try {
      unlinkSync(tmpDb);
    } catch {
      /* ignore */
    }
  });

  it("runs statcan-rss job with mocked RSS body", async () => {
    const env = loadEnv({ DATABASE_PATH: tmpDb });
    const db = openDatabase(env.DATABASE_PATH);
    runMigrations(db, migrationsDirectory());
    const ctx: JobContext = {
      db,
      env,
      fetchImpl: mockFetchFromFile(
        join(fixtureDir, "sample-rss.xml"),
        "application/xml",
      ),
    };
    await runJobByName(ctx, "statcan-rss");

    const runs = db
      .query(
        "SELECT status FROM job_runs WHERE job_name = ? ORDER BY id DESC LIMIT 1",
      )
      .get("statcan-rss") as { status: string };
    expect(runs.status).toBe("success");

    const raw = db
      .query("SELECT COUNT(*) as c FROM raw_payloads WHERE source = ?")
      .get("statcan-rss") as { c: number };
    expect(raw.c).toBeGreaterThanOrEqual(1);
    db.close();
  });

  it("runs boc-valet job with mocked JSON", async () => {
    const env = loadEnv({ DATABASE_PATH: tmpDb + "_valet" });
    const db = openDatabase(env.DATABASE_PATH);
    runMigrations(db, migrationsDirectory());
    const ctx: JobContext = {
      db,
      env,
      fetchImpl: mockFetchFromFile(
        join(fixtureDir, "boc-valet-sample.json"),
        "application/json",
      ),
    };
    await runJobByName(ctx, "boc-valet");
    const runs = db
      .query(
        "SELECT status FROM job_runs WHERE job_name = ? ORDER BY id DESC LIMIT 1",
      )
      .get("boc-valet") as { status: string };
    expect(runs.status).toBe("success");
    db.close();
    try {
      unlinkSync(tmpDb + "_valet");
    } catch {
      /* ignore */
    }
  });

  it("runs statcan-wds job with mocked JSON", async () => {
    const path = tmpDb + "_wds";
    const env = loadEnv({ DATABASE_PATH: path });
    const db = openDatabase(env.DATABASE_PATH);
    runMigrations(db, migrationsDirectory());
    const ctx: JobContext = {
      db,
      env,
      fetchImpl: mockFetchFromFile(
        join(fixtureDir, "statcan-wds-sample.json"),
        "application/json",
      ),
    };
    await runJobByName(ctx, "statcan-wds");
    const runs = db
      .query(
        "SELECT status FROM job_runs WHERE job_name = ? ORDER BY id DESC LIMIT 1",
      )
      .get("statcan-wds") as { status: string };
    expect(runs.status).toBe("success");
    db.close();
    try {
      unlinkSync(path);
    } catch {
      /* ignore */
    }
  });
});
