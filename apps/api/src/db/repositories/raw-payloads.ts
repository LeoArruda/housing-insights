import type { Database } from "bun:sqlite";

export type InsertRawPayloadInput = {
  source: string;
  sourceKey: string | null;
  contentType: string;
  body: string;
  sha256: string;
  jobRunId: number | null;
};

/** Returns true if a new row was inserted, false if duplicate (source, sha256). */
export function insertRawPayload(
  db: Database,
  input: InsertRawPayloadInput,
): boolean {
  const fetchedAt = new Date().toISOString();
  const result = db.run(
    `INSERT OR IGNORE INTO raw_payloads (source, source_key, fetched_at, content_type, body, sha256, job_run_id) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      input.source,
      input.sourceKey,
      fetchedAt,
      input.contentType,
      input.body,
      input.sha256,
      input.jobRunId,
    ],
  );
  return result.changes > 0;
}

export type RawPayloadListFilter = {
  source?: string;
  limit?: number;
  offset?: number;
};

export function listRawPayloads(db: Database, filter: RawPayloadListFilter = {}) {
  const limit = Math.min(filter.limit ?? 50, 500);
  const offset = filter.offset ?? 0;
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (filter.source) {
    conditions.push("source = ?");
    params.push(filter.source);
  }

  const where =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const sql = `SELECT id, source, source_key, fetched_at, content_type, body, sha256, job_run_id FROM raw_payloads ${where} ORDER BY fetched_at DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  return db.query(sql).all(...params) as {
    id: number;
    source: string;
    source_key: string | null;
    fetched_at: string;
    content_type: string;
    body: string;
    sha256: string;
    job_run_id: number | null;
  }[];
}
