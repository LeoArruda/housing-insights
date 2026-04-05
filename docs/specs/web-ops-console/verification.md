# Verification log: Web operations console

Manual browser checks should follow the PRD user stories ([tasks/prd-web-ops-console.md](../../../tasks/prd-web-ops-console.md) US-003–009) and the scenarios in [spec.md](./spec.md). Use the dev-browser skill when an interactive pass is required.

## Runs

### 2026-04-03 — Post-foundation alignment (automated + static)

**Environment:** local repo; no live browser session in this run.

| Check | Result |
|--------|--------|
| `cd apps/web && bun run typecheck` | Pass |
| `cd apps/web && bun run build` | Pass |
| `cd apps/web && bun test` | Pass |
| **FR-8** — API errors: `ApiHttpError` in `apps/web/src/api/client.ts`; `formatApiError` used on schedule wizard/detail; list/detail views use `role="alert"` on user-visible error lines | Spot-check pass (code review) |
| **FR-9** — UTC labeled on schedule surfaces: `SchedulesListView`, `ScheduleWizardView`, `ScheduleDetailView`; Dashboard subline “Last 24h (UTC)” | Spot-check pass (grep / code review) |

**Manual browser regression (recommended before each release):**

1. **US-003 / US-Dashboard:** Open `/dashboard`; confirm KPI copy references 24h UTC; recent failures link to `/jobs/:id`.
2. **US-004–006:** Operator: schedules list → detail → PATCH/toggle → delete confirm; wizard create flow; duplicate product shows API error text.
3. **US-007:** Jobs list filters; job detail fields for triage.
4. **US-008:** Raw payloads list pagination/source filter; detail JSON; large-body warning if applicable.
5. **US-009 / RBAC:** Log in as **viewer** (viewer key): Schedules hidden; direct `/schedules` blocked; `/jobs` and `/data` work. Log in as **operator**: schedules available.

### 2026-04-03 — Agent governance and spec enforcement (documentation)

| Check | Result |
|--------|--------|
| [AGENTS.md](../../../AGENTS.md) — documentation hierarchy, agent boundaries table, Definition of Done includes `tasks.md` / `verification.md` / PRD sync | Recorded |
| [.cursor/rules/spec-driven-delivery.mdc](../../../.cursor/rules/spec-driven-delivery.mdc) — `alwaysApply: true` Cursor rule | Recorded |
| [.cursor/agents/](../../../.cursor/agents/) — orchestrator, frontend, backend, QA, architect, product-scope, security-auditor aligned to this repo | Recorded |

### 2026-04-05 — Operational logs (FR-11)

| Check | Result |
|--------|--------|
| `cd apps/api && bun test` (includes `GET /operations/logs`) | Pass |
| `cd apps/web && bun run typecheck` | Pass |
| **FR-11** — `/logs` route, job detail “Related operational logs”; API `GET /operations/logs` | Automated + static (browser pass optional) |
