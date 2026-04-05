import { afterAll, describe, expect, it } from "bun:test";
import { unlinkSync } from "node:fs";
import { join } from "node:path";
import { readFileSync } from "node:fs";
import { openDatabase } from "../src/db/database.ts";
import { migrationsDirectory, runMigrations } from "../src/db/migrate.ts";
import * as normRepo from "../src/db/repositories/statcan-wds-normalization.ts";
import { loadEnv } from "../src/env.ts";
import { runJobByName } from "../src/jobs/registry.ts";
import type { JobContext } from "../src/jobs/runners.ts";
import { createApp } from "../src/server/app.ts";
import { sha256Hex } from "../src/util/hash.ts";

const tmpDb = join(import.meta.dir, "_test_server.sqlite");
const fixtureDir = join(import.meta.dir, "fixtures");

function baseEnv(overrides: Record<string, string | undefined> = {}) {
  return loadEnv({
    DATABASE_PATH: tmpDb,
    PORT: "0",
    HOST: "127.0.0.1",
    ...overrides,
  });
}

describe("read API", () => {
  afterAll(() => {
    try {
      unlinkSync(tmpDb);
    } catch {
      /* ignore */
    }
  });

  it("returns health and job-runs", async () => {
    const env = baseEnv();
    const db = openDatabase(env.DATABASE_PATH);
    runMigrations(db, migrationsDirectory());
    db.run(
      `INSERT INTO job_runs (job_name, started_at, finished_at, status, error_message) VALUES (?, ?, ?, ?, ?)`,
      [
        "statcan-rss",
        new Date().toISOString(),
        new Date().toISOString(),
        "success",
        null,
      ],
    );

    const app = createApp(db, env);
    const h = await app.request("/health");
    expect(h.status).toBe(200);

    const r = await app.request("/health/ready");
    expect(r.status).toBe(200);

    const jr = await app.request("/job-runs?limit=10");
    expect(jr.status).toBe(200);
    const body = (await jr.json()) as { data: unknown[] };
    expect(body.data.length).toBeGreaterThanOrEqual(1);

    const sched = await app.request("/statcan/schedules");
    expect(sched.status).toBe(200);
    const schedBody = (await sched.json()) as { data: unknown[] };
    expect(Array.isArray(schedBody.data)).toBe(true);

    db.close();
  });

  it("GET /stats/summary returns aggregates", async () => {
    const env = baseEnv();
    const db = openDatabase(env.DATABASE_PATH);
    runMigrations(db, migrationsDirectory());
    const now = new Date().toISOString();
    db.run(
      `INSERT INTO job_runs (job_name, started_at, finished_at, status, error_message) VALUES (?, ?, ?, ?, ?)`,
      ["j1", now, now, "success", null],
    );
    db.run(
      `INSERT INTO job_runs (job_name, started_at, finished_at, status, error_message) VALUES (?, ?, ?, ?, ?)`,
      ["j2", now, now, "failed", "boom"],
    );
    const app = createApp(db, env);
    const res = await app.request("/stats/summary");
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      window_utc_hours: number;
      job_runs_finished_last_window: { success: number; failed: number };
      recent_failed_runs: { id: number }[];
      schedules: { total: number; enabled: number; with_last_error: number };
    };
    expect(json.window_utc_hours).toBe(24);
    expect(json.job_runs_finished_last_window.success).toBeGreaterThanOrEqual(1);
    expect(json.job_runs_finished_last_window.failed).toBeGreaterThanOrEqual(1);
    expect(json.recent_failed_runs.length).toBeGreaterThanOrEqual(1);
    expect(json.schedules.total).toBeGreaterThanOrEqual(1);
    expect(json.schedules.enabled).toBeGreaterThanOrEqual(0);
    db.close();
  });

  it("GET /operations/logs filters by job_run_id and q", async () => {
    const env = baseEnv();
    const db = openDatabase(env.DATABASE_PATH);
    runMigrations(db, migrationsDirectory());
    db.run(
      `INSERT INTO job_runs (job_name, started_at, finished_at, status, error_message) VALUES (?, ?, ?, ?, ?)`,
      ["statcan-rss", new Date().toISOString(), new Date().toISOString(), "success", null],
    );
    const jrId = Number(
      (db.query(`SELECT id FROM job_runs ORDER BY id DESC LIMIT 1`).get() as { id: number })
        .id,
    );
    const t = new Date().toISOString();
    db.run(
      `INSERT INTO operation_logs (occurred_at, level, source, job_run_id, message, detail, correlation_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [t, "info", "job:statcan-rss", jrId, "Job completed successfully", null, null],
    );
    db.run(
      `INSERT INTO operation_logs (occurred_at, level, source, job_run_id, message, detail, correlation_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [t, "warn", "cli", null, "other message", null, null],
    );
    const app = createApp(db, env);
    const byJob = await app.request(`/operations/logs?job_run_id=${jrId}`);
    expect(byJob.status).toBe(200);
    const j1 = (await byJob.json()) as { data: { message: string }[] };
    expect(j1.data.length).toBe(1);
    expect(j1.data[0].message).toContain("completed");

    const qsearch = await app.request("/operations/logs?q=completed&limit=10");
    expect(qsearch.status).toBe(200);
    const j2 = (await qsearch.json()) as { data: unknown[] };
    expect(j2.data.length).toBeGreaterThanOrEqual(1);

    db.close();
  });

  it("GET /statcan/catalog and GET /raw-payloads/:id", async () => {
    const env = baseEnv();
    const db = openDatabase(env.DATABASE_PATH);
    runMigrations(db, migrationsDirectory());
    const indexedAt = new Date().toISOString();
    db.run(
      `INSERT INTO statcan_cube_catalog (
        product_id, cansim_id, cube_title_en, cube_title_fr, archived,
        frequency_code, subject_codes, housing_score, macro_score, indexed_at, raw_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        999001,
        null,
        "Test CPI Cube",
        null,
        null,
        null,
        null,
        1,
        1,
        indexedAt,
        null,
      ],
    );
    db.run(
      `INSERT INTO raw_payloads (source, source_key, fetched_at, content_type, body, sha256, job_run_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        "test",
        "k1",
        indexedAt,
        "application/json",
        "{}",
        "a".repeat(64),
        null,
      ],
    );
    const payloadId = Number(
      (db.query(`SELECT id FROM raw_payloads LIMIT 1`).get() as { id: number })
        .id,
    );
    const app = createApp(db, env);
    const cat = await app.request("/statcan/catalog?q=CPI&limit=10");
    expect(cat.status).toBe(200);
    const catJson = (await cat.json()) as { data: { product_id: number }[] };
    expect(catJson.data.some((r) => r.product_id === 999001)).toBe(true);

    const byId = await app.request(`/raw-payloads/${payloadId}`);
    expect(byId.status).toBe(200);
    const row = (await byId.json()) as { id: number; body: string };
    expect(row.id).toBe(payloadId);
    expect(row.body).toBe("{}");

    const missing = await app.request("/raw-payloads/999999");
    expect(missing.status).toBe(404);

    db.close();
  });

  it("GET /statcan/wds/observations after normalize job", async () => {
    const env = baseEnv();
    const db = openDatabase(env.DATABASE_PATH);
    runMigrations(db, migrationsDirectory());
    const body = readFileSync(
      join(fixtureDir, "wds-vector-data-response.json"),
      "utf-8",
    );
    const sha = sha256Hex(body);
    const fetchedAt = new Date().toISOString();
    db.run(
      `INSERT INTO raw_payloads (source, source_key, fetched_at, content_type, body, sha256, job_run_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        normRepo.STATCAN_WDS_DATA_SOURCE,
        "data:vector:32164132",
        fetchedAt,
        "application/json",
        body,
        sha,
        null,
      ],
    );
    const ctx: JobContext = { db, env };
    await runJobByName(ctx, "statcan-wds-data-normalize");

    const app = createApp(db, env);
    const res = await app.request("/statcan/wds/observations?limit=10");
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      data: { product_id: number; ref_per: string; value: number }[];
    };
    expect(json.data.length).toBe(1);
    expect(json.data[0].product_id).toBe(35100003);
    expect(json.data[0].ref_per).toBe("2022-01-01");
    expect(json.data[0].value).toBe(19.43);

    const filtered = await app.request(
      "/statcan/wds/observations?product_id=35100003&limit=5",
    );
    expect(filtered.status).toBe(200);
    const fj = (await filtered.json()) as { data: unknown[] };
    expect(fj.data.length).toBe(1);

    db.close();
  });

  it("dashboard keys: 401 without Bearer; viewer 403 on schedules; operator OK", async () => {
    const env = baseEnv({
      DASHBOARD_OPERATOR_KEY: "op-secret",
      DASHBOARD_VIEWER_KEY: "vi-secret",
    });
    const db = openDatabase(env.DATABASE_PATH);
    runMigrations(db, migrationsDirectory());
    const app = createApp(db, env);

    const noAuth = await app.request("/job-runs");
    expect(noAuth.status).toBe(401);

    const viewerJobs = await app.request("/job-runs", {
      headers: { Authorization: "Bearer vi-secret" },
    });
    expect(viewerJobs.status).toBe(200);

    const viewerObs = await app.request("/statcan/wds/observations", {
      headers: { Authorization: "Bearer vi-secret" },
    });
    expect(viewerObs.status).toBe(200);

    const viewerSched = await app.request("/statcan/schedules", {
      headers: { Authorization: "Bearer vi-secret" },
    });
    expect(viewerSched.status).toBe(403);

    const opSched = await app.request("/statcan/schedules", {
      headers: { Authorization: "Bearer op-secret" },
    });
    expect(opSched.status).toBe(200);

    db.close();
  });

  it("CORS: OPTIONS and Allow-Origin when CORS_ALLOW_ORIGIN set", async () => {
    const env = baseEnv({ CORS_ALLOW_ORIGIN: "http://localhost:5173" });
    const db = openDatabase(env.DATABASE_PATH);
    runMigrations(db, migrationsDirectory());
    const app = createApp(db, env);
    const opt = await app.request("/job-runs", { method: "OPTIONS" });
    expect(opt.status).toBe(204);
    expect(opt.headers.get("Access-Control-Allow-Origin")).toBe(
      "http://localhost:5173",
    );
    const get = await app.request("/job-runs");
    expect(get.status).toBe(200);
    expect(get.headers.get("Access-Control-Allow-Origin")).toBe(
      "http://localhost:5173",
    );
    db.close();
  });
});
