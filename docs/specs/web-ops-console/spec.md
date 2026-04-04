# Feature specification: Web operations console (Vue)

**Feature**: `web-ops-console`  
**Status**: Draft  
**Date**: 2026-04-03  
**Related PRD**: [tasks/prd-web-ops-console.md](../../../tasks/prd-web-ops-console.md)

## Summary

Deliver a **Vue 3** operations console for the housing-insights API: **Dashboard** (all roles), **StatCan schedule management** with **guided creation** (operators), **job run** inspection (operators), and **raw payload** list + JSON detail (operators). Aligns with backend tables `job_runs`, `raw_payloads`, `statcan_product_schedules`, and `statcan_cube_catalog`.

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

**Independent test:** Log in as viewer; hit `/schedules/new`; expect redirect or 403-style empty state.

## Functional requirements

- **FR-1:** Vue app under `apps/web`; API base URL from environment.
- **FR-2:** Dashboard implements KPIs defined in PRD Success metrics section.
- **FR-3:** Guided schedule flow: catalog pick → cadence → optional advanced → create.
- **FR-4:** Backend exposes **catalog search/list** endpoint if not present (see plan).
- **FR-5:** Backend exposes **GET raw-payloads by id** if not present.
- **FR-6:** Viewer cannot mutate schedules (UI + documented future API alignment).

## Non-goals

- Analytics charts beyond operational counts; normalized data exploration; multi-source UI.

## Dependencies

- `apps/api` read/write routes for schedules, job runs, raw payloads.
- Optional aggregate endpoint for Dashboard performance.

## Out of scope / future

- API authentication hardening (tracked separately).
- BoC/RSS schedule UI when those models exist.
