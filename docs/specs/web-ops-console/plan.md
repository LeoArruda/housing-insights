# Implementation plan: Web operations console (Vue)

## Architecture

```mermaid
flowchart LR
  subgraph browser [Browser]
    Vue[Vue3_SPA]
  end
  subgraph api [apps_api]
    Hono[Hono_read_write_API]
    DB[(SQLite)]
  end
  Vue -->|JSON_REST| Hono
  Hono --> DB
```

- **SPA:** `apps/web` — Vite + Vue 3 + TypeScript; route-based layout; shared layout with nav by role.
- **API:** Extend [`apps/api/src/server/app.ts`](../../../apps/api/src/server/app.ts) only where list/search/detail is missing (catalog, raw payload by id, optional stats).
- **Auth v1:** Optional `DASHBOARD_OPERATOR_KEY` / `DASHBOARD_VIEWER_KEY`; Hono middleware validates `Authorization: Bearer`; derives role; **off** when unset. SPA login → `sessionStorage`. **Follow-up:** JWT/OIDC.
- **Hosting (prod):** Prefer **same-origin** reverse proxy: static SPA + `/api` → Bun. **Dev:** CORS for Vite port.

## Backend additions (minimal)

| Endpoint | Purpose |
|----------|---------|
| `GET /statcan/catalog` | Query params: `q`, `limit`, `offset` — `q` integer → `product_id`; else `LIKE` on EN/FR titles (see spec Resolved decisions) |
| `GET /raw-payloads/:id` | Single row for JSON viewer |
| `GET /stats/summary` (optional) | Pre-computed job_run counts by status for window — avoids pulling 500 rows to client |

**Repositories:** New helpers in `apps/api/src/db/repositories/statcan-catalog.ts` (search) and `raw-payloads.ts` (`getById`).

**CORS:** Configure Hono `cors()` for dev Vite origin.

## Frontend layout (`apps/web`)

| Path | Role | Description |
|------|------|---------------|
| `/login` | all | Auth shell (per US-002) |
| `/dashboard` | all | KPIs + recent failures |
| `/schedules` | operator | Table |
| `/schedules/new` | operator | Wizard |
| `/schedules/:id` | operator | Detail + edit |
| `/jobs` | all (read-only for viewer) | Filterable list |
| `/jobs/:id` | all (read-only for viewer) | Detail |
| `/data` | all (read-only for viewer) | Payload list |
| `/data/:id` | all (read-only for viewer) | JSON viewer |

**Packages:** Reuse `@housing-insights/types` where job status enums overlap.

## Phases

1. **API gaps** — Bearer auth middleware (when keys set), catalog list/search, raw payload by id, CORS; optional stats endpoint.
2. **Vue scaffold** — router, layout, API client, error toast pattern.
3. **Dashboard** — wire to job_runs + schedules endpoints (or stats).
4. **Schedules** — list/detail/PATCH/delete; then guided create wizard.
5. **Jobs + Data** — lists and details.
6. **RBAC polish** — viewer vs operator routes.
7. **Docs** — README runbook for `apps/web` + env vars.

## Frontend foundation (spec slice; aligns with [docs/scope.md](../../../docs/scope.md))

This slice documents stack work that supports the ops console but is **not** a separate product feature in the PRD. It satisfies **AGENTS.md** “spec + plan” traceability for meaningful cross-cutting UI changes.

| Area | Decision |
|------|-----------|
| **Global client state** | Pinia store for auth session (replaces ad-hoc module state). |
| **Server state** | `@tanstack/vue-query` for reads/lists; keep mutations explicit with `invalidateQueries` where lists must refresh. |
| **Styling** | Tailwind v4 + `@theme` tokens in `apps/web/src/assets/main.css`; sidebar/nav patterns and primitives informed by **`.vue-admin-ref`** (local-only reference). |
| **Compatibility** | `:root` / `.dark` **`--hi-*`** aliases preserve legacy scoped Vue styles until views are migrated to utilities. |

**Out of scope for this slice:** full removal of scoped `--hi-*` CSS from every view; dark-mode toggle UI (Tailwind `dark:` variants ready when `html` gets `class="dark"`).

## Risks

- **Large JSON bodies** — browser memory; mitigate truncation/warning.
- **Keys unset in prod** — API stays open; deployment **must** use network controls or set keys.

## References

- PRD: [docs/prds/prd-web-ops-console.md](../../prds/prd-web-ops-console.md)
- Existing schedules API: [apps/api/src/server/app.ts](../../../apps/api/src/server/app.ts)
- Vue skill: [`.cursor/skills/vue/SKILL.md`](../../../.cursor/skills/vue/SKILL.md)
- Vue template to follow: ['.vue-admin-ref'](../../../.vue-admin-ref/)
