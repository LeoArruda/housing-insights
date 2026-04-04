# PRD: Web operations console (Vue)

## Introduction / overview

Operators and leadership need a **browser-based console** on top of the existing ingestion platform (`apps/api`). Today scheduling, job history, and raw payloads are reachable only via REST (no auth) and CLI/daemon. This feature delivers a **Vue 3** app with:

- A **Dashboard** visible to all authenticated users (leadership + operators), focused on **pipeline health** and **incident signals**.
- **Operator-only** areas: **guided creation/editing of StatCan product schedules**, **job run inspection**, and a **read-only raw payload browser** (metadata + JSON body).

**Problem solved:** Slow visibility into what is scheduled, what failed, and what was ingested; reduces reliance on logs and ad-hoc API calls. **Success:** faster schedule overview and faster failure detection.

**Stakeholder inputs incorporated (brainstorm):** Control plane + minimal data preview before analytics charts; guided scheduling; raw JSON viewer + key fields; Vue; one app with shared Dashboard + operator pages; raw payloads as-is for v1 data view.

---

## Goals

- Provide a **single place** to see **enabled schedules**, **next/last run**, and **last error** per StatCan product schedule.
- Provide a **Dashboard** with **operational KPIs** (job success/fail counts, recent failures, schedule counts) without building a full analytics product.
- Enable **guided schedule creation** (pick product from catalog, choose cadence/time UTC, optional advanced overrides).
- Enable **read-only exploration** of `raw_payloads` (list + detail with formatted JSON + key columns).
- Establish **role differentiation**: at minimum **viewer** (Dashboard + optional read-only data) vs **operator** (schedules CRUD + full job/payload views).
- **Do not** implement rich charting, normalized time-series exploration, or multi-source ingestion UI beyond StatCan in v1 (see Non-goals).

---

## User stories

### US-001: Vue app scaffold and API client

**Description:** As a developer, I want a runnable Vue 3 + TypeScript app under `apps/web` so that the UI can call the existing API with a shared config base URL.

**Acceptance criteria:**

- [ ] `apps/web` runs with `bun`/`vite` (or repo-standard script documented in README).
- [ ] Central API base URL from env (e.g. `VITE_API_BASE_URL`).
- [ ] Typecheck/lint passes for the new package.

---

### US-002: Authentication shell (minimal)

**Description:** As an operator, I want the app to be protected by a minimal auth gate so that the console is not wide open on the public internet.

**Acceptance criteria:**

- [ ] Unauthenticated users cannot access operator routes or Dashboard (redirect to login or static “unauthorized”).
- [ ] Auth mechanism documented (e.g. static API key header, session cookie via future backend, or reverse-proxy basic auth) — **exact choice recorded in spec Open Questions if not decided**.
- [ ] Role claim or config distinguishes **viewer** vs **operator** (even if v1 uses env or hardcoded mock for local dev).
- [ ] Typecheck passes.

---

### US-003: Dashboard (all roles)

**Description:** As leadership or an operator, I want a Dashboard that surfaces pipeline health so that I can notice failures and activity without reading logs.

**Acceptance criteria:**

- [ ] Shows **counts** of job runs in a defined window (e.g. last 24h or last 50 runs — **exact definition in spec**) broken down by **success** vs **failed** (and **running** if available from data).
- [ ] Shows **recent failed** job runs with job name, finished time, and error snippet (truncated) linking to detail.
- [ ] Shows **schedule summary**: count of enabled schedules, count with `last_error` non-null (or equivalent “needs attention”).
- [ ] Layout is readable on desktop (mobile optional).
- [ ] Typecheck passes.
- [ ] Verify in browser using dev-browser skill.

---

### US-004: Schedules list and detail (operators)

**Description:** As an operator, I want to list and open StatCan product schedules so that I can see cadence, next run, and errors.

**Acceptance criteria:**

- [ ] Table (or cards) listing schedules with: `product_id`, `frequency`, UTC time fields, `enabled`, `next_run_at`, `last_run_at`, `last_error` (truncated).
- [ ] Row navigates to detail view with full fields and **advanced** overrides visible (`latest_n`, `data_coordinate`, `data_vector_id`, fetch flags).
- [ ] Uses existing API: `GET /statcan/schedules` (and PATCH/DELETE entry points as needed for later stories).
- [ ] Typecheck passes.
- [ ] Verify in browser using dev-browser skill.

---

### US-005: Guided schedule creation

**Description:** As an operator, I want a wizard to create a schedule by choosing a catalog product and cadence so that I do not need to memorize product IDs.

**Acceptance criteria:**

- [ ] **Step 1:** Search or browse **StatCan cube catalog** (title + product id); user selects one product. *Requires backend support: paginated/search catalog API if not present — see Technical considerations.*
- [ ] **Step 2:** Choose **frequency** (daily / weekly / monthly), **UTC hour/minute**, and frequency-specific fields (`day_of_week`, `day_of_month`) with inline validation messages matching API rules.
- [ ] **Step 3 (optional):** Advanced collapsible: `latest_n`, coordinate, vector id, fetch toggles — defaults sensible.
- [ ] **Step 4:** Review + **Create** calls `POST /statcan/schedules`; success navigates to detail or list; API errors shown to user.
- [ ] Duplicate `product_id` surfaces **409** message clearly.
- [ ] Typecheck passes.
- [ ] Verify in browser using dev-browser skill.

---

### US-006: Edit, enable/disable, delete schedule (operators)

**Description:** As an operator, I want to update or remove schedules so that I can fix mistakes or pause ingestion.

