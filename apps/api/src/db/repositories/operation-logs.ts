import type { Database } from "bun:sqlite";

export type OperationLogLevel = "debug" | "info" | "warn" | "error";

export type OperationLogAppend = {
  occurredAt: string;
  level: OperationLogLevel;
  source: string;
  jobRunId?: number | null;
  message: string;
  detail?: string | null;
  correlationId?: string | null;
};

export type OperationLogListFilter = {
  from?: string;
  to?: string;
  level?: OperationLogLevel;
  source?: string;
  jobRunId?: number;
  q?: string;
  limit?: number;
  offset?: number;
};

export type OperationLogRow = {
  id: number;
  occurred_at: string;
  level: string;
  source: string;
  job_run_id: number | null;
  message: string;
  detail: string | null;
  correlation_id: string | null;
};

export function appendOperationLog(db: Database, row: OperationLogAppend): number {
  const result = db.run(
    `INSERT INTO operation_logs (
      occurred_at, level, source, job_run_id, message, detail, correlation_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      row.occurredAt,
      row.level,
      row.source,
      row.jobRunId ?? null,
      row.message,
      row.detail ?? null,
      row.correlationId ?? null,
    ],
  );
  return Number(result.lastInsertRowid);
}

export function listOperationLogs(
  db: Database,
  filter: OperationLogListFilter = {},
): OperationLogRow[] {
  const limit = Math.min(Math.max(filter.limit ?? 50, 1), 500);
  const offset = Math.max(filter.offset ?? 0, 0);
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (filter.from) {
    conditions.push("occurred_at >= ?");
    params.push(filter.from);
  }
  if (filter.to) {
    conditions.push("occurred_at <= ?");
    params.push(filter.to);
  }
  if (filter.level) {
    conditions.push("level = ?");
    params.push(filter.level);
  }
  if (filter.source) {
    conditions.push("source = ?");
    params.push(filter.source);
  }
  if (filter.jobRunId != null && Number.isFinite(filter.jobRunId)) {
    conditions.push("job_run_id = ?");
    params.push(filter.jobRunId);
  }
  const q = filter.q?.trim();
  if (q) {
    conditions.push(
      "(instr(lower(message), lower(?)) > 0 OR instr(lower(coalesce(detail, '')), lower(?)) > 0)",
    );
    params.push(q, q);
  }

  const where =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const sql = `SELECT id, occurred_at, level, source, job_run_id, message, detail, correlation_id
    FROM operation_logs ${where}
    ORDER BY occurred_at DESC, id DESC
    LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  return db.query(sql).all(...params) as OperationLogRow[];
}

/** Deletes rows with occurred_at strictly before the cutoff ISO string. Returns rows removed. */
export function pruneOperationLogsBefore(db: Database, cutoffIso: string): number {
  const result = db.run(`DELETE FROM operation_logs WHERE occurred_at < ?`, [
    cutoffIso,
  ]);
  return Number(result.changes);
}
