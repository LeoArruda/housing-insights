# Verification: StatCan WDS operator UX

## Automated (2026-04-05)

| Command | Result |
|---------|--------|
| `cd apps/api && bun test` | Pass (migrations, WDS parse helpers, scheduled job, server routes) |
| `cd apps/web && bun run typecheck` | Pass |

## Manual / browser (optional)

- Operator: **Schedules → New** — five-step wizard; **Validate series** calls `POST /statcan/ingest/series-info` (needs live WDS + catalog).
- Operator: **Subject feeds** — create/disable/delete a `subject_code`; enable daemon `DAEMON_STATCAN_SUBJECT_CHANGED_CRON` to run `statcan-subject-changed-ingest`.
- Operator: `POST /statcan/ingest/full-table` — large download; use sparingly.

## Template

| Date | Change | Automated | Manual / notes |
|------|--------|-----------|----------------|
| 2026-04-05 | Initial operator-ux implementation | `bun test` (api), `bun run typecheck` (web) | Spot-check wizard + subscriptions UI |
