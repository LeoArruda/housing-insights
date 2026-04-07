# Verification: StatCan bulk dataset ingestion

Append entries after **material** implementation changes (AGENTS.md).

## Template (copy for each verification round)

```text
## YYYY-MM-DD — <short title>

### Automated

- From repo root: `bun run typecheck` (or package-scoped per touched `package.json`).
- From `apps/api`: `bun test` (or documented test script).

### Manual / browser (when UI exists)

- Operator can open tracked datasets view, add a ProductID from catalog, set cadence, save.
- “Refresh now” triggers a run visible in job history (or logs in dev).

### Notes

- <optional: fixtures added, migration version, etc.>
```

## Log

### 2026-04-06 — StatCan bulk tracked datasets (MVP)

#### Automated

- `cd apps/api && bun run --bun tsc --noEmit && bun test`
- `cd apps/web && bun run --bun tsc --noEmit && bun test`

#### Manual / browser (optional)

- Operator: open **Bulk datasets** (`/statcan-bulk`), search catalog, add ProductID, **Refresh**; confirm job rows for `statcan-bulk-tracked-sync` under Job runs.
- Set `DAEMON_STATCAN_BULK_TRACKED_CRON` (e.g. `*/10 * * * *`) so the daemon runs due rows without manual CLI.

#### Notes

- Migration: `008_statcan_tracked_datasets` (`statcan_tracked_datasets`).
- New job name: `statcan-bulk-tracked-sync`; raw source: `statcan-bulk-full-table`.
- Dependency: `fflate` (portal ZIP extraction) in `apps/api`.
