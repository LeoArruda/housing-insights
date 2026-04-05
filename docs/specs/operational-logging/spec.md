# Feature specification: Operational logging

**Feature**: `operational-logging`  
**Status**: Implemented  
**Date**: 2026-04-05

## Summary

Provide **structured, durable operational logs** for operators: CLI, daemon, HTTP API (auth denials), and ingestion jobs write to SQLite (`operation_logs`) with optional JSONL mirror; the API exposes **searchable/filterable** reads; the web ops console shows a **Logs** view and **related logs** on job detail.

## Canonical tracking

- **[tasks.md](./tasks.md)** — implementation checklist.
- **[verification.md](./verification.md)** — automated checks and manual notes.

## Non-goals (v1)

- Full ELK/Loki/Datadog integration (JSONL optional sink only).
- Distributed tracing / OpenTelemetry.
- Logging raw HTTP bodies or full `raw_payloads.body`.

## Security and redaction

- Never log `Authorization` headers, dashboard tokens, or full `.env`.
- Do not log entire ingestion payloads; job logs may reference `product_id`, `job_run_id`, counts only.
- API auth denial logs: path + method + status class only (no token values).

## Event schema

| Field | Type | Notes |
|-------|------|--------|
| `id` | integer | PK |
| `occurred_at` | ISO UTC | Indexed |
| `level` | `debug` \| `info` \| `warn` \| `error` | Indexed |
| `source` | string | e.g. `cli`, `daemon`, `api`, `job:statcan-rss` |
| `job_run_id` | integer nullable | FK to `job_runs` |
| `message` | text | Max length capped at insert |
| `detail` | JSON text nullable | Stack, errno, structured fields; truncated if large |
| `correlation_id` | text nullable | Reserved for future use |

## API contract

- `GET /operations/logs` — query params: `from`, `to` (ISO), `level`, `source`, `job_run_id`, `q` (substring on message), `limit`, `offset`.
- **RBAC:** Same as job-runs: **viewer + operator** may read when dashboard auth is enabled; unauthenticated blocked when keys set.

## Retention

- Env `OPERATIONS_LOG_RETENTION_DAYS` (default 30): logs older than this may be deleted by prune CLI or optional daemon cron.
