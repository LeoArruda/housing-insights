# Tasks: Normalization and curated layer (MVP)

**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

## Phase 0 — Design

- [x] Lock in-scope `raw_payloads.source` values and JSON samples (reference or add fixtures) — **`statcan-wds-data`** + [wds-vector-data-response.json](../../../apps/api/test/fixtures/wds-vector-data-response.json); metadata deferred
- [x] Resolve trigger model: **separate job** `statcan-wds-data-normalize` (documented in spec/plan); optional daemon cron env
- [x] Add [docs/data-model.md](../../data-model.md) skeleton (existing tables); **extend** with MVP tables + lineage (`statcan_wds_data_batch`, `statcan_wds_data_observation`, `statcan_wds_normalize_error`)
- [x] Update [docs/architecture.md](../../architecture.md) data flow (link to this spec + data-model)

## Phase 1 — Schema and types

- [x] SQLite migration(s): `005_statcan_wds_normalization.sql` — `statcan_wds_data_batch`, `statcan_wds_data_observation`, `statcan_wds_normalize_error`, FKs to `raw_payloads`
- [x] Zod/types in `packages/types` (`statcan-wds-normalization.ts`): WDS envelope + SUCCESS object + SQLite row shapes; fixture test `apps/api/test/statcan-wds-normalization-schema.test.ts`

## Phase 2 — Normalization

- [x] Implement normalizer(s): [apps/api/src/services/statcan-wds-data-parse.ts](../../../apps/api/src/services/statcan-wds-data-parse.ts) + repo [statcan-wds-normalization.ts](../../../apps/api/src/db/repositories/statcan-wds-normalization.ts)
- [x] Idempotency: `UNIQUE(raw_payload_id)` on batch + transaction for batch + observations; skip pending if batch exists
- [x] Tests: [statcan-wds-data-parse.test.ts](../../../apps/api/test/statcan-wds-data-parse.ts), [statcan-wds-normalize-job.test.ts](../../../apps/api/test/statcan-wds-normalize-job.test.ts)

## Phase 3 — Jobs

- [x] Job `statcan-wds-data-normalize` in [statcan-wds-normalize.ts](../../../apps/api/src/jobs/statcan-wds-normalize.ts); registry + optional `DAEMON_STATCAN_WDS_DATA_NORMALIZE_CRON`; `STATCAN_WDS_NORMALIZE_BATCH_LIMIT` in [env.ts](../../../apps/api/src/env.ts); [apps/api/.env.example](../../../apps/api/.env.example)

## Phase 4 — Read API (if MVP includes)

- [x] `GET /statcan/wds/observations` ([app.ts](../../../apps/api/src/server/app.ts)) — query `product_id`, `limit`, `offset`; same auth as other read routes (viewer allowed)
- [x] Server tests + viewer can access observations when keys set

## Quality

- [x] `bun test` passes (root); no live network in tests
- [x] Update [verification.md](./verification.md) for this epic
