import { afterAll, describe, expect, it } from "bun:test";
import { unlinkSync } from "node:fs";
import { join } from "node:path";
import { openDatabase } from "../src/db/database.ts";
import { migrationsDirectory, runMigrations } from "../src/db/migrate.ts";

const tmpDb = join(import.meta.dir, "_test_migrate.sqlite");

describe("runMigrations", () => {
  afterAll(() => {
    try {
      unlinkSync(tmpDb);
    } catch {
      /* ignore */
    }
  });

  it("applies initial migration idempotently", () => {
    const db = openDatabase(tmpDb);
    runMigrations(db, migrationsDirectory());
    const tables = db
      .query(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
      )
      .all() as { name: string }[];
    const names = tables.map((t) => t.name);
    expect(names).toContain("job_runs");
    expect(names).toContain("raw_payloads");
    expect(names).toContain("schema_migrations");
    expect(names).toContain("statcan_cube_catalog");
    expect(names).toContain("statcan_ingest_cursor");

    runMigrations(db, migrationsDirectory());
    const versions = db
      .query("SELECT version FROM schema_migrations")
      .all() as { version: string }[];
    expect(versions.filter((v) => v.version === "001_initial").length).toBe(1);
    expect(versions.filter((v) => v.version === "002_statcan_catalog").length).toBe(
      1,
    );
    db.close();
  });
});
