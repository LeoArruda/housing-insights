# Tasks: Normalization and curated layer (MVP)

**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

## Phase 0 — Design

- [x] Lock in-scope `raw_payloads.source` values and JSON samples (reference or add fixtures) — **`statcan-wds-data`** + [wds-vector-data-response.json](../../../apps/api/test/fixtures/wds-vector-data-response.json); metadata deferred
- [x] Resolve trigger model: **separate job** `statcan-wds-data-normalize` (documented in spec/plan); optional daemon cron env
- [x] Add [docs/data-model.md](../../data-model.md) skeleton (existing tables); **extend** with MVP tables + lineage (`statcan_wds_data_batch`, `statcan_wds_data_observation`, `statcan_wds_normalize_error`)
- [x] Update [docs/architecture.md](../../architecture.md) data flow (link to this spec + data-model)

## Phase 1 — Schema and types

- [ ] SQLite migration(s): normalized + curated tables, indexes, FK to `raw_payloads`
- [ ] Zod/types in `packages/types` for normalized DTOs (and API if exposed)

## Phase 2 — Normalization

- [ ] Implement normalizer(s) for chosen StatCan WDS raw shape(s)
- [ ] Repository upsert with idempotency (unique constraint + transaction)
- [ ] Unit tests: fixtures only, invalid payload rejection

## Phase 3 — Jobs

- [ ] Register job or hook from existing WDS pipeline; document env/cron if needed
- [ ] Integration test: temp DB, seed raw → run normalize → assert rows

## Phase 4 — Read API (if MVP includes)

- [ ] Hono route(s) + tests
- [ ] Align with optional Bearer auth if endpoints are not public

## Quality

- [ ] `bun test` passes (root); no live network in tests
- [ ] Update [verification.md](./verification.md) for this epic
