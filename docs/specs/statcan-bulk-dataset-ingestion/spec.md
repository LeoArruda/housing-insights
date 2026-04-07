# Feature spec: StatCan bulk dataset ingestion (tracked lifecycle)

**Status:** MVP implemented (see [tasks.md](./tasks.md))  
**PRD:** [docs/prds/prd-statcan-bulk-ingestion.md](../../prds/prd-statcan-bulk-ingestion.md)  
**Related:** [statcan-wds-operator-ux](../statcan-wds-operator-ux/spec.md) (series UX + ingest modes), [statcan-wds-automation](../statcan-wds-automation/spec.md), [normalization-curated-layer](../normalization-curated-layer/spec.md)

## Problem

Operators need **dataset-level** ingestion (full table per ProductID) with **change-driven refresh**, not vector-heavy WDS usage for large tables. The platform must support **tracked ProductIDs**, **initial full load**, **scheduled** `getChangedCubeList` checks, and **conditional full re-download** (Option A), with clear **state** and **ops UI**.

## Goals

1. Persist **tracked datasets** (ProductIDs) with schedule and status.
2. **Initial full load** when no successful full-table ingest exists for that ProductID in this feature’s lineage.
3. **Incremental MVP:** `getChangedCubeList` → if changed → **full table re-download** (no delta merge).
4. **API + jobs** idempotent, observable, fixture-tested.
5. **Ops console** surfaces list, status, next run, **Refresh now**.

## Non-goals (MVP)

- Delta File ingestion and merge (**Phase 2**).
- Parquet/S3/Databricks as required outputs (**Phase 2+**; MVP stores **raw** in `raw_payloads` + metadata in new tables).
- Replacing **all** uses of `statcan_product_schedules` or WDS vector schedules in one release.

## Resolved decisions

### D1 — Epic boundary

- **New spec folder:** `statcan-bulk-dataset-ingestion` (this document).  
- **Rationale:** Avoid mixing “operator series discovery / ingest modes” ([statcan-wds-operator-ux](../statcan-wds-operator-ux/spec.md)) with **bulk lifecycle** (tracked PIDs, full-table jobs). Cross-links and shared WDS client code are expected.

### D2 — Collection model

- **MVP:** A single **tracked-dataset registry** table (e.g. `statcan_tracked_datasets`) keyed by **`product_id` (UNIQUE)**.  
- **Semantics:** “Tracked collection” in the PRD = **the set of rows** in this table (one row per ProductID).  
- **Named pipelines / multiple collections:** **Deferred** — add nullable `collection_id` FK to a `statcan_tracked_collections` table in a later phase if product requires multiple named pipelines. No uniqueness change to `statcan_product_schedules` in MVP for this epic; **bulk tracking** is **orthogonal** to existing per-schedule rows unless we document overlap (D5).

### D3 — Download channel (MVP)

- **Primary:** WDS **`getFullTableDownloadCSV`** (existing connector path), stored as raw payload with content type and checksum.  
- **Secondary (optional same phase):** Public zip URL `https://www150.statcan.gc.ca/n1/en/tbl/csv/{productId}-eng.zip` behind the same job with a **per-tracked-dataset or global default** `download_channel` enum: `wds_full_table_csv` | `statcan_portal_zip`.  
- **Spike outcome:** If zip is chosen for a ProductID, implementation must still write **`raw_payloads`** and the same **state** fields; format differences are **opaque at raw layer** (normalization epic parses CSV after unzip).  
- **ADR:** [adr-001-statcan-bulk-download-channel.md](./adr-001-statcan-bulk-download-channel.md) records the choice and tradeoffs.

### D4 — MVP storage and lineage

- **Raw:** All successful downloads append/update **`raw_payloads`** (existing pattern) with `source` / job correlation.  
- **Metadata:** New table(s) for `last_full_download_at`, `last_changed_check_at`, `last_known_changed_date` (optional), `status` (`pending` | `active` | `error` | …), `cadence`, `next_run_at`.  
- **No** mandatory Parquet or curated table writes in this epic; alignment with [normalization-curated-layer](../normalization-curated-layer/spec.md) is **downstream**.

### D5 — Coexistence with `statcan_product_schedules`

- **MVP rule:** A ProductID may appear in **both** `statcan_product_schedules` (vector/series jobs) and `statcan_tracked_datasets` (bulk lifecycle). Jobs are **separate** (`job` name / type).  
- **Documentation:** Operators should avoid duplicate intent for the **same** ProductID if it causes redundant storage; **not** enforced in code in MVP.

### D6 — Change detection date

- Use **UTC calendar date** for `getChangedCubeList` parameter (align with existing `statcan-subject-changed` / WDS conventions). Exact “as of” semantics (previous business day vs today) defined in implementation with comments and tests.

## Data model (conceptual)

- **`statcan_tracked_datasets`:** `id`, `product_id` (unique), `cadence`, `cron` or derived fields, `download_channel`, `enabled`, `status`, `last_full_download_at`, `last_changed_check_at`, `last_error`, `created_at`, `updated_at`.
- **`job_runs`:** Existing table; bulk jobs use a distinct **`job_name`** (e.g. `statcan_bulk_tracked_sync` or per-product child runs—final name in tasks).

## API (operator)

- REST under existing API app, RBAC consistent with ops console:
  - `GET/POST/PATCH/DELETE` tracked datasets (subset as needed for MVP).
  - `POST …/refresh` or `POST …/run` for manual trigger.

## Web (ops console)

- New or extended routes: **tracked datasets** list with filters, **Refresh now**, schedule controls (daily/weekly/monthly), link to job history.

## Test strategy

- **Fixtures** for WDS responses (`getChangedCubeList`, `getFullTableDownloadCSV` metadata); optional small zip fixture for unzip path if implemented.
- **No live StatCan** in CI.

## Acceptance (high level)

- [x] Tracked dataset CRUD + persistence.
- [x] Initial full load job path writes `raw_payloads` + updates state.
- [x] Scheduled job: changed list → conditional download.
- [x] Manual refresh.
- [x] UI list + actions (operator).
- [x] `tasks.md` items checked and `verification.md` updated after implementation.
