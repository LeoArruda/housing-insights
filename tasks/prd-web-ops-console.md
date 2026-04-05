# PRD: Web operations console (Vue)

> **Checklist authority:** For spec-driven delivery ([AGENTS.md](../AGENTS.md)), implementation status is canonical in [docs/specs/web-ops-console/tasks.md](../docs/specs/web-ops-console/tasks.md). Verification runs (automated commands, FR spot checks, manual browser notes) are logged in [docs/specs/web-ops-console/verification.md](../docs/specs/web-ops-console/verification.md). User-story acceptance checkboxes below are kept aligned with that `tasks.md` file.

## Introduction / overview

Operators and leadership need a **browser-based console** on top of the existing ingestion platform (`apps/api`). Today scheduling, job history, and raw payloads are reachable only via REST (no auth) and CLI/daemon. This feature delivers a **Vue 3** app with:

- A **Dashboard** visible to all authenticated users (leadership + operators + **viewers**), focused on **pipeline health** and **incident signals**.
- **Operator-only:** **guided creation/editing/deletion of StatCan product schedules**.
- **Operators and viewers (read-only):** **job run** list/detail and **raw payload** list/detail (metadata + JSON body).

**Problem solved:** Slow visibility into what is scheduled, what failed, and what was ingested; reduces reliance on logs and ad-hoc API calls. **Success:** faster schedule overview and faster failure detection.

**Stakeholder inputs incorporated (brainstorm):** Control plane + minimal data preview before analytics charts; guided scheduling; raw JSON viewer + key fields; Vue; one app with shared Dashboard + operator pages; raw payloads as-is for v1 data view.

---

## Goals

- Provide a **single place** to see **enabled schedules**, **next/last run**, and **last error** per StatCan product schedule.
- Provide a **Dashboard** with **operational KPIs** (job success/fail counts, recent failures, schedule counts) without building a full analytics product.
- Enable **guided schedule creation** (pick product from catalog, choose cadence/time UTC, optional advanced overrides).
- Enable **read-only exploration** of `raw_payloads` (list + detail with formatted JSON + key columns).
- Establish **role differentiation**: **viewer** (Dashboard + read-only jobs + read-only payloads) vs **operator** (+ full schedule CRUD).
- **Do not** implement rich charting, normalized time-series exploration, or multi-source ingestion UI beyond StatCan in v1 (see Non-goals).

---

## User stories

### US-001: Vue app scaffold and API client

**Description:** As a developer, I want a runnable Vue 3 + TypeScript app under `apps/web` so that the UI can call the existing API with a shared config base URL.

**Acceptance criteria:**

- [x] `apps/web` runs with `bun`/`vite` (or repo-standard script documented in README).
- [x] Central API base URL from env (e.g. `VITE_API_BASE_URL`).
- [x] Typecheck/lint passes for the new package.

---

### US-002: Authentication shell (minimal)

**Description:** As an operator, I want the app to be protected by a minimal auth gate so that the console is not wide open on the public internet.

**Acceptance criteria:**

- [x] Unauthenticated users cannot access operator routes or Dashboard (redirect to login or static “unauthorized”).
- [x] Auth mechanism matches **Resolved decisions**: Bearer token to API; see spec § Resolved decisions.
- [x] **Viewer** vs **operator** distinguished by **which shared secret** is used at login (`DASHBOARD_VIEWER_KEY` vs `DASHBOARD_OPERATOR_KEY`), or dev mock (see spec).
- [x] Typecheck passes.

---

### US-003: Dashboard (all roles)

**Description:** As leadership or an operator, I want a Dashboard that surfaces pipeline health so that I can notice failures and activity without reading logs.

**Acceptance criteria:**

- [x] Shows **counts** of job runs in the **last 24 hours (UTC)** by `finished_at`, broken down by **success** vs **failed** (include **running** only if `finished_at` is null and status indicates in progress — see spec).
- [x] Shows up to **15 most recent failed** job runs (any time), ordered by `finished_at` desc, with job name, time, error snippet, link to detail.
- [x] Shows **schedule summary**: count of enabled schedules, count with `last_error` non-null (or equivalent “needs attention”).
- [x] Layout is readable on desktop (mobile optional).
- [x] Typecheck passes.
- [x] Verify in browser using dev-browser skill.

