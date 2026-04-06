# Feature specification: StatCan WDS operator UX (series discovery + ingest modes)

**Status:** Implemented (MVP; manual browser verification optional)  
**PRD:** [docs/prds/prd-statcan-wds-operator-ux.md](../../prds/prd-statcan-wds-operator-ux.md)  
**Builds on:** [statcan-wds-automation](../statcan-wds-automation/spec.md) (catalog, schedules, `statcan-scheduled-ingest`)

## Summary

Deliver **operator-friendly** StatCan WDS scheduling: **metadata-driven series selection** (no default reliance on hand-pasted `data_coordinate` / `data_vector_id`), **explicit ingest modes** (latest-N, changed/incremental, bulk/range backfill, full-table CSV/SDMX in-product), and a **global subject subscription** model for incremental/changed ingestion—while keeping **raw-first** storage with a **clear path** to normalization in a follow-on epic.

**Reference:** [Statistics Canada WDS User Guide](https://www.statcan.gc.ca/en/developers/wds/user-guide).

## Resolved product decisions (from PRD)

| Topic | Decision |
|-------|----------|
| MVP scope | **Include** incremental/changed flows **and** backfill/full-table paths in this epic—not deferred. |
| Full table | **In-product:** operators can trigger CSV/SDMX (or documented zip) ingestion via platform; not offline-only ETL. |
| Incremental interest | **Global “subscribe to subject”** model (not only per-schedule interest lists). Exact subject taxonomy (e.g. PID, subject code, keyword bucket) is an engineering detail in this spec and `plan.md`. |
| Normalization | **Raw-only first** for new modes; schema and pipelines must be **compatible** with landing `statcan_wds_data_observation` (or successor) in v2 without rework. |

## Functional requirements (technical)

- **FR-T1:** Operators can resolve `data_coordinate` and/or `data_vector_id` via **WDS metadata** (`getCubeMetadata`; optional `getSeriesInfoFromCubePidCoord` / `getSeriesInfoFromVector` for validation).
- **FR-T2:** Schedules support **`ingest_mode`** (enum) with backward compatibility: existing rows behave as **`latest_n`** (current semantics).
- **FR-T3:** **Global subscriptions** associate operators’ intent (subject scope) with **changed-series** / **changed-cube** WDS flows; matching logic is documented and tested with fixtures.
- **FR-T4:** **Bulk/range** and **full-table** (CSV/SDMX) ingestion are **explicit** actions (UI and/or CLI), with **idempotency** and dedupe strategy documented per mode.
- **FR-T5:** New REST endpoints for discovery/validation follow **existing auth/RBAC** (operator vs viewer) per [web-ops-console PRD](../../prds/prd-web-ops-console.md).
- **FR-T6:** Jobs remain **observable** (`job_runs`, schedule `last_error`, operation logs) with enough metadata to triage mode and date windows.
- **FR-T7:** All WDS additions: **Zod** validation, **fixture-based tests**, no live StatCan in CI.

## Non-goals

- Rich analytics dashboards on normalized series (separate epic).
- “Ingest every series in a cube” without explicit confirmation.
- Non-StatCan sources in this UI.

## Subject subscriptions × changed cubes (implemented)

Job `statcan-subject-changed-ingest`: for each **enabled** row in `statcan_subject_subscriptions`, resolve candidate `product_id`s via `statcan_cube_catalog.subject_codes` (substring / JSON-style match in [statcan-catalog repository](../../../apps/api/src/db/repositories/statcan-catalog.ts)); call WDS `getChangedCubeList` for **today’s UTC date**; for each `product_id` in both sets, fetch `getCubeMetadata` and store under `statcan-wds-metadata` with `source_key` `subject:{subscriptionId}:changed-cube:{date}:{productId}`.

## Acceptance (epic)

- `bun test` / `bun run typecheck` pass for touched packages with fixtures only for WDS.
- PRD user stories and FR checklist can be marked done when `tasks.md` checkboxes are complete and `verification.md` is updated.
