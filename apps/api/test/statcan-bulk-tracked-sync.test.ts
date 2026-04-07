import { afterAll, describe, expect, it } from "bun:test";
import { join } from "node:path";
import { unlinkSync } from "node:fs";
import { openDatabase } from "../src/db/database.ts";
import { migrationsDirectory, runMigrations } from "../src/db/migrate.ts";
import { loadEnv } from "../src/env.ts";
import * as trackedRepo from "../src/db/repositories/statcan-tracked-datasets.ts";
import * as catalogRepo from "../src/db/repositories/statcan-catalog.ts";
import {
  jobStatcanBulkTrackedSync,
  utcYesterdayDateString,
} from "../src/jobs/statcan-bulk-tracked-sync.ts";
import type { JobContext } from "../src/jobs/runners.ts";

const tmpDb = join(import.meta.dir, "_test_bulk_tracked.sqlite");

describe("statcan-bulk-tracked-sync", () => {
  afterAll(() => {
    try {
      unlinkSync(tmpDb);
    } catch {
      /* ignore */
    }
  });

  it("utcYesterdayDateString is YYYY-MM-DD", () => {
    expect(utcYesterdayDateString()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("initial load writes raw_payload and advances next_run", async () => {
    try {
      unlinkSync(tmpDb);
    } catch {
      /* ignore */
    }
    const env = loadEnv({
      DATABASE_PATH: tmpDb,
      STATCAN_BULK_TRACKED_PARALLEL: "2",
    });
    const db = openDatabase(env.DATABASE_PATH);
    runMigrations(db, migrationsDirectory());

    const now = new Date().toISOString();
    catalogRepo.upsertCubeCatalog(db, {
      product_id: 99_001,
      cansim_id: null,
      cube_title_en: "Test cube",
      cube_title_fr: null,
      archived: null,
      frequency_code: null,
      subject_codes: null,
      housing_score: 2,
      macro_score: 2,
      indexed_at: now,
      raw_json: "{}",
    });

    trackedRepo.insertTrackedDataset(db, {
      product_id: 99_001,
      frequency: "daily",
      hour_utc: 12,
      minute_utc: 0,
      download_channel: "wds_full_table_csv",
      enabled: true,
    });
    const row = trackedRepo.getTrackedByProductId(db, 99_001)!;
    trackedRepo.updateTrackedRunState(db, row.id, {
      next_run_at: new Date().toISOString(),
    });

    const csv = "h1,h2\n1,2\n";
    const fetchImpl: typeof fetch = async (url) => {
      const u = String(url);
      if (u.includes("/getChangedCubeList/")) {
        return new Response(JSON.stringify([{ productId: 99_001 }]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (u.includes("/getFullTableDownloadCSV/")) {
        return new Response(csv, {
          status: 200,
          headers: { "Content-Type": "text/csv" },
        });
      }
      return new Response("not found", { status: 404 });
    };

    const ctx: JobContext = { db, env, fetchImpl };
    await jobStatcanBulkTrackedSync(ctx);

    const n = db
      .query(
        `SELECT COUNT(*) as c FROM raw_payloads WHERE source = 'statcan-bulk-full-table'`,
      )
      .get() as { c: number };
    expect(n.c).toBe(1);

    const updated = trackedRepo.getTrackedByProductId(db, 99_001)!;
    expect(updated.last_full_download_at).not.toBeNull();
    expect(updated.status).toBe("active");
    expect(updated.next_run_at).not.toBeNull();

    db.close();
  });

  it("incremental run re-downloads when changed-cube list includes product", async () => {
    try {
      unlinkSync(tmpDb);
    } catch {
      /* ignore */
    }
    const env = loadEnv({
      DATABASE_PATH: tmpDb,
      STATCAN_BULK_TRACKED_PARALLEL: "1",
    });
    const db = openDatabase(env.DATABASE_PATH);
    runMigrations(db, migrationsDirectory());

    const now = new Date().toISOString();
    catalogRepo.upsertCubeCatalog(db, {
      product_id: 99_002,
      cansim_id: null,
      cube_title_en: "Test2",
      cube_title_fr: null,
      archived: null,
      frequency_code: null,
      subject_codes: null,
      housing_score: 2,
      macro_score: 2,
      indexed_at: now,
      raw_json: "{}",
    });

    trackedRepo.insertTrackedDataset(db, {
      product_id: 99_002,
      frequency: "daily",
      hour_utc: 12,
      minute_utc: 0,
      download_channel: "wds_full_table_csv",
      enabled: true,
    });
    const row = trackedRepo.getTrackedByProductId(db, 99_002)!;
    trackedRepo.updateTrackedRunState(db, row.id, {
      next_run_at: new Date().toISOString(),
      last_full_download_at: new Date(Date.now() - 86_400_000).toISOString(),
    });

    let csvCalls = 0;
    const fetchImpl: typeof fetch = async (url) => {
      const u = String(url);
      if (u.includes("/getChangedCubeList/")) {
        return new Response(JSON.stringify([{ productId: 99_002 }]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (u.includes("/getFullTableDownloadCSV/")) {
        csvCalls += 1;
        return new Response("a\n1\n", {
          status: 200,
          headers: { "Content-Type": "text/csv" },
        });
      }
      return new Response("not found", { status: 404 });
    };

    const ctx: JobContext = { db, env, fetchImpl };
    await jobStatcanBulkTrackedSync(ctx);

    expect(csvCalls).toBe(1);
    const n = db
      .query(
        `SELECT COUNT(*) as c FROM raw_payloads WHERE source = 'statcan-bulk-full-table'`,
      )
      .get() as { c: number };
    expect(n.c).toBe(1);

    db.close();
  });
});
