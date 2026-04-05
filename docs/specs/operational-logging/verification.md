# Verification: Operational logging

## Automated

From repo root or `apps/api`:

```bash
cd apps/api && bun test
```

Expect: migration test sees `operation_logs`; server tests cover `GET /operations/logs`.

From `apps/web`:

```bash
cd apps/web && bun run typecheck
```

CLI retention (from `apps/api`):

```bash
bun run cli -- logs prune
```

## Manual (optional)

- Run API with dashboard keys set; `GET /operations/logs` with Bearer viewer token returns JSON.
- Trigger a failing CLI job; confirm stderr shows error and DB has `operation_logs` row with `source=cli`.
- Open `/logs` in the console; filter by level and job_run_id.
