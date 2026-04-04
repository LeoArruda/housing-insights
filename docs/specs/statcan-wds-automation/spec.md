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

## Non-goals

- Automatic derivation of valid coordinates for every cube (operators configure pilot coordinate or vectors).
- Normalized time-series tables beyond raw storage in this iteration.

## Acceptance

- `bun test` passes without live StatCan calls (fixtures only).
- CLI can run `statcan-catalog-index`, `statcan-wds-metadata`, and `statcan-wds-data` with documented env.
