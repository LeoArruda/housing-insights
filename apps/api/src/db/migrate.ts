import type { Database } from "bun:sqlite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

function splitSqlStatements(sql: string): string[] {
  return sql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("--"));
}

export function runMigrations(db: Database, migrationsDir: string): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    )
  `);

  const applied = new Set(
    db
      .query("SELECT version FROM schema_migrations")
      .all()
      .map((r) => (r as { version: string }).version),
  );

  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const version = file.replace(/\.sql$/u, "");
    if (applied.has(version)) continue;

    const fullPath = join(migrationsDir, file);
    const sql = readFileSync(fullPath, "utf-8");
    const statements = splitSqlStatements(sql);

    const tx = db.transaction(() => {
      for (const stmt of statements) {
        db.run(stmt);
      }
      db.run("INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)", [
        version,
        new Date().toISOString(),
      ]);
    });
    tx.deferred();
  }
}

export function migrationsDirectory(): string {
  return join(import.meta.dir, "migrations");
}
