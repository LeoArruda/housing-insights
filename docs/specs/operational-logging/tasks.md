# Tasks: Operational logging

Ordered checklist. Mark `[x]` when done.

## Spec and docs

- [x] Add `docs/specs/operational-logging/` spec, plan, tasks, verification
- [x] Reference in `docs/specs/web-ops-console/tasks.md` and PRD FR for logs UI/API

## Backend (`apps/api`)

- [x] Migration `006_operation_logs.sql`
- [x] Repository + `logging/operational.ts` (DB, optional JSONL, stderr)
- [x] Env: `OPERATIONS_LOG_JSONL_PATH`, `OPERATIONS_LOG_RETENTION_DAYS`, optional `DAEMON_OPERATIONS_LOG_PRUNE_CRON`
- [x] Instrument CLI, daemon, `runners.ts` jobs, dashboard auth logging
- [x] `GET /operations/logs` + tests
- [x] CLI `logs prune` subcommand

## Frontend (`apps/web`)

- [x] `/logs` view with filters and TanStack Query
- [x] Job detail: related logs for `job_run_id`

## Types (`packages/types`)

- [x] `operationLogRowSchema` / types for API responses
