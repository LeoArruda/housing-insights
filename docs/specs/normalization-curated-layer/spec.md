# Feature specification: Normalization and curated layer (MVP)

**Feature**: `normalization-curated-layer`  
**Status**: Phase 0 locked (implementation: Phase 1+)  
**Date**: 2026-04-03  
**Depends on**: [platform-foundation](../platform-foundation/spec.md), [statcan-wds-automation](../statcan-wds-automation/spec.md) (raw capture + schedules in place)

## Summary

Introduce the **first vertical slice** of **raw → normalized → curated** storage on top of existing `raw_payloads` and `job_runs`. MVP targets **one source family** (recommended: **StatCan WDS** responses already written as raw JSON) so parsing, validation, and upsert logic live behind a clear contract before adding BoC/RSS/CMHC shapes.

## Problem

Today the platform **stops at raw** ([docs/architecture.md](../../architecture.md)): inspection and ops tooling are strong, but **repeatable metrics, joins, and signal logic** need typed rows and stable keys. Parsing ad hoc from raw JSON in many places would create inconsistent semantics and brittle code.

## Goals (MVP)

- **G1**: For **`statcan-wds-data` only** in MVP slice 1 (see **Resolved decisions**), produce **normalized + observation rows** in SQLite with **stable keys** and **FK lineage** to `raw_payloads.id`. `statcan-wds-metadata` normalization is **deferred** to a follow-up slice in the same epic.
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
- **FR-N3**: Normalization entrypoint as registered job **`statcan-wds-data-normalize`** (CLI/daemon); optional cron env documented in `plan.md`.
- **FR-N4**: Documentation: update [docs/architecture.md](../../architecture.md) data flow and add or extend **`docs/data-model.md`** with table definitions and lineage diagram.

## Dependencies

- Existing `raw_payloads`, `job_runs`, StatCan WDS jobs and payloads.
- `apps/api` job registry pattern and repositories.

## Resolved decisions (Phase 0)

### In-scope `raw_payloads.source` (MVP slice 1)

| Source | `source_key` patterns (examples) | Fixture / sample body |
|--------|----------------------------------|------------------------|
| **`statcan-wds-data`** | `data:vector:{id}`, `data:cube:{productId}:{coord}`, `schedule:{id}:data:vector:{id}`, `schedule:{id}:data:cube:{pid}:{coord}` | [apps/api/test/fixtures/wds-vector-data-response.json](../../../apps/api/test/fixtures/wds-vector-data-response.json) |

Canonical job constants: `STATCAN_WDS_DATA_SOURCE` in `apps/api/src/jobs/runners.ts` and `statcan-scheduled.ts` (`statcan-wds-data`).

**JSON envelope (WDS “getData*” responses):** top-level **array** of elements `{ "status": string, "object": { ... } }`. MVP parser processes elements with `status === "SUCCESS"` and `object.vectorDataPoint` present. Shape matches the fixture: `object.productId`, `object.vectorId`, `object.coordinate` (optional), `object.vectorDataPoint[]` with `refPer`, `value`, `decimals`.

**Out of scope for slice 1:** `statcan-wds-metadata` bodies (different envelope — see [wds-metadata-response.json](../../../apps/api/test/fixtures/wds-metadata-response.json)); other `raw_payloads.source` values (RSS, BoC, catalog index JSON).

### Trigger model

**Separate job** `statcan-wds-data-normalize` (name exact in registry):

- After raw rows exist, the normalize job selects candidate `raw_payloads` rows (`source = 'statcan-wds-data'`) that are **not yet** linked to a successful normalization batch (implementation: FK / “processed” flag — see [data-model.md](../../data-model.md)).
- **Rationale:** Keeps ingest jobs fast and idempotent; retries and backfills are explicit; tests can seed `raw_payloads` and run normalize in isolation.

Optional **daemon cron** env (e.g. `DAEMON_STATCAN_WDS_DATA_NORMALIZE_CRON`) — empty / unset means **CLI-only** for MVP unless ops enable it.

### Normalization errors

**Dedicated table** `statcan_wds_normalize_error`: append-only rows for failed parses or rejected payloads (`raw_payload_id`, `message`, `created_at`). Prevents silent drops and supports US-N2 without overloading `job_runs`. Successful re-run after a fix may insert a new batch row; errors remain for audit (or add `resolved_at` in a later migration).

### Physical model (MVP slice 1)

Two tables: **batch** (one row per successfully parsed raw payload) + **observation** (one row per `vectorDataPoint` entry). Details in [docs/data-model.md](../../data-model.md).

## Related

- Orchestrator recommendation: next epic after completed [web-ops-console](../web-ops-console/spec.md) and [statcan-wds-automation](../statcan-wds-automation/spec.md) tasks.
