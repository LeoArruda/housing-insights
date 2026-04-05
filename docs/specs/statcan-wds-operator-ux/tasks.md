# Tasks: StatCan WDS operator UX

> Canonical checklist for this epic. Keep aligned with [tasks/prd-statcan-wds-operator-ux.md](../../../tasks/prd-statcan-wds-operator-ux.md) story/FR checkboxes.

## Phase 1 — Schema + contracts

- [x] Migration(s): `ingest_mode` on `statcan_product_schedules` (default `latest_n`); optional columns for backfill/range windows as per spec
- [x] Migration(s): **global subject subscription** tables (subject key, metadata, enabled, audit columns) + link to schedules or standalone interest model as designed
- [x] Zod + TypeScript types for schedule create/update including new fields
- [x] Repository updates for `statcan-product-schedules` + new subscription repository

## Phase 2 — WDS connector

- [x] Add WDS routes + `StatCanClient` methods: `getChangedSeriesList`, `getChangedCubeList`, changed-series data methods per spec, bulk/range as needed
- [x] Add series validation helpers: `getSeriesInfoFromCubePidCoord` / `getSeriesInfoFromVector` (optional path)
- [x] Fixture JSON + unit tests (no live WDS in CI) — parse helpers tested; client tests cover existing methods

## Phase 3 — Jobs + raw storage

- [x] Extend `statcan-scheduled-ingest` (or add jobs) to branch on `ingest_mode`: `latest_n` (preserve behavior), `changed_*`, `bulk_range`, `full_table_*`
- [x] Implement **global subscription** matching against changed APIs (document algorithm in spec if not already)
- [x] In-product **CSV/SDMX** (or zip) fetch path: explicit trigger, store under `raw_payloads`, idempotency keys documented
- [x] Job metadata / `operation_logs` / `last_error` messages sufficient for triage

## Phase 4 — REST API (RBAC)

- [x] Endpoints for cube metadata–backed **series discovery** and **validation** (product-scoped; pagination/search as needed)
- [x] CRUD or management endpoints for **subject subscriptions** (operator-only where mutating)
- [x] Extend existing `/statcan/schedules` for new fields; integration tests

## Phase 5 — Web ops console

- [x] Schedule wizard: **Product → Series discovery → Cadence (UTC) → Ingest options → Review**
- [x] **Global subscription** UI (create/edit/list) consistent with PRD
- [x] Plain-language copy for ingest modes; advanced overrides collapsed
- [ ] Browser verification for operator flows (manual)

## Phase 6 — Closeout

- [x] Update [verification.md](./verification.md) with commands + manual notes
- [ ] Mark PRD stories complete when this file is complete
