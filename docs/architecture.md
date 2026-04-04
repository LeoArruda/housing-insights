# Architecture

## Overview

This repository implements a **Canadian economy and housing signals** data platform: API-first ingestion, raw payload storage, job tracking, and a small read API for operations. The first iteration uses **Bun**, **TypeScript**, and **SQLite** (`bun:sqlite`).

See also [docs/specs/platform-foundation/spec.md](specs/platform-foundation/spec.md) and [AGENTS.md](../AGENTS.md).

## Runtime layout

| Piece | Role |
|-------|------|
| `apps/api` | Runnable Bun package: HTTP server, CLI, daemon |
| `packages/types` | Shared Zod schemas and types (e.g. job status) |

Source lives under `apps/api/src/`:

- `connectors/` — fetch + parse external sources (RSS, BoC Valet); `connectors/statcan/` — WDS REST client, catalog scoring, targeting
- `db/` — SQLite open helper, SQL migrations, repositories
- `jobs/` — job registry and runners (shared by CLI and daemon)
- `server/` — Hono read API (health, job runs, raw payloads)
- `cli.ts`, `daemon.ts`, `main.ts` — entrypoints

Tests and fixtures: `apps/api/test/` (no live HTTP in automated tests).

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

**Normalization and curated tables** are planned; this slice stores **raw** bodies only, with checksum-based deduplication per source.

### StatCan WDS

- **Catalog**: optional JSON snapshot (e.g. repo-root `allstatscan.json`) or live `getAllCubesListLite`; rows matching Housing/Macro keywords in [statcan-keywords.json](../apps/api/config/statcan-keywords.json) are stored in `statcan_cube_catalog`.
- **Targeting**: `STATCAN_INGEST_MODE` selects explicit product ID lists and/or scored catalog rows (`keyword` / `hybrid`).
- **Metadata**: POST `getCubeMetadata` per target PID; raw responses stored with source `statcan-wds-metadata`.
- **Data**: POST `getDataFromVectorsAndLatestNPeriods` when `STATCAN_DATA_VECTOR_IDS` is set, or `getDataFromCubePidCoordAndLatestNPeriods` when `STATCAN_DEFAULT_DATA_COORDINATE` is set; raw responses use source `statcan-wds-data`.

See [docs/specs/statcan-wds-automation/spec.md](specs/statcan-wds-automation/spec.md).

## Persistence

- Single SQLite file (default `apps/api/data/platform.sqlite` when using root `bun run` scripts from `apps/api` cwd).
- Forward-only migrations in `apps/api/src/db/migrations/`, tracked in `schema_migrations`.
- **Constraint:** one writer process per database file in v1 (do not run two daemons against the same file).

## Scheduling

- **CLI:** `bun run cli -- job run <name>` / `job run-all` for cron or manual use.
- **Daemon:** `bun run daemon` registers **Croner** jobs; expressions from environment variables (see `apps/api/.env.example`).

## Future (not implemented here)

- Vue `apps/web` and user-facing analytics UI
- PostgreSQL or managed SQL when scale requires it
- Normalized and curated layers, signal detection services
