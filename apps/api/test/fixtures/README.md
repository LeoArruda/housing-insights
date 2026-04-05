# API test fixtures

Static files for unit/integration tests (**no live network**).

| File | Used by | Notes |
|------|---------|--------|
| `wds-vector-data-response.json` | StatCan WDS data jobs / normalization epic | `getDataFromVectorsAndLatestNPeriods`-style array envelope; see [docs/specs/normalization-curated-layer/spec.md](../../../docs/specs/normalization-curated-layer/spec.md) |
| `wds-metadata-response.json` | StatCan WDS metadata job | Metadata envelope; **not** in normalization MVP slice 1 |
| `catalog-small.json` | Catalog index tests | |
| `boc-valet-sample.json` | BoC exemplar | |
| `sample-atom.xml`, `sample-rss.xml` | RSS parsers | |
