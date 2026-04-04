import type { Database } from "bun:sqlite";
import type { JobStatus } from "@housing-insights/types";

export function insertJobRun(db: Database, jobName: string): number {
  const startedAt = new Date().toISOString();
  const result = db.run(
    `INSERT INTO job_runs (job_name, started_at, status) VALUES (?, ?, ?)`,
    [jobName, startedAt, "running"],
  );
  return Number(result.lastInsertRowid);
}

export function finishJobRun(
  db: Database,
  id: number,
  status: JobStatus,
  errorMessage: string | null,
): void {
  db.run(
    `UPDATE job_runs SET finished_at = ?, status = ?, error_message = ? WHERE id = ?`,
    [new Date().toISOString(), status, errorMessage, id],
  );
}

export type JobRunListFilter = {
  job_name?: string;
  status?: JobStatus;
  limit?: number;
};

export function listJobRuns(db: Database, filter: JobRunListFilter = {}) {
  const limit = Math.min(filter.limit ?? 50, 500);
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (filter.job_name) {
    conditions.push("job_name = ?");
    params.push(filter.job_name);
  }
  if (filter.status) {
    conditions.push("status = ?");
    params.push(filter.status);
  }

  const where =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const sql = `SELECT id, job_name, started_at, finished_at, status, error_message, metadata FROM job_runs ${where} ORDER BY started_at DESC LIMIT ?`;
  params.push(limit);

  return db.query(sql).all(...params) as {
    id: number;
    job_name: string;
    started_at: string;
    finished_at: string | null;
    status: string;
    error_message: string | null;
    metadata: string | null;
  }[];
}

export function getJobRunById(db: Database, id: number) {
  return db
    .query(
      `SELECT id, job_name, started_at, finished_at, status, error_message, metadata FROM job_runs WHERE id = ?`,
    )
    .get(id) as
    | {
        id: number;
        job_name: string;
        started_at: string;
        finished_at: string | null;
        status: string;
        error_message: string | null;
        metadata: string | null;
      }
    | undefined;
}
