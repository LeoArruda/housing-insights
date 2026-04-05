# Architecture

## Overview

This repository implements a **Canadian economy and housing signals** data platform: API-first ingestion, raw payload storage, job tracking, and a small read API for operations. The first iteration uses **Bun**, **TypeScript**, and **SQLite** (`bun:sqlite`).

See also [docs/specs/platform-foundation/spec.md](specs/platform-foundation/spec.md), [docs/specs/normalization-curated-layer/spec.md](specs/normalization-curated-layer/spec.md) (next epic: structured layers on top of raw), [docs/data-model.md](data-model.md), and [AGENTS.md](../AGENTS.md).

## Runtime layout

| Piece | Role |
|-------|------|
| `apps/api` | Runnable Bun package: HTTP server, CLI, daemon |
| `apps/web` | Vue 3 + Vite **operations console**: dashboard, StatCan schedules (operators), job runs, **operational logs**, raw payloads (operators + viewers) |
| `packages/types` | Shared Zod schemas and types (e.g. job status) |

Source lives under `apps/api/src/`:

- `connectors/` — fetch + parse external sources (RSS, BoC Valet); `connectors/statcan/` — WDS REST client, catalog scoring, targeting
- `db/` — SQLite open helper, SQL migrations, repositories
- `jobs/` — job registry and runners (shared by CLI and daemon)
- `server/` — Hono API: health, job runs, raw payloads, StatCan schedule CRUD, catalog search (`GET /statcan/catalog`), curated WDS observations (`GET /statcan/wds/observations`), dashboard aggregates (`GET /stats/summary`), optional Bearer auth and CORS (see below)
- `cli.ts`, `daemon.ts`, `main.ts` — entrypoints

Tests and fixtures: `apps/api/test/` (no live HTTP in automated tests). Web unit tests: `apps/web/test/` (`bun run test:web` from repo root).

## Data flow (current iteration)

```text
External feeds / APIs
        ↓
   Connectors (fetch, validate, parse)
        ↓
   Job runners (instrument job_runs)
        ↓
   raw_payloads (UNIQUE source + sha256) + job_runs
        ↓
   Read API (inspection only)
```

**Normalization (StatCan WDS data)** is implemented for `statcan-wds-data` raws: job `statcan-wds-data-normalize` fills `statcan_wds_data_batch` and `statcan_wds_data_observation`; `GET /statcan/wds/observations` reads curated points. Full multi-source normalization remains in [docs/specs/normalization-curated-layer/](specs/normalization-curated-layer/).

### StatCan WDS

- **Catalog**: optional JSON snapshot (e.g. repo-root `allstatscan.json`) or live `getAllCubesListLite`; rows matching Housing/Macro keywords in [statcan-keywords.json](../apps/api/config/statcan-keywords.json) are stored in `statcan_cube_catalog`.
- **Targeting**: `STATCAN_INGEST_MODE` selects explicit product ID lists and/or scored catalog rows (`keyword` / `hybrid`).
- **Metadata**: POST `getCubeMetadata` per target PID; raw responses stored with source `statcan-wds-metadata`.
- **Data**: POST `getDataFromVectorsAndLatestNPeriods` when `STATCAN_DATA_VECTOR_IDS` is set, or `getDataFromCubePidCoordAndLatestNPeriods` when `STATCAN_DEFAULT_DATA_COORDINATE` is set; raw responses use source `statcan-wds-data`.
- **Per-product schedules**: Table `statcan_product_schedules` stores cadence (daily / weekly / monthly, UTC hour/minute; weekly uses `day_of_week` 0=Sunday…6=Saturday; monthly uses `day_of_month`), optional overrides (`latest_n`, `data_coordinate`, `data_vector_id`, fetch flags), and `next_run_at`. The `statcan-scheduled-ingest` job runs on `DAEMON_STATCAN_SCHEDULE_TICK_CRON` (daemon) or via CLI; it selects due rows, calls WDS with row-level options, writes `raw_payloads` with `source_key` prefixes like `schedule:{id}:metadata:{product_id}`, advances `next_run_at` using `computeNextRunAfter`, or on failure sets `last_error` and bumps `next_run_at` by one day. REST: `GET/POST/PATCH/DELETE /statcan/schedules` and `GET /statcan/catalog` (**operator-only** when dashboard keys are set). Pilot product IDs are seeded in migration `003_statcan_product_schedules.sql` and switched to **weekly** (UTC weekday and clock time set at migrate time) with a past `next_run_at` in `004_statcan_pilot_schedules_weekly.sql` so the first tick can run immediately.

See [docs/specs/statcan-wds-automation/spec.md](specs/statcan-wds-automation/spec.md).

## Persistence

- Single SQLite file (default `apps/api/data/platform.sqlite` when using root `bun run` scripts from `apps/api` cwd).
- Forward-only migrations in `apps/api/src/db/migrations/`, tracked in `schema_migrations`.
- **Constraint:** one writer process per database file in v1 (do not run two daemons against the same file).

## Scheduling

- **CLI:** `bun run cli -- job run <name>` / `job run-all` for cron or manual use.
- **Daemon:** `bun run daemon` registers **Croner** jobs; expressions from environment variables (see `apps/api/.env.example`), including `DAEMON_STATCAN_SCHEDULE_TICK_CRON` for per-product StatCan ingestion.

## Operations console (`apps/web`)

- **Stack:** Vue 3, TypeScript, Vue Router, Vite. Run: `bun run dev:web` (repo root) or `bun run dev` in `apps/web`.
- **API base URL:** `VITE_API_BASE_URL` in `apps/web/.env` (optional). If **unset or empty** during `vite` dev, the app calls same-origin **`/api/...`**; Vite proxies `/api` to `http://127.0.0.1:3000` and rewrites the path (see `apps/web/vite.config.ts`). That avoids browser CORS issues when the UI is on `http://localhost:5173` and the API on another host/port.
- **Direct API URL:** If `VITE_API_BASE_URL` is set (e.g. `http://127.0.0.1:3000`), the browser calls that origin; then **`CORS_ALLOW_ORIGIN`** on `apps/api` must match the **exact** SPA origin (including `localhost` vs `127.0.0.1`).
- **Auth (v1):** Optional env `DASHBOARD_OPERATOR_KEY` and/or `DASHBOARD_VIEWER_KEY` on the API. If either is set, protected routes require `Authorization: Bearer <key>`; operator key → full access; viewer key → no schedule/catalog routes (403). If **neither** is set, middleware is off (local/tests). The SPA stores the token in `sessionStorage` after sign-in and attaches it on API calls.
- **Spec / tracking:** [docs/specs/web-ops-console/spec.md](specs/web-ops-console/spec.md); agent checklist [tasks.md](specs/web-ops-console/tasks.md); verification log [verification.md](specs/web-ops-console/verification.md). PRD: [tasks/prd-web-ops-console.md](../tasks/prd-web-ops-console.md).

## Future (not implemented here)

- User-facing **analytics** UI beyond the ops console (charts, curated metrics)
- PostgreSQL or managed SQL when scale requires it
- Normalized and curated layers, signal detection services
