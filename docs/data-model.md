# Data model

High-level reference for SQLite tables in `apps/api`. Forward-only migrations live in `apps/api/src/db/migrations/`.

## Operational tables (as of current migrations)

| Table | Purpose |
|-------|---------|
| `job_runs` | Single execution of a named job; status, timestamps, error |
| `raw_payloads` | Immutable-by-hash stored bodies; `UNIQUE(source, sha256)`; optional `job_run_id` |
| `statcan_cube_catalog` | StatCan cube catalog rows for targeting/search |
| `statcan_ingest_cursor` | Ingest cursor state for StatCan flows |
| `statcan_product_schedules` | Per-product WDS cadence and overrides |

## StatCan WDS normalization (MVP slice 1 — Phase 0 locked)

Spec: [docs/specs/normalization-curated-layer/spec.md](specs/normalization-curated-layer/spec.md). **Source:** `raw_payloads.source = 'statcan-wds-data'` only. **Reference fixture:** [apps/api/test/fixtures/wds-vector-data-response.json](../apps/api/test/fixtures/wds-vector-data-response.json). **Migration:** `005_statcan_wds_normalization.sql`. **Populate:** CLI/daemon job `statcan-wds-data-normalize` (see `apps/api/src/jobs/statcan-wds-normalize.ts`). **Read API:** `GET /statcan/wds/observations`.

```text
raw_payloads (existing)
       │
       ├─ FK ─► statcan_wds_data_batch (1:1 per successfully parsed raw row)
       │              │
       │              └─ FK ─► statcan_wds_data_observation (1:N points)
       │
       └─ FK ─► statcan_wds_normalize_error (0..N append-only failures)
```

### `statcan_wds_data_batch`

One row per `raw_payloads` row **successfully** parsed as a WDS data response (SUCCESS objects with data points).

| Column | Type | Notes |
|--------|------|--------|
| `id` | INTEGER PK | |
| `raw_payload_id` | INTEGER NOT NULL UNIQUE | FK → `raw_payloads.id` |
| `product_id` | INTEGER NOT NULL | From WDS `object.productId` (first SUCCESS object or aggregated — implementation picks first object for MVP if multiple) |
| `vector_id` | INTEGER NULL | `object.vectorId` when present |
| `coordinate` | TEXT NULL | `object.coordinate` when present |
| `point_count` | INTEGER NOT NULL | Number of observations inserted |
| `created_at` | TEXT NOT NULL | ISO-8601 |

**Idempotency:** `UNIQUE(raw_payload_id)` ensures one batch per raw row; re-running normalize updates or no-ops per job logic (Phase 1).

### `statcan_wds_data_observation`

Time-series friendly rows for analytics (curated fact).

| Column | Type | Notes |
|--------|------|--------|
| `id` | INTEGER PK | |
| `batch_id` | INTEGER NOT NULL | FK → `statcan_wds_data_batch.id` |
| `raw_payload_id` | INTEGER NOT NULL | Denormalized FK → `raw_payloads.id` for direct lineage queries |
| `ref_per` | TEXT NOT NULL | WDS `refPer` (reference period, e.g. date string) |
| `value` | REAL NOT NULL | |
| `decimals` | INTEGER NULL | WDS `decimals` |

**Idempotency:** `UNIQUE(batch_id, ref_per)` for MVP **single-series-per-batch** assumption (one primary SUCCESS `object` per payload in slice 1). If a payload yields multiple SUCCESS objects with overlapping `refPer`, Phase 1 migration may add `object_ordinal` — document deviation in migration comment if needed.

### `statcan_wds_normalize_error`

| Column | Type | Notes |
|--------|------|--------|
| `id` | INTEGER PK | |
| `raw_payload_id` | INTEGER NOT NULL | FK → `raw_payloads.id` |
| `message` | TEXT NOT NULL | Parse/validation error |
| `created_at` | TEXT NOT NULL | ISO-8601 |

Append-only; multiple rows per `raw_payload_id` allowed (history of failures).

### Deferred (same epic, later slice)

- **`statcan-wds-metadata`** normalization (different JSON shape; fixture `wds-metadata-response.json`).
- Additional indexes (e.g. `(product_id, ref_per)`) once read API queries are defined.
