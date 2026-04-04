# Tasks: Web operations console (Vue)

Ordered checklist for agents/PRs. Mark `[x]` when done.

## Backend (apps/api)

- [x] Add optional Bearer auth middleware: env `DASHBOARD_OPERATOR_KEY`, `DASHBOARD_VIEWER_KEY`; protect routes per spec matrix; `GET /health` (and optionally `/health/ready`) stay public for probes
- [x] Add `GET /statcan/catalog` with search + pagination (repository query on `statcan_cube_catalog`)
- [x] Add `GET /raw-payloads/:id` (404 when missing)
- [x] Add optional `GET /stats/summary` for Dashboard aggregates (or document client-side aggregation limits)
- [x] Enable CORS for configured dev origin(s)
- [x] Unit/integration tests for new endpoints (fixtures, no live HTTP)

## Frontend scaffold (apps/web)

- [x] Create `apps/web` with Vite + Vue 3 + TS + Vue Router
- [x] Env: `VITE_API_BASE_URL`; login stores Bearer token; document `DASHBOARD_*_KEY` in `apps/api/.env.example`
- [x] API client wrapper (fetch) with error shape handling
- [x] App shell: nav, layout, role-aware menu items

## Features

- [ ] US-Dashboard: KPI cards + recent failures + schedule health
- [ ] US-Schedules: list + detail
- [ ] US-Schedules: guided create wizard (catalog → cadence → advanced → review)
- [ ] US-Schedules: PATCH (edit/disable) + DELETE with confirm
- [ ] US-Jobs: list with filters + detail
- [ ] US-Data: list with source filter + pagination + detail JSON viewer
- [ ] US-RBAC: viewer vs operator route guards
- [ ] US-Auth: minimal gate (per PRD Open Questions)

## Quality

- [ ] `bun test` (api) passes; add web unit tests where valuable (composables, formatters)
- [ ] Browser verify Dashboard + one schedule flow (dev-browser skill)
- [ ] Update [docs/architecture.md](../../architecture.md) with `apps/web` and console overview
