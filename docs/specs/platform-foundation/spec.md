# Feature Specification: Platform foundation

**Feature**: `platform-foundation`  
**Created**: 2026-04-03  
**Status**: Active  
**Input**: Initial platform plan (ingestion + SQLite + CLI/daemon + read API)

## User scenarios and testing

### US1 — Persist ingestion runs and raw payloads (P1)

An operator runs ingestion jobs and every run is recorded; raw HTTP/RSS bodies are stored with checksums for lineage.

**Why**: Core data platform contract; enables replay and debugging.

**Independent test**: Run a job against fixtures; assert `job_runs` and `raw_payloads` rows with expected status and hashes.

**Acceptance scenarios**:

1. **Given** empty DB, **when** a job completes successfully, **then** a `job_runs` row exists with `status=success` and timestamps.
2. **Given** a connector returns bytes, **when** persisted, **then** `raw_payloads` stores `source`, `content_type`, `body`, `sha256`, and duplicate content does not create a second row (`UNIQUE(source, sha256)`).

### US2 — Run jobs from CLI and daemon (P2)

Same job logic runs via `bun` CLI (exit code for cron) and via a long-lived daemon on a schedule.

**Why**: Matches ops preferences: manual/cron plus in-process scheduling.

**Independent test**: Invoke CLI with mocked or fixture-backed job; start daemon with very short interval in test env (or unit-test scheduler registration only).

**Acceptance scenarios**:

1. **Given** job name, **when** `cli job run <name>`, **then** job executes once and process exits 0 on success, non-zero on failure.
2. **Given** daemon mode, **when** enabled, **then** scheduled jobs invoke the same registry functions as CLI.

### US3 — Minimal read API for operations (P3)

HTTP endpoints expose health, recent job runs, and paginated raw payload inspection (local/dev; no auth in v1).

**Why**: Debug and visibility without a UI.

**Independent test**: HTTP tests against Hono app with in-memory or temp SQLite file.

**Acceptance scenarios**:

1. **Given** server running, **when** `GET /health`, **then** 200 with liveness; `GET /health/ready` checks DB.
2. **Given** existing runs, **when** `GET /job-runs`, **then** list with filters `job_name`, `status`, `limit`.
3. **Given** stored payloads, **when** `GET /raw-payloads`, **then** paginated list with optional `source` filter.

### Edge cases

- External fetch failure: job run ends `failed` with `error_message`; no partial raw row unless spec allows (v1: no partial).
- SQLite locked: surface error; document single-writer daemon.
- Invalid env: fail fast at startup for required URLs where applicable.

## Functional requirements

- **FR-001**: SQLite via `bun:sqlite` with strict mode for application opens.
- **FR-002**: Versioned forward-only migrations applied in deterministic order.
- **FR-003**: Tables `job_runs` and `raw_payloads` with FK from `raw_payloads.job_run_id` to `job_runs.id` (nullable for legacy safety, set when inserted from a job).
- **FR-004**: Connectors: StatCan RSS, BoC RSS, one StatCan WDS exemplar fetch, one BoC Valet exemplar fetch; configurable via env.
- **FR-005**: HTTP client for outbound calls: timeout, retries with backoff; tests use fixtures only (no live network in CI).
- **FR-006**: Parsing validated with Zod at boundaries; RSS via fast-xml-parser.
- **FR-007**: CLI and daemon share one job registry implementation.

## Non-goals (this iteration)

- Vue frontend or public analytics UI.
- Authentication on read API.
- PostgreSQL or multi-instance SQLite writers.
- Full normalization / curated tables beyond raw storage.

## Key entities

- **JobRun**: Single execution of a named job with status lifecycle.
- **RawPayload**: Immutable-by-hash stored response body linked optionally to a job run.

## Success criteria

- **SC-001**: `bun test` passes without network.
- **SC-002**: Fresh clone can run migrations and start API + run at least one CLI job using documented env.

## Assumptions

- Developers run on macOS/Linux with Bun 1.x.
- Exemplar WDS/Valet URLs/series IDs are public and stable enough for manual runs; tests use fixtures.
