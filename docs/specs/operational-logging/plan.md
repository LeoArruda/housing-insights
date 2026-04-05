# Plan: Operational logging

## Phase 1 — Persistence and module

- Migration `006_operation_logs.sql` with indexes.
- Repository `operation-logs.ts`: append, list with filters, prune by age.
- Module `logging/operational.ts`: DB + optional JSONL + stderr line format.

## Phase 2 — Emitters

- CLI: log errors to stderr (always) and DB when available.
- Daemon: structured log on scheduled job failure.
- Jobs (`runners.ts`): start/success/failure per job run; key milestones where low-volume.
- API: auth 401/403 via middleware with `db` access.

## Phase 3 — REST + types

- `GET /operations/logs` in `app.ts`.
- Shared Zod types in `packages/types` if used by web.

## Phase 4 — Web

- Route `/logs` with filters and table.
- Job detail: related logs section.

## Phase 5 — Retention

- CLI: `bun run src/cli.ts logs prune` (or documented subcommand).
- Optional daemon cron env.
