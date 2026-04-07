# PRD: StatCan bulk and incremental dataset ingestion

> **Checklist authority:** For spec-driven delivery ([AGENTS.md](../../AGENTS.md)), **`docs/specs/statcan-bulk-dataset-ingestion/tasks.md` is canonical** for implementation status. This PRD is the stakeholder contract; **keep story/FR checkboxes aligned** with that `tasks.md`. Technical detail: [spec.md](../specs/statcan-bulk-dataset-ingestion/spec.md), [plan.md](../specs/statcan-bulk-dataset-ingestion/plan.md). Source notes: [tasks/full-load.md](../../tasks/full-load.md). Related: [statcan-wds-operator-ux](../specs/statcan-wds-operator-ux/spec.md), [statcan-wds-automation](../specs/statcan-wds-automation/spec.md).

## Introduction / overview

**Problem:** The platform today leans heavily on [StatCan WDS](https://www.statcan.gc.ca/en/developers/wds) for **granular** (vector-level) pulls. StatCan positions WDS for **small/discrete** updates, while **full-table CSV** and **delta** mechanisms suit **bulk** loads and **large-scale incremental** pipelines. The product must **shift** toward **dataset lifecycle management**: bulk-first load per ProductID, then **efficient refresh** using change detection and full reload (MVP), not vector-by-vector queries for large tables.

**Product outcome:** Operators **select multiple catalog datasets (ProductIDs)**, persist them as a **tracked set**, run an **initial full-table download**, then on a **user-defined cadence** run **change detection** and **re-download full table** when StatCan signals the cube changed—plus **manual refresh**, **clear status**, and **observable** runs in the ops console.

---

## Goals

- **Bulk-first:** For each tracked ProductID without a successful full load, download a **complete** dataset (CSV path per technical spec: WDS full-table and/or official zip—see spec).
- **Incremental (MVP):** **Option A** — `getChangedCubeList/{date}`; if ProductID appears, **re-download full table** (no delta merge in MVP).
- **Scheduling:** Daily / weekly / monthly (UTC per existing platform conventions).
- **Multi-product:** Select **multiple** ProductIDs; persist **tracked collection** (see spec for collection model).
- **State:** Per-ProductID **metadata** (last download, last change check, status, next run).
- **Reliability:** Idempotent storage, retries, bounded parallelism for **dozens** of datasets.

---

## Non-goals (MVP)

- **Delta File** pipeline (download daily delta, filter by ProductID, merge) — **Phase 2** (see spec).
- **Parquet lake / S3 / Databricks** as required production paths — **Phase 2+** unless spec explicitly adds a minimal path.
- Replacing **all** WDS vector workflows — existing schedules and series-level use cases remain valid in parallel.
- **Analytics dashboards** on curated series — separate epic.

---

## Personas

| Persona | Needs |
|--------|--------|
| **Operator** | Onboard datasets quickly; see status; trigger refresh; configure cadence. |
| **Viewer** | Read-only status and job history where RBAC allows. |
| **Platform engineer** | Testable jobs, fixtures, clear boundaries vs [normalization-curated-layer](../specs/normalization-curated-layer/spec.md). |

---

## User stories

### US-001: Multi-select catalog and persist tracked datasets

**Description:** As an **operator**, I want to **search the StatCan catalog** and **select multiple ProductIDs** so they are **tracked** for bulk ingestion.

**Acceptance criteria:**

- [x] Catalog UI supports **search/filter** and shows **title**, **frequency**, **last release** (fields available from catalog/API).
- [x] Operator can **add** ProductIDs to the tracked set (with validation against catalog when indexed).
- [x] Tracked rows persist in the system (see spec); duplicate ProductID is rejected or idempotent per spec.
- [x] Typecheck/tests for touched packages.

---

### US-002: Initial full load per ProductID

**Description:** As an **operator**, I want each new tracked ProductID to **download a full table** once so local raw storage has the **complete** dataset.

**Acceptance criteria:**

- [x] If no successful full load exists for that ProductID, job/API performs **full download** per spec (channel: WDS and/or zip).
- [x] Payload stored in **`raw_payloads`** (or spec-defined storage) with **idempotent** keys.
- [x] **State** updated: `last_downloaded_at`, status.
- [x] Fixture-based tests; no live StatCan in CI.

---

### US-003: Scheduled incremental path (change detection + full reload)

**Description:** As an **operator**, I want **scheduled runs** that **check** StatCan for cube changes and **re-download the full table** only when needed.

**Acceptance criteria:**

- [x] Job uses **`getChangedCubeList`** for the configured date (UTC) per spec.
- [x] If ProductID **in** changed list → **full table** re-download; if not → skip data fetch, still advance **last_checked_at**.
- [x] **Parallelism** bounded (config/env); **retries** on transient failures.
- [x] Operational logs / job runs sufficient for triage.

---

### US-004: Manual “Refresh now”

**Description:** As an **operator**, I want to **force a refresh** for one or more tracked datasets without waiting for the schedule.

**Acceptance criteria:**

- [x] Operator action triggers **same** ingest path as scheduled run (or documented override, e.g. always full reload).
- [x] UI/API errors are readable.

---

### US-005: Dataset management UI

**Description:** As an **operator**, I want a **management** view per tracked dataset: **status**, **last updated**, **next run**, **Refresh now**.

**Acceptance criteria:**

- [x] List or table shows required fields per Goals.
- [x] Matches existing **web ops** auth (operator vs viewer).
- [ ] Browser verification when UI ships.

---

## Functional requirements

- **FR-1:** System persists a **tracked dataset** record per ProductID (and optional grouping per spec) with schedule fields and status enum.
- **FR-2:** **Initial load** runs when tracked and no full load recorded (per spec).
- **FR-3:** **Incremental MVP** implements **Option A** only (changed cube list → conditional full re-download).
- **FR-4:** **Scheduling** integrates with platform job/daemon patterns (`job_runs`, optional new job name per spec).
- **FR-5:** **REST API** (operator RBAC) for CRUD of tracked datasets + optional **refresh** action.
- **FR-6:** **Idempotency:** repeated runs do not corrupt lineage; `(source, sha256)` or equivalent documented in spec.

---

## Non-functional requirements

- **NFR-1:** Support **parallel** processing of multiple ProductIDs with a **documented** concurrency limit.
- **NFR-2:** **Idempotent** ingestion and safe retries after partial failure.
- **NFR-3:** Scale target: **dozens** of tracked datasets without manual sharding.
- **NFR-4:** No dependency on **live** StatCan in automated tests (fixtures/mocks).

---

## Assumptions

- StatCan **WDS** and **public CSV/zip** endpoints remain available with documented rate/availability behavior.
- **Operators** accept **full reload on change** (Option A) for MVP instead of delta merge.

---

## Dependencies

- Existing **catalog** (`statcan_cube_catalog`) and indexing jobs.
- Existing **WDS client** and routes (extend as needed per spec).
- **Web ops console** auth and layout patterns.

---

## Risks

| Risk | Mitigation |
|------|------------|
| Large ZIP/CSV downloads | Timeouts, streaming, disk quotas; chunked retries |
| Schema drift in CSV | Raw preserve + normalization epic |
| WDS vs zip ambiguity | Single **ADR** in spec for MVP channel |
| Overlap with per-product `statcan_product_schedules` | Explicit spec: new tables vs migration path |

---

## Success metrics (from product brief)

- Operators can **onboard** a dataset in **under one minute** (happy path, catalog already indexed).
- **Unattended** scheduled updates without manual CLI for routine operation.
- **Fewer** redundant vector-level calls for bulk-oriented datasets.
- Data remains **consistent** and **traceable** via `raw_payloads` and job history.

---

## Rollout considerations

- **Phase 1:** Tracked datasets + full load + changed-cube incremental + schedule + API + minimal UI.
- **Phase 2:** Delta File + Parquet/object storage — **gated** in spec/architecture.

---

## Open questions

1. **Named pipelines vs single list:** Resolved in **spec.md** (MVP recommendation: one table, optional `collection_label` later).
2. **Zip vs WDS CSV:** Resolved in **spec.md** (primary path for MVP).
3. **Coexistence** with `statcan_product_schedules` for same ProductID — spec defines precedence or mutual exclusion.

---

## Related documents

- [tasks/full-load.md](../../tasks/full-load.md) (PM capture)
- [Statistics Canada WDS user guide](https://www.statcan.gc.ca/en/developers/wds/user-guide)