---

### US-004: Schedules list and detail (operators)

**Description:** As an operator, I want to list and open StatCan product schedules so that I can see cadence, next run, and errors.

**Acceptance criteria:**

- [x] Table (or cards) listing schedules with: `product_id`, `frequency`, UTC time fields, `enabled`, `next_run_at`, `last_run_at`, `last_error` (truncated).
- [x] Row navigates to detail view with full fields and **advanced** overrides visible (`latest_n`, `data_coordinate`, `data_vector_id`, fetch flags).
- [x] Uses existing API: `GET /statcan/schedules` (and PATCH/DELETE entry points as needed for later stories).
- [x] Typecheck passes.
- [x] Verify in browser using dev-browser skill.

---

### US-005: Guided schedule creation

**Description:** As an operator, I want a wizard to create a schedule by choosing a catalog product and cadence so that I do not need to memorize product IDs.

**Acceptance criteria:**

- [x] **Step 1:** Search or browse **StatCan cube catalog** (title + product id); user selects one product. *Requires backend support: paginated/search catalog API if not present — see Technical considerations.*
- [x] **Step 2:** Choose **frequency** (daily / weekly / monthly), **UTC hour/minute**, and frequency-specific fields (`day_of_week`, `day_of_month`) with inline validation messages matching API rules.
- [x] **Step 3 (optional):** Advanced collapsible: `latest_n`, coordinate, vector id, fetch toggles — defaults sensible.
- [x] **Step 4:** Review + **Create** calls `POST /statcan/schedules`; success navigates to detail or list; API errors shown to user.
- [x] Duplicate `product_id` surfaces **409** message clearly.
- [x] Typecheck passes.
- [x] Verify in browser using dev-browser skill.

---

### US-006: Edit, enable/disable, delete schedule (operators)

**Description:** As an operator, I want to update or remove schedules so that I can fix mistakes or pause ingestion.

**Acceptance criteria:**

- [x] Detail page supports **PATCH** for editable fields (not `product_id` after create).
- [x] **Enable/disable** toggle maps to `enabled` boolean.
- [x] **Delete** with confirmation dialog; calls `DELETE /statcan/schedules/:id`; handles 404.
- [x] Typecheck passes.
- [x] Verify in browser using dev-browser skill.

---

### US-007: Job runs list and detail (operators and viewers)

**Description:** As an operator or viewer, I want to browse job runs and open a run so that I can see pipeline status and (for operators) debug failures quickly.

**Acceptance criteria:**

- [x] Same UI for both roles (read-only); list uses `GET /job-runs` with filters for `job_name` and `status` where supported by API.
- [x] Detail uses `GET /job-runs/:id` showing all fields needed for triage (`started_at`, `finished_at`, `status`, `error_message`).
- [x] Link from failed run on Dashboard to this detail view.
- [x] Typecheck passes.
- [x] Verify in browser using dev-browser skill.

---

### US-008: Raw payloads browser (operators and viewers)

**Description:** As an operator or viewer, I want to list and open raw payloads to inspect ingested JSON without using curl.

**Acceptance criteria:**

- [x] List uses `GET /raw-payloads` with `source` filter and pagination params aligned with API (`limit`, `offset`).
- [x] List columns: `id`, `source`, `source_key`, `fetched_at`, `content_type`, `job_run_id` (link to job run when present).
- [x] Detail view shows **formatted JSON** (or pretty-printed text) for `body` plus metadata fields. *If API lacks `GET /raw-payloads/:id`, add it — see Technical considerations.*
- [x] Large bodies: lazy load or truncation with “expand” to avoid freezing the tab (reasonable default, e.g. first 50KB warning).
- [x] Typecheck passes.
- [x] Verify in browser using dev-browser skill.

---

### US-009: Viewer role restrictions

