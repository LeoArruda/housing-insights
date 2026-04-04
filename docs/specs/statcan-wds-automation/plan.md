# Implementation plan: StatCan WDS automation

## Layout

| Path | Role |
|------|------|
| [apps/api/src/connectors/statcan/wds-routes.ts](../../../apps/api/src/connectors/statcan/wds-routes.ts) | WDS REST base URL |
| [apps/api/src/connectors/statcan/statcan-client.ts](../../../apps/api/src/connectors/statcan/statcan-client.ts) | HTTP client + Zod validation |
| [apps/api/src/connectors/statcan/score-cubes.ts](../../../apps/api/src/connectors/statcan/score-cubes.ts) | Keyword scoring |
| [apps/api/config/statcan-keywords.json](../../../apps/api/config/statcan-keywords.json) | Housing / macro keyword lists |
| [apps/api/src/db/migrations/002_statcan_catalog.sql](../../../apps/api/src/db/migrations/002_statcan_catalog.sql) | Catalog + cursor tables |

## Jobs

| Job | Purpose |
|-----|---------|
| `statcan-catalog-index` | File or API catalog → scored rows in `statcan_cube_catalog` |
| `statcan-wds-metadata` | `getCubeMetadata` per target PID → `raw_payloads` |
| `statcan-wds-data` | Vector and/or cube+coordinate data → `raw_payloads` |

## Configuration

See [apps/api/.env.example](../../../apps/api/.env.example).
