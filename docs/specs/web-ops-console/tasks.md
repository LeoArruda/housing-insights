# Tasks: Web operations console (Vue)

Ordered checklist for agents/PRs. Mark `[x]` when done.

## Backend (apps/api)

- [ ] Add `GET /statcan/catalog` with search + pagination (repository query on `statcan_cube_catalog`)
- [ ] Add `GET /raw-payloads/:id` (404 when missing)
- [ ] Add optional `GET /stats/summary` for Dashboard aggregates (or document client-side aggregation limits)
- [ ] Enable CORS for configured dev origin(s)
- [ ] Unit/integration tests for new endpoints (fixtures, no live HTTP)

## Frontend scaffold (apps/web)

- [ ] Create `apps/web` with Vite + Vue 3 + TS + Vue Router
- [ ] Env: `VITE_API_BASE_URL`; document in README and `.env.example`
- [ ] API client wrapper (fetch) with error shape handling
- [ ] App shell: nav, layout, role-aware menu items

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
