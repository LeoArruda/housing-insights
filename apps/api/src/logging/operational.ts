import { appendFileSync } from "node:fs";
import type { Database } from "bun:sqlite";
import * as operationLogsRepo from "../db/repositories/operation-logs.ts";
import type {
  OperationLogAppend,
  OperationLogLevel,
} from "../db/repositories/operation-logs.ts";
import type { Env } from "../env.ts";

const MAX_MESSAGE = 8000;
const MAX_DETAIL_JSON = 32_000;

export type OperationalLogInput = {
  source: string;
  level: OperationalLogLevel;
  message: string;
  jobRunId?: number | null;
  detail?: Record<string, unknown> | null;
  correlationId?: string | null;
};

function truncateMessage(s: string): string {
  if (s.length <= MAX_MESSAGE) return s;
  return `${s.slice(0, MAX_MESSAGE - 20)}…[truncated]`;
}

function serializeDetail(d: Record<string, unknown> | null | undefined): string | null {
  if (d == null || Object.keys(d).length === 0) return null;
  try {
    const s = JSON.stringify(d);
    if (s.length <= MAX_DETAIL_JSON) return s;
    return `${s.slice(0, MAX_DETAIL_JSON - 30)}…[truncated]`;
  } catch {
    return '{"error":"detail_not_serializable"}';
  }
}

function formatStderrLine(input: OperationalLogInput): string {
  const t = new Date().toISOString();
  return `[${t}] ${input.level.toUpperCase()} ${input.source} ${truncateMessage(input.message)}`;
}

function appendJsonl(env: Env, row: OperationLogAppend): void {
  const path = env.OPERATIONS_LOG_JSONL_PATH?.trim();
  if (!path) return;
  try {
    const line = JSON.stringify({
      occurred_at: row.occurredAt,
      level: row.level,
      source: row.source,
      job_run_id: row.jobRunId ?? null,
      message: row.message,
      detail: row.detail,
      correlation_id: row.correlationId ?? null,
    });
    appendFileSync(path, `${line}\n`, "utf-8");
  } catch {
    // best-effort
  }
}

/**
 * Writes to SQLite (when db provided), optional JSONL, and stderr for warn/error (and info for job noise).
 */
export function appendOperationalLog(
  db: Database | undefined,
  env: Env,
  input: OperationalLogInput,
): void {
  const occurredAt = new Date().toISOString();
  const message = truncateMessage(input.message);
  const detailStr = serializeDetail(input.detail ?? null);

  if (input.level === "error" || input.level === "warn") {
    console.error(formatStderrLine(input));
  } else if (input.level === "info") {
    console.info(formatStderrLine(input));
  }

  const row: OperationLogAppend = {
    occurredAt,
    level: input.level,
    source: input.source,
    jobRunId: input.jobRunId,
    message,
    detail: detailStr,
    correlationId: input.correlationId,
  };

  appendJsonl(env, row);

  if (!db) return;
  try {
    operationLogsRepo.appendOperationLog(db, row);
  } catch {
    // never throw from logging
  }
}

/** Compute cutoff ISO for retention prune (UTC). */
export function cutoffIsoForRetentionDays(days: number): string {
  const ms = days * 24 * 60 * 60 * 1000;
  return new Date(Date.now() - ms).toISOString();
}

/** Deletes operational logs older than `env.OPERATIONS_LOG_RETENTION_DAYS`. Returns rows removed. */
export function pruneOperationalLogsByRetention(db: Database, env: Env): number {
  const cutoff = cutoffIsoForRetentionDays(env.OPERATIONS_LOG_RETENTION_DAYS);
  return operationLogsRepo.pruneOperationLogsBefore(db, cutoff);
}
