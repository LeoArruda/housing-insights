import { afterAll, describe, expect, it } from "bun:test";
import { unlinkSync } from "node:fs";
import { join } from "node:path";
import { openDatabase } from "../src/db/database.ts";
import { migrationsDirectory, runMigrations } from "../src/db/migrate.ts";
import { loadEnv } from "../src/env.ts";
import { createApp } from "../src/server/app.ts";

const tmpDb = join(import.meta.dir, "_test_server.sqlite");

describe("read API", () => {
  afterAll(() => {
    try {
      unlinkSync(tmpDb);
    } catch {
      /* ignore */
    }
  });

  it("returns health and job-runs", async () => {
    const env = loadEnv({ DATABASE_PATH: tmpDb, PORT: "0", HOST: "127.0.0.1" });
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

    db.close();
  });
});
