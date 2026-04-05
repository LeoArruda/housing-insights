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

## Frontend foundation (stack alignment — [docs/scope.md](../../../docs/scope.md))

- [x] **Pinia** for session/auth client state (`apps/web/src/stores/auth.ts`); API client reads token via active Pinia
- [x] **TanStack Query (Vue)** for server state (dashboard summary, schedules, job runs, raw payloads lists); invalidate on mutations where needed
- [x] **Tailwind CSS v4** + PostCSS (`apps/web/src/assets/main.css`); design tokens aligned with local **`.vue-admin-ref`** (gitignored template), not a full template copy
- [x] Shared **Button** primitive (`apps/web/src/components/ui/Button.vue`) and **AppLayout** / **LoginView** using theme utilities (`menu-item`, etc.)
- [x] Legacy **`--hi-*` CSS variables** in `main.css` for scoped views not yet migrated to utility-only styling (bridge until full Tailwind pass)

## Features

- [x] **Operational logs (FR-11):** See canonical [operational-logging/tasks.md](../operational-logging/tasks.md) — `/operations/logs` API, `/logs` UI, job detail related logs
- [x] US-Dashboard: KPI cards + recent failures + schedule health
- [x] US-Schedules: list + detail
- [x] US-Schedules: guided create wizard (catalog → cadence → advanced → review)
- [x] US-Schedules: PATCH (edit/disable) + DELETE with confirm
- [x] US-Jobs: list with filters + detail
- [x] US-Data: list with source filter + pagination + detail JSON viewer
- [x] US-RBAC: viewer vs operator route guards
- [x] US-Auth: minimal gate (per PRD Open Questions)

## Quality

- [x] `bun test` (api) passes; add web unit tests where valuable (composables, formatters)
- [x] Browser verify Dashboard + one schedule flow (dev-browser skill)
- [x] Update [docs/architecture.md](../../architecture.md) with `apps/web` and console overview
- [x] Keep [verification.md](./verification.md) updated after material console changes (automated + manual / dev-browser as needed)
- [x] Enforce spec-driven + agent boundaries via [AGENTS.md](../../../AGENTS.md) and [.cursor/rules/spec-driven-delivery.mdc](../../../.cursor/rules/spec-driven-delivery.mdc)
