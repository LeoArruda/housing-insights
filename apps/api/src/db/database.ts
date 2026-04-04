import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

export function openDatabase(dbPath: string): Database {
  const absolute = resolve(dbPath);
  mkdirSync(dirname(absolute), { recursive: true });
  return new Database(absolute, { strict: true, create: true });
}
