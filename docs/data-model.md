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

## Planned: normalized and curated (MVP)

The next epic defines additional tables and lineage from `raw_payloads` → normalized → curated. See:

- [docs/specs/normalization-curated-layer/spec.md](specs/normalization-curated-layer/spec.md)
- [docs/specs/normalization-curated-layer/plan.md](specs/normalization-curated-layer/plan.md)

**Normalized/curated table names and columns** will be appended here when Phase 0 design is locked and migrations are added.