**Acceptance criteria:**

- [ ] Detail page supports **PATCH** for editable fields (not `product_id` after create).
- [ ] **Enable/disable** toggle maps to `enabled` boolean.
- [ ] **Delete** with confirmation dialog; calls `DELETE /statcan/schedules/:id`; handles 404.
- [ ] Typecheck passes.
- [ ] Verify in browser using dev-browser skill.

---

### US-007: Job runs list and detail (operators)

**Description:** As an operator, I want to browse job runs and open a run so that I can debug failures quickly.

**Acceptance criteria:**

- [ ] List uses `GET /job-runs` with filters for `job_name` and `status` where supported by API.
- [ ] Detail uses `GET /job-runs/:id` showing all fields needed for triage (`started_at`, `finished_at`, `status`, `error_message`).
- [ ] Link from failed run on Dashboard to this detail view.
- [ ] Typecheck passes.
- [ ] Verify in browser using dev-browser skill.

---

### US-008: Raw payloads browser (operators; viewers optional)

**Description:** As an operator, I want to list and open raw payloads to inspect ingested JSON without using curl.

**Acceptance criteria:**

- [ ] List uses `GET /raw-payloads` with `source` filter and pagination params aligned with API (`limit`, `offset`).
- [ ] List columns: `id`, `source`, `source_key`, `fetched_at`, `content_type`, `job_run_id` (link to job run when present).
- [ ] Detail view shows **formatted JSON** (or pretty-printed text) for `body` plus metadata fields. *If API lacks `GET /raw-payloads/:id`, add it — see Technical considerations.*
- [ ] Large bodies: lazy load or truncation with “expand” to avoid freezing the tab (reasonable default, e.g. first 50KB warning).
- [ ] Typecheck passes.
- [ ] Verify in browser using dev-browser skill.

---

### US-009: Viewer role restrictions

**Description:** As a viewer, I can see the Dashboard (and optionally payload list) but cannot mutate schedules.

**Acceptance criteria:**

- [ ] Viewer cannot access routes for schedule create/edit/delete (hidden + direct URL blocked).
- [ ] Operator retains full access.
- [ ] Documented matrix in spec.
- [ ] Typecheck passes.
- [ ] Verify in browser using dev-browser skill (both roles).

---

## Functional requirements

- **FR-1:** The system must provide a Vue SPA under `apps/web` configurable via `VITE_API_BASE_URL` (or equivalent) pointing at `apps/api`.
- **FR-2:** The system must implement a **Dashboard** route aggregating: (a) job run outcomes in a defined window, (b) recent failures with links, (c) schedule health summary.
- **FR-3:** Operators must **list, create (guided), update, and delete** StatCan schedules via UI using existing ` /statcan/schedules` endpoints.
- **FR-4:** Guided scheduling must include **catalog product discovery** (search/browse) backed by a **documented API** (extend `apps/api` if `statcan_cube_catalog` is not yet exposed).
- **FR-5:** Operators must **list and inspect job runs** via `GET /job-runs` and `GET /job-runs/:id`.
- **FR-6:** Operators must **list and inspect raw payloads** via `GET /raw-payloads` and a **by-id** read if not already available.
- **FR-7:** The system must enforce **viewer vs operator** capabilities at the UI; v1 may rely on simple role claim — production must align with API auth when added.
- **FR-8:** All JSON error responses from the API must be surfaced to the user in a consistent error component (message + optional details).
- **FR-9:** UTC must be **labeled** on all schedule time fields (no silent local timezone).

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

- **IA:** `/dashboard` (all) · `/schedules`, `/schedules/new`, `/schedules/:id` (operators) · `/jobs`, `/jobs/:id` (operators) · `/data`, `/data/:id` (operators; viewers optional for list only).
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
- **Security:** v1 API is unauthenticated today — **deployment** must place API + UI behind network controls until API auth ships; PRD assumes auth story in US-002.

---

## Success metrics

- **Schedule visibility:** Operator can answer “what is scheduled for product X and when is next run?” in **under 30 seconds** from opening the app (task-based usability test).
- **Incident detection:** A failed ingestion run is visible on Dashboard or job list **without SSH/logs** within **1 minute** of refresh (process metric).
- **Adoption:** Operators prefer console for schedule changes over raw API (qualitative check after 2 weeks).

---

## Open questions

1. **Auth:** API key in header vs future JWT vs SSO — who owns decision and timeline?
2. **Viewer access to raw payloads:** Allowed read-only list/detail or Dashboard-only?
3. **Dashboard window:** Fixed 24h vs configurable vs “last N runs”?
4. **Catalog search:** Minimum viable filter set (text on EN title only vs FR + product_id exact)?
5. **Hosting:** Same origin reverse proxy vs separate static host for `apps/web`?

---

## Clarifying questions (PRD skill — pre-filled from session)

| # | Question | Answer used |
|---|-----------|-------------|
| 1 | Primary goal | Faster schedule visibility + faster incident detection |
| 2 | Target users | Operators (full); Leadership (Dashboard) |
| 3 | Scope | Control plane + minimal data preview; guided scheduling; Vue |
| 4 | Data table | Raw payload as-is + JSON viewer + key fields |
| 5 | IA | One app: Dashboard for all; operators get Schedules/Jobs/Data |

---

## Checklist (author)

- [x] Clarifying inputs incorporated
- [x] User stories small and testable
- [x] Functional requirements numbered
- [x] Non-goals explicit
- [x] Saved to `tasks/prd-web-ops-console.md`