**Description:** As a viewer, I can see the Dashboard, job runs, and raw payloads (read-only) but cannot mutate schedules.

**Acceptance criteria:**

- [x] Viewer cannot access routes for schedule create/edit/delete (hidden + direct URL blocked).
- [x] Viewer **can** access `/jobs`, `/jobs/:id`, `/data`, `/data/:id` (read-only; no mutating actions).
- [x] Operator retains full access including schedules.
- [x] Documented matrix in spec.
- [x] Typecheck passes.
- [x] Verify in browser using dev-browser skill (both roles).

---

## Functional requirements

- **FR-1:** The system must provide a Vue SPA under `apps/web` configurable via `VITE_API_BASE_URL` (or equivalent) pointing at `apps/api`.
- **FR-2:** The system must implement a **Dashboard** route aggregating: (a) job run outcomes in a defined window, (b) recent failures with links, (c) schedule health summary.
- **FR-3:** Operators must **list, create (guided), update, and delete** StatCan schedules via UI using existing ` /statcan/schedules` endpoints.
- **FR-4:** Guided scheduling must include **catalog product discovery** (search/browse) backed by a **documented API** (extend `apps/api` if `statcan_cube_catalog` is not yet exposed).
- **FR-5:** Operators must **list and inspect job runs** via `GET /job-runs` and `GET /job-runs/:id`.
- **FR-6:** Operators must **list and inspect raw payloads** via `GET /raw-payloads` and a **by-id** read if not already available.
- **FR-7:** The system must enforce **viewer vs operator** in the **SPA** and align with **FR-10** when API keys are enabled.
- **FR-8:** All JSON error responses from the API must be surfaced to the user in a consistent error component (message + optional details).
- **FR-9:** UTC must be **labeled** on all schedule time fields (no silent local timezone).
- **FR-10:** When dashboard keys are set in env, the API must enforce **Bearer** authentication and **viewer vs operator** rules per **Resolved decisions**; schedule mutations and schedule reads must return **403** for viewer tokens.
- **FR-11:** Operators and viewers must be able to **browse and filter operational logs** (`GET /operations/logs`) and open a dedicated **Logs** route in the SPA; job run detail must surface **related logs** for that run. Canonical spec: [docs/specs/operational-logging/spec.md](../docs/specs/operational-logging/spec.md).

---

## Non-goals (out of scope for this PRD)

- Full **analytics dashboards** (trend charts, CPI/housing “insights,” cohort analysis).
- **Normalized** curated tables or SQL query UI for end users.
- **Multi-source** ingestion management beyond StatCan schedules (BoC, RSS) in the UI — future iteration.
- **Email/Slack** alerting — optional later.
- **Mobile-first** design (desktop-first is acceptable).
- Replacing **CLI/daemon**; they remain supported.

---

## Design considerations

- **IA:** `/dashboard` (all) · `/schedules`, `/schedules/new`, `/schedules/:id` (**operators only**) · `/jobs`, `/jobs/:id`, `/data`, `/data/:id`, `/logs` (**operators + viewers**, read-only).
- **Visual hierarchy:** failures and `last_error` use clear warning styling.
- **Vue:** Composition API, TypeScript, align with repo [`.cursor/skills/vue/SKILL.md`](../.cursor/skills/vue/SKILL.md) when implementing.

---

## Technical considerations

- **Existing API:** [`apps/api/src/server/app.ts`](../../apps/api/src/server/app.ts) — health, job-runs, raw-payloads, statcan schedules.
- **Gaps to close for v1 UX:**
  - **Catalog search/list** for guided scheduling: add e.g. `GET /statcan/catalog?query=&limit=&offset=` reading `statcan_cube_catalog` with safe FTS or `LIKE` on titles + `product_id` filter.
  - **Raw payload by id:** add `GET /raw-payloads/:id` returning one row (large `body` — consider optional `?truncate=`).
  - **Optional:** `GET /stats/summary?window=24h` returning pre-aggregated job counts for Dashboard performance (else client aggregates with documented limits).
