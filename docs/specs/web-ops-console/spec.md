# Feature specification: Web operations console (Vue)

**Feature**: `web-ops-console`  
**Status**: Draft  
**Date**: 2026-04-03  
**Related PRD**: [docs/prds/prd-web-ops-console.md](../../prds/prd-web-ops-console.md)

## Implementation tracking (canonical)

For **AGENTS.md** spec-driven delivery:

- **[tasks.md](./tasks.md)** is the **canonical** checklist for implementation status (backend, frontend, features, quality). Agents should update `tasks.md` when work completes.
- **[verification.md](./verification.md)** records verification runs (automated commands, code-level spot checks for PRD FR-* items, and manual browser notes when performed).
- The **PRD** ([docs/prds/prd-web-ops-console.md](../../prds/prd-web-ops-console.md)) remains the stakeholder-facing product contract; its per-story checkboxes are **kept in sync** with `tasks.md` when features ship so both views stay aligned.
- Repo-wide enforcement: [AGENTS.md](../../../AGENTS.md) (**Documentation hierarchy**, **Agent boundaries**, **Definition of Done**) and Cursor rule [.cursor/rules/spec-driven-delivery.mdc](../../../.cursor/rules/spec-driven-delivery.mdc) (**alwaysApply**).

## Summary

Deliver a **Vue 3** operations console for the housing-insights API: **Dashboard** (all roles), **StatCan schedule management** with **guided creation** (**operators only**), **job run** inspection (**operators + viewers**), and **raw payload** list + JSON detail (**operators + viewers**). Aligns with backend tables `job_runs`, `raw_payloads`, `statcan_product_schedules`, and `statcan_cube_catalog`.

## Resolved decisions

| Topic | Decision |
|--------|-----------|
| **Auth v1** | Optional env `DASHBOARD_OPERATOR_KEY` and `DASHBOARD_VIEWER_KEY`. If either is set, client sends `Authorization: Bearer <token>`. API maps token to role; **viewer** cannot call `/statcan/schedules` (403). If neither key is set, auth middleware **off** (local dev). **Future:** JWT/OIDC epic. |
| **Viewer data access** | Viewers: Dashboard + `/jobs` + `/data` (read-only). No schedule routes. |
| **Dashboard KPI window** | Counts: `finished_at` in **last 24h UTC**. Recent failures: **15** rows, `status=failed`, `finished_at DESC` (any age). |
| **Catalog search** | `q` integer → `product_id` match; else case-insensitive `LIKE` on `cube_title_en` **or** `cube_title_fr`. `limit` default 25, max 100. |
| **Hosting** | **Preferred:** one origin, proxy `/api` → Bun, `/` → static SPA. **Alt:** separate static host + CORS. **Dev:** CORS for Vite origin. |

### Route × role matrix

| Route | Viewer | Operator |
|-------|--------|----------|
| `/dashboard` | yes | yes |
| `/schedules*` | no | yes |
| `/jobs`, `/jobs/:id` | read-only | yes |
| `/logs` | read-only | yes |
| `/data`, `/data/:id` | read-only | yes |

## User scenarios and testing

### US-Dashboard — Operational overview (P1)

**Independent test:** With seeded DB, open Dashboard; assert KPI numbers match SQL counts for the same window.

**Acceptance scenarios:**

1. **Given** job runs with mixed status in the last 24h, **when** Dashboard loads, **then** success and failed counts match repository totals for that window.
2. **Given** at least one failed run, **when** Dashboard loads, **then** it appears in “recent failures” with link to job detail.
3. **Given** schedules with and without `last_error`, **when** Dashboard loads, **then** “attention” count reflects schedules with non-null `last_error` (or documented rule).

### US-Schedules — CRUD and guided create (P1)

**Independent test:** Create schedule via wizard; assert row in DB and API `GET` returns same fields.

**Acceptance scenarios:**

1. **Given** catalog contains product 34100096, **when** operator completes guided flow with daily 06:00 UTC, **then** `POST /statcan/schedules` succeeds and UI shows new row.
2. **Given** duplicate `product_id`, **when** operator submits, **then** UI shows 409 message from API.
3. **Given** weekly frequency, **when** operator omits `day_of_week`, **then** client validation blocks submit with message matching API rules.
4. **Given** existing schedule, **when** operator disables it, **then** `PATCH` sets `enabled` false and tick job skips it (`next_run_at` logic unchanged until re-enabled).

### US-Jobs — Triage (P2)

**Independent test:** Filter list by `status=failed`; open detail; assert `error_message` visible.

### US-Data — Raw payload inspection (P2)

**Independent test:** List payloads; open one; assert JSON pretty-print and metadata.

**Acceptance scenarios:**

1. **Given** a raw_payload row, **when** operator opens detail, **then** `body` is valid pretty JSON when `content_type` is JSON.
2. **Given** payload over size threshold, **when** operator opens detail, **then** UI warns or truncates per PRD without freezing.

### US-RBAC — Roles (P1)

**Independent test:** Log in with **viewer** token; hit `/schedules/new` → blocked; hit `/jobs` → OK; `GET /statcan/schedules` via API → 403. **Operator** token → schedules OK.

## Functional requirements

- **FR-1:** Vue app under `apps/web`; API base URL from environment.
- **FR-2:** Dashboard implements KPIs defined in PRD Success metrics section.
- **FR-3:** Guided schedule flow: catalog pick → cadence → optional advanced → create.
- **FR-4:** Backend exposes **catalog search/list** endpoint if not present (see plan).
- **FR-5:** Backend exposes **GET raw-payloads by id** if not present.
- **FR-6:** Viewer cannot read or mutate schedules (UI blocks routes; API returns **403** on `/statcan/schedules` when Bearer is viewer key).
- **FR-8 (PRD):** API errors surfaced in the UI via `ApiHttpError` / `formatApiError` and `role="alert"` on error copy (shared client in `apps/web/src/api/client.ts`).
- **FR-9 (PRD):** Schedule-related copy and columns **label UTC** (list, wizard, detail); Dashboard window labeled **24h (UTC)**.

## Non-goals

- Analytics charts beyond operational counts; normalized data exploration; multi-source UI.

## Dependencies

- `apps/api` read/write routes for schedules, job runs, raw payloads.
- Optional aggregate endpoint for Dashboard performance.

## Out of scope / future

- **SSO / enterprise IdP** (OIDC) — out of scope for v1; Bearer keys only.
- BoC/RSS schedule UI when those models exist.
