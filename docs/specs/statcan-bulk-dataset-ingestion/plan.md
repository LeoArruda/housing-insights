# Implementation plan: StatCan bulk dataset ingestion

**Spec:** [spec.md](./spec.md) · **Tasks:** [tasks.md](./tasks.md) · **PRD:** [prd-statcan-bulk-ingestion.md](../../prds/prd-statcan-bulk-ingestion.md)

## Phases

### Phase 1 — MVP (this epic)

1. **Schema:** Migration for `statcan_tracked_datasets` (and indexes). No change to `statcan_product_schedules` uniqueness in MVP.
2. **Connector:** Reuse/extend `StatCanClient` for `getFullTableDownloadCSV` and `getChangedCubeList`; optional zip fetch + unzip utility behind same job abstraction.
3. **Jobs:** One scheduler entry (or cron-driven daemon step) that iterates enabled rows, respects concurrency cap, runs: (a) first-time full load, (b) periodic changed-cube check + conditional full reload.
4. **Raw layer:** Writes to `raw_payloads` with stable idempotency keys documented in repo patterns.
5. **API:** CRUD + refresh endpoint; Zod validation; operator RBAC aligned with existing ops routes.
6. **Web:** Tracked datasets screen (list, status, schedule, Refresh now); reuse catalog search patterns from existing StatCan flows where possible.

### Phase 2 — Future (out of MVP)

- **Delta File** pipeline (daily file, filter by ProductID, merge) — product decision + larger design.
- **Parquet / object storage** — requires [normalization-curated-layer](../normalization-curated-layer/spec.md) and platform ADR if cross-cutting.
- **Named collections** (`statcan_tracked_collections`) if multi-pipeline UX is required.

## Risks

| Risk | Mitigation |
|------|------------|
| Large downloads OOM/timeouts | Stream to disk/temp where needed; configurable timeouts; size logging |
| Zip vs CSV format differences | Raw layer stores bytes + content-type; parsers only in normalization |
| Duplicate work vs WDS schedules | Document D5 in ops; optional future “warn if duplicate ProductID” |
| Rate limits on StatCan | Reuse existing HTTP retry/backoff; stagger scheduled runs |

## Dependencies

- Indexed `statcan_cube_catalog` for titles/frequency in UI.
- `job_runs` and logging conventions in `apps/api`.

## ADRs

- [adr-001-statcan-bulk-download-channel.md](./adr-001-statcan-bulk-download-channel.md) — WDS full-table vs portal zip.

## Architecture doc

- **No** change to [docs/architecture.md](../../architecture.md) in MVP unless a cross-app contract is added; bulk ingestion remains **raw-first** inside existing API + SQLite model.
