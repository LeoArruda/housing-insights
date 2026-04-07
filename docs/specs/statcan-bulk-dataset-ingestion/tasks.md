# Tasks: StatCan bulk dataset ingestion

**Canonical checklist** — mark `[x]` when done. **PRD:** [prd-statcan-bulk-ingestion.md](../../prds/prd-statcan-bulk-ingestion.md) (keep FR/story checkboxes aligned).

## Backend (API, DB, jobs) — sequence first

- [x] **B-1:** Add SQLite migration for `statcan_tracked_datasets` (columns per [spec.md](./spec.md) D2/D4); indexes on `product_id`, `enabled`, `next_run_at` as needed.
- [x] **B-2:** Repository module for tracked datasets (CRUD, list with filters).
- [x] **B-3:** Extend or wrap `StatCanClient` for full-table download path used by bulk jobs; fixture tests (no live API).
- [x] **B-4:** Implement `getChangedCubeList` call for a given date; parse response; fixture tests.
- [x] **B-5:** Job/service: initial full load → `raw_payloads` + state update (`last_full_download_at`, status).
- [x] **B-6:** Job/service: changed-cube check → if ProductID in list, full re-download; else update `last_changed_check_at` only.
- [x] **B-7:** Bounded parallelism (env/config); retries and idempotency keys documented in code.
- [x] **B-8:** Schedule integration: daily/weekly/monthly → compute `next_run_at` / hook into existing job daemon.
- [x] **B-9:** REST API: list/create/update/delete tracked datasets + `POST` refresh (operator RBAC); Zod schemas.
- [x] **B-10:** (Optional MVP) Portal ZIP fetch + extract path behind `download_channel`; tests with small fixture zip.

## Frontend (ops console) — after API contracts

- [x] **F-1:** Route(s) for “StatCan tracked datasets” (nav label per UX review).
- [x] **F-2:** Table: ProductID, title (from catalog), status, last updated, next run, actions.
- [x] **F-3:** Catalog search/add flow (reuse catalog endpoints/composables; multi-select or add-one pattern per design).
- [x] **F-4:** Schedule controls (daily / weekly / monthly) + save.
- [x] **F-5:** “Refresh now” action + loading/error toasts.
- [x] **F-6:** Link or embed to job run history for bulk job name(s).

## Docs / cross-cutting

- [x] **D-1:** Update this `tasks.md` checkboxes when merging implementation PRs.
- [x] **D-2:** Append [verification.md](./verification.md) after material code changes.

## Phase 2 (explicitly not MVP)

- [ ] Delta File ingestion and merge.
- [ ] Parquet / object storage as primary path.
- [ ] Named `statcan_tracked_collections` and multi-pipeline UX.
