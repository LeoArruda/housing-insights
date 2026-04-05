# Feature specification: Normalization and curated layer (MVP)

**Feature**: `normalization-curated-layer`  
**Status**: Draft  
**Date**: 2026-04-03  
**Depends on**: [platform-foundation](../platform-foundation/spec.md), [statcan-wds-automation](../statcan-wds-automation/spec.md) (raw capture + schedules in place)

## Summary

Introduce the **first vertical slice** of **raw → normalized → curated** storage on top of existing `raw_payloads` and `job_runs`. MVP targets **one source family** (recommended: **StatCan WDS** responses already written as raw JSON) so parsing, validation, and upsert logic live behind a clear contract before adding BoC/RSS/CMHC shapes.

## Problem

Today the platform **stops at raw** ([docs/architecture.md](../../architecture.md)): inspection and ops tooling are strong, but **repeatable metrics, joins, and signal logic** need typed rows and stable keys. Parsing ad hoc from raw JSON in many places would create inconsistent semantics and brittle code.

## Goals (MVP)

- **G1**: For a **defined subset** of StatCan raw sources (e.g. `statcan-wds-data` / `statcan-wds-metadata` payloads, to be enumerated in `plan.md`), produce **normalized rows** in SQLite with **stable natural keys** and **FK lineage** to `raw_payloads.id` (and optionally `job_run_id`).
- **G2**: Expose at least one **curated** (analytics-oriented) table or view that operators can reason about (e.g. time-series friendly: `ref_date`, `product_id`, `value`, `vector_id` — exact shape in plan/data model).
- **G3**: Pipeline is **idempotent**: re-processing the same raw payload does not duplicate business rows (upsert or equivalent).
- **G4**: **Tests** use fixtures only (no live HTTP); cover happy path + invalid payload rejection.

## Non-goals (MVP)

- Full parity for every `raw_payloads.source` value in the DB.
- Rich Vue analytics dashboards (ops console may get **optional** read-only counts later via a separate thin task).
- PostgreSQL migration, streaming, or multi-writer coordination beyond current SQLite constraints.
- **Signal detection** product (alerts, trends) — that builds on curated data in a **future** spec.

## User scenarios and testing

### US-N1 — Normalize from stored raw (P1)

**Independent test**: Insert fixture `raw_payloads` row; run normalizer; assert normalized + curated rows and lineage.

**Acceptance**:

1. **Given** a raw payload matching the supported envelope, **when** normalization runs, **then** validated fields are written to normalized tables and `raw_payloads.id` is recorded.
2. **Given** the same raw payload processed twice, **when** normalization runs again, **then** no duplicate logical rows (idempotent upsert).

### US-N2 — Reject bad data at the boundary (P1)

**Independent test**: Malformed JSON / Zod failure does not insert curated rows; failure is observable (log + optional `job_runs` or error table — decide in plan).

**Acceptance**:

1. **Given** invalid payload for the supported type, **when** normalize runs, **then** no partial curated row is committed (transactional semantics).

### US-N3 — Inspect curated data via API (P2)

**Independent test**: HTTP test against new read endpoint(s) with seeded DB.

**Acceptance**:

1. **Given** curated rows exist, **when** `GET` documented endpoint (e.g. paginated list by `product_id` or date range), **then** JSON matches schema documented in OpenAPI or spec appendix.

## Functional requirements

- **FR-N1**: Zod (or equivalent) schemas at the **normalization boundary**; shared types in `packages/types` where the API and jobs both need them.
- **FR-N2**: Forward-only SQL migrations; no destructive migration of raw tables.
- **FR-N3**: Normalization entrypoint callable from a **job runner** (CLI/daemon) so it can run on a schedule or after ingest (exact trigger in `plan.md`).
- **FR-N4**: Documentation: update [docs/architecture.md](../../architecture.md) data flow and add or extend **`docs/data-model.md`** with table definitions and lineage diagram.

## Dependencies

- Existing `raw_payloads`, `job_runs`, StatCan WDS jobs and payloads.
- `apps/api` job registry pattern and repositories.

## Open questions (resolve in plan)

- Trigger model: **synchronous** (inside existing WDS job after raw write) vs **async** (separate `normalize-statcan-wds` job polling new raws).
- Which **exact** `source` values and JSON shapes are in scope for v1.
- Whether to store **normalization errors** in a dedicated table vs job log only.

## Related

- Orchestrator recommendation: next epic after completed [web-ops-console](../web-ops-console/spec.md) and [statcan-wds-automation](../statcan-wds-automation/spec.md) tasks.
