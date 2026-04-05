# Feature specification: StatCan WDS automation

**Status**: Implemented  
**Date**: 2026-04-04

## Summary

Automate Statistics Canada [Web Data Service (WDS) REST](https://www.statcan.gc.ca/eng/developers/wds/user-guide) ingestion: catalog indexing with Housing/Macro keyword scoring, per-product metadata fetches, and optional series data (by vector ID or cube PID + coordinate).

## Functional requirements

- **FR-1**: `StatCanClient` calls documented WDS endpoints: `getAllCubesListLite`, `getCubeMetadata`, `getDataFromCubePidCoordAndLatestNPeriods`, `getDataFromVectorsAndLatestNPeriods`.
- **FR-2**: Catalog index job loads a JSON snapshot (`STATCAN_CATALOG_PATH`) or live `getAllCubesListLite` (`STATCAN_CATALOG_FROM_API`), scores titles against configurable keyword buckets, and upserts `statcan_cube_catalog`.
- **FR-3**: Metadata job resolves target product IDs via `explicit` | `keyword` | `hybrid` mode and stores raw JSON per PID under `statcan-wds-metadata`.
- **FR-4**: Data job fetches either `STATCAN_DATA_VECTOR_IDS` (vector API) or `STATCAN_DEFAULT_DATA_COORDINATE` with resolved product IDs (cube API); stores under `statcan-wds-data`.
- **FR-5**: Requests are spaced by `STATCAN_REQUEST_DELAY_MS`; keyword runs respect `STATCAN_MAX_CUBES_PER_JOB` and `STATCAN_MIN_KEYWORD_SCORE`.
- **FR-6**: Per-product schedules in `statcan_product_schedules` (UTC times; `frequency` daily | weekly | monthly with `day_of_week` / `day_of_month` as required). Job `statcan-scheduled-ingest` processes due rows (`next_run_at <= now`), stores raw payloads with schedule-scoped `source_key`s, recomputes `next_run_at`, and on error records `last_error` and delays the next run by one day. REST CRUD under `/statcan/schedules` validates bodies with Zod; when the catalog table is non-empty, `POST` rejects unknown `product_id` values.

## Schedule semantics (UTC)

- Run times are **UTC** (`hour_utc`, `minute_utc`). There is no separate timezone column in v1.
- **Weekly** `day_of_week`: `0` = Sunday … `6` = Saturday (same as `Date.getUTCDay()`).
- **Monthly** `day_of_month`: `1`–`31`. If the calendar month is shorter, the engine uses the last valid day (e.g. requesting day 31 in February runs on Feb 28 or 29).
- **Pilot PIDs** (`34100096`, `34100099`, `34100100`, `36100350`, `10100106`): migration `004_statcan_pilot_schedules_weekly` sets them to `frequency = weekly`, fills `day_of_week`, `hour_utc`, and `minute_utc` from SQLite `strftime` at **migration apply** time (UTC), and sets `next_run_at` to a past instant so ingestion is due on the next `statcan-scheduled-ingest` run.

## Non-goals

- Automatic derivation of valid coordinates for every cube (operators configure pilot coordinate or vectors).
- Normalized time-series tables beyond raw storage in this iteration.

## Acceptance

- `bun test` passes without live StatCan calls (fixtures only).
- CLI can run `statcan-catalog-index`, `statcan-wds-metadata`, `statcan-wds-data`, and `statcan-scheduled-ingest` with documented env.

## Related

- Follow-on UX and ingest-mode work: [statcan-wds-operator-ux](../statcan-wds-operator-ux/spec.md).
