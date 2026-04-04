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

const tmpDb = join(import.meta.dir, "_test_runners.sqlite");
const fixtureDir = join(import.meta.dir, "fixtures");
const keywordsPath = join(import.meta.dir, "../config/statcan-keywords.json");

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

  it("runs statcan-catalog-index from fixture catalog", async () => {
    const path = tmpDb + "_cat";
    const env = loadEnv({
      DATABASE_PATH: path,
      STATCAN_CATALOG_PATH: join(fixtureDir, "catalog-small.json"),
      STATCAN_CATALOG_FROM_API: "false",
      STATCAN_KEYWORDS_PATH: keywordsPath,
      STATCAN_MIN_KEYWORD_SCORE: "1",
    });
    const db = openDatabase(env.DATABASE_PATH);
    runMigrations(db, migrationsDirectory());
    const ctx: JobContext = { db, env };
    await runJobByName(ctx, "statcan-catalog-index");

    const runs = db
      .query(
        "SELECT status FROM job_runs WHERE job_name = ? ORDER BY id DESC LIMIT 1",
      )
      .get("statcan-catalog-index") as { status: string };
    expect(runs.status).toBe("success");

    const n = db
      .query("SELECT COUNT(*) as c FROM statcan_cube_catalog")
      .get() as { c: number };
    expect(n.c).toBeGreaterThanOrEqual(1);
    db.close();
    try {
      unlinkSync(path);
    } catch {
      /* ignore */
    }
  });

  it("runs statcan-wds-metadata with mocked WDS POST", async () => {
    const path = tmpDb + "_meta";
    const metaBody = readFileSync(
      join(fixtureDir, "wds-metadata-response.json"),
      "utf-8",
    );
    const fetchImpl: FetchFn = async (url) => {
      if (url === wdsPaths.getCubeMetadata) {
        return new Response(metaBody, {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response("not found", { status: 404 });
    };
    const env = loadEnv({
      DATABASE_PATH: path,
      STATCAN_INGEST_MODE: "explicit",
      STATCAN_PRODUCT_IDS: "34100135",
    });
    const db = openDatabase(env.DATABASE_PATH);
    runMigrations(db, migrationsDirectory());
    const ctx: JobContext = { db, env, fetchImpl };
    await runJobByName(ctx, "statcan-wds-metadata");

    const runs = db
      .query(
        "SELECT status FROM job_runs WHERE job_name = ? ORDER BY id DESC LIMIT 1",
      )
      .get("statcan-wds-metadata") as { status: string };
    expect(runs.status).toBe("success");

    const raw = db
      .query(
        `SELECT COUNT(*) as c FROM raw_payloads WHERE source = ? AND source_key LIKE ?`,
      )
      .get("statcan-wds-metadata", "metadata:%") as { c: number };
    expect(raw.c).toBeGreaterThanOrEqual(1);
    db.close();
    try {
      unlinkSync(path);
    } catch {
      /* ignore */
    }
  });
});