- **CORS:** Enable CORS on API for dev origin when SPA runs on different port.
- **Security:** When `DASHBOARD_OPERATOR_KEY` / `DASHBOARD_VIEWER_KEY` are set (see Resolved decisions), API validates `Authorization: Bearer <token>` on mutating and sensitive read routes; health endpoints may stay public for load balancers. If **no** dashboard keys are set, middleware is a no-op for backward-compatible local dev (document loudly in README).

---

## Success metrics

- **Schedule visibility:** Operator can answer “what is scheduled for product X and when is next run?” in **under 30 seconds** from opening the app (task-based usability test).
- **Incident detection:** A failed ingestion run is visible on Dashboard or job list **without SSH/logs** within **1 minute** of refresh (process metric).
- **Adoption:** Operators prefer console for schedule changes over raw API (qualitative check after 2 weeks).

---

## Resolved decisions (was: open questions)

These are **defaults for v1**; change via a spec amendment if product direction shifts.

1. **Auth (v1)**  
   - **API:** Optional env **`DASHBOARD_OPERATOR_KEY`** and **`DASHBOARD_VIEWER_KEY`** (both optional, independent). If **either** is set, protected routes require header `Authorization: Bearer <key>` matching one of the configured keys. Middleware derives **role**: operator key → full access; viewer key → read-only (schedules endpoints return 403). If **neither** is set, auth middleware is **disabled** (local dev / legacy).  
   - **SPA:** Login screen collects the token (stored in `sessionStorage`); attach header on every API call.  
   - **Future:** Replace with JWT/OIDC in a dedicated “API auth” epic; **owner:** platform / repo maintainers.  
   - **Deploy note:** Schedule CRUD requires **`DASHBOARD_OPERATOR_KEY`** to be set; viewer-only deployments may use only `DASHBOARD_VIEWER_KEY` (read-only console).

2. **Viewer access to data**  
   - **Yes:** Viewers may use **read-only** `/jobs`, `/jobs/:id`, `/data`, `/data/:id` in addition to Dashboard.  
   - **No** access to any `/statcan/schedules` route (list/create/edit).

3. **Dashboard time windows**  
   - **KPI counts (success / failed / total finished):** rolling **`finished_at` in last 24 hours, UTC**.  
   - **“Recent failures” list:** up to **15** rows, **failed** status only, **`finished_at` DESC** (no extra time filter so incidents stay visible).

4. **Catalog search (`GET /statcan/catalog`)**  
   - Query param **`q`** (optional): if `q` is an integer string, match **`product_id = q`**. Otherwise **`LIKE %q%`** (case-insensitive) on **`cube_title_en` OR `cube_title_fr`**.  
   - **`limit`** default 25, max 100; **`offset`** for pagination.

5. **Hosting**  
   - **Preferred production:** single **reverse proxy** origin (e.g. `https://console.example.com/`) — static files for `/`, API under **`/api`** (or subdomain pattern documented in deploy runbook). Avoids CORS complexity and keeps cookies/headers simple if upgraded later.  
   - **Acceptable:** SPA on separate static host + CORS allowlist + Bearer token (same auth model).  
   - **Dev:** Vite dev server + API on another port with **CORS** for `http://localhost:5173` (or configured Vite port).

---

## Clarifying questions (PRD skill — pre-filled from session)

| # | Question | Answer used |
|---|-----------|-------------|
| 1 | Primary goal | Faster schedule visibility + faster incident detection |
| 2 | Target users | Operators (full); Leadership / viewers (Dashboard + read-only jobs & data) |
| 3 | Scope | Control plane + minimal data preview; guided scheduling; Vue |
| 4 | Data table | Raw payload as-is + JSON viewer + key fields |
| 5 | IA | One app: Dashboard for all; operators get Schedules/Jobs/Data |

---

## Checklist (author)

- [x] Clarifying inputs incorporated
- [x] User stories small and testable
- [x] Functional requirements numbered
- [x] Non-goals explicit
- [x] Open questions **resolved** (see § Resolved decisions)
- [x] Saved to `tasks/prd-web-ops-console.md`
