# PRD: StatCan WDS operator-friendly series selection and ingestion modes

> **Checklist authority:** For spec-driven delivery ([AGENTS.md](../AGENTS.md)), **`docs/specs/statcan-wds-operator-ux/tasks.md` is canonical** for implementation status. This PRD remains the stakeholder contract; **keep story/FR checkboxes aligned** with that `tasks.md`. Technical detail: [spec.md](../docs/specs/statcan-wds-operator-ux/spec.md), [plan.md](../docs/specs/statcan-wds-operator-ux/plan.md). Builds on [statcan-wds-automation](../docs/specs/statcan-wds-automation/).

## Introduction / overview

**Problem:** StatCan [Web Data Service (WDS)](https://www.statcan.gc.ca/en/developers/wds/user-guide) ingestion today requires operators to supply a **`data_vector_id`** and/or **`data_coordinate`** when scheduling pulls. Those identifiers are **internal WDS concepts** (numeric vector id; dot-separated **coordinate** string built from dimension **member** ids). Operators reason in **table titles, geographies, and indicators**, not raw coordinates—so schedule creation is error-prone and support-heavy.

**Problem:** WDS exposes several **data access patterns** (“changes today,” “changes over time,” “latest N periods,” “bulk/range,” “full table download”). The platform currently uses **metadata** and **latest-N** style pulls ([`wds-routes.ts`](../apps/api/src/connectors/statcan/wds-routes.ts)); it does **not** yet productize **incremental** (changed-series) or **one-time full/backfill** flows in the UI and job model.

**Product outcome:** Operators can **discover and confirm a series** without hand-entering vector/coordinate strings, choose an **ingestion strategy** appropriate to the use case (e.g. rolling latest vs incremental vs historical backfill), and **see** what mode ran in the ops console.

---

## Goals

- Eliminate **manual entry** of `data_coordinate` / `data_vector_id` as the default path for schedule creation.
- Align the integration **strategy** with WDS capabilities described in the [user guide](https://www.statcan.gc.ca/en/developers/wds/user-guide): inventory/discovery, **changed** series/cubes, **latest N**, **range/bulk**, and optional **full-table** extracts where justified.
- Support a **clear operator mental model**: pick **product → series (slice) → cadence → ingest mode** (with sensible defaults).
- Preserve **reliability**: idempotent jobs, respect rate limits and WDS availability windows documented by StatCan.
- **Do not** replace the data platform’s normalized analytics layer in this PRD (see Non-goals).

---

## Personas

| Persona | Needs |
|--------|--------|
| **Operator** | Create/edit schedules without WDS expertise; troubleshoot failed runs. |
| **Viewer** | Read schedules and job history (existing RBAC); no requirement to create series UI. |
| **Platform engineer** | Maintainable connectors, tests with fixtures, documented WDS method usage. |

---

## User stories

### US-001: Discover series from cube metadata (operator)

**Description:** As an **operator**, I want to **select a data series using cube metadata** (dimensions/members or search) so that I **never need to paste a raw coordinate** for the common case.

**Acceptance criteria:**

- [ ] After choosing a **product_id** (from catalog), the UI loads **series discovery** backed by WDS **`getCubeMetadata`** (and optionally **`getSeriesInfoFromCubePidCoord`** / **`getSeriesInfoFromVector`** for validation).
- [ ] Operator can **confirm** a series with visible **English/French titles** (or StatCan fields available in responses) before saving.
- [ ] On save, the system persists **`data_coordinate`** and/or **`data_vector_id`** as resolved by the flow (not empty when “fetch data” is on).
- [ ] API validates schedule payloads; errors are **user-readable** (no raw WDS jargon only).
- [ ] Typecheck/tests pass for touched packages.

---

### US-002: Ingest mode selection on schedules (operator)

**Description:** As an **operator**, I want to choose **how** data is pulled (e.g. **latest N periods** vs **incremental/changed** vs **one-time range/backfill**) so that **ongoing** schedules are efficient and **historical** loads are explicit.

**Acceptance criteria:**

- [ ] Schedule model exposes an **`ingest_mode`** (exact enum TBD in spec) with at least: **`latest_n`** (current behavior), and placeholders or implementation for **`changed_since`** / **`bulk_range`** as phased in engineering plan.
- [ ] UI explains each mode in plain language and links to **UTC** / release expectations where relevant.
- [ ] Job runs record enough metadata for triage (which mode, date window if applicable).
- [ ] Typecheck/tests pass.

---

### US-003: Incremental ingestion via WDS “changed” APIs (platform)

**Description:** As a **platform**, I want to optionally ingest **only series/cubes that changed** on a schedule so that we **align with WDS** “changes today / over time” and reduce redundant pulls.

**Acceptance criteria:**

- [ ] Backend implements WDS **`getChangedSeriesList`** / **`getChangedCubeList`** (and corresponding **getChangedSeriesData**\* methods) per spec, with **fixtures** in tests (no live WDS in CI).
- [ ] Matching logic defines how “interest” (schedules, watchlists, or filters) maps to changed rows—documented in spec.
- [ ] Rate limiting and retries align with existing HTTP patterns.

---

### US-004: Full / backfill load path (operator + platform)

**Description:** As an **operator**, I want a **controlled way to load history** (or a full table) **once** or on demand, separate from daily incremental noise.

**Acceptance criteria:**

- [ ] Documented approach for **bulk/range** WDS methods and/or **full table CSV/SDMX** (product decision: which is in MVP vs later).
- [ ] Operator-triggered or CLI-documented **backfill** does not silently duplicate unbounded data (idempotency/dedupe strategy documented).
- [ ] Typecheck/tests for implemented path.

---

### US-005: Schedule wizard UX update (operator)

**Description:** As an **operator**, I want the **guided schedule wizard** to include **series selection** and **ingest mode** so that I complete setup in one flow.

**Acceptance criteria:**

- [ ] Wizard steps: **Product (catalog) → Series discovery → Cadence (UTC) → Ingest options → Review**.
- [ ] Advanced overrides remain available (collapsed) for power users.
- [ ] Verify in browser using dev-browser skill (when UI ships).

---

## Functional requirements

- **FR-1:** The system must allow operators to **resolve** `data_coordinate` and/or `data_vector_id` via **WDS metadata** (not only manual entry).
- **FR-2:** The system must **validate** a chosen slice before persisting (e.g. via `getSeriesInfoFromCubePidCoord` or equivalent) when validation is enabled in spec.
- **FR-3:** Schedules must support an **`ingest_mode`** field with behavior defined in technical spec; **`latest_n`** must remain backward compatible with existing rows.
- **FR-4:** The API must expose any **new endpoints** required for metadata browsing/validation (search, pagination, product-scoped) with **auth/RBAC** consistent with [web-ops-console](prd-web-ops-console.md).
- **FR-5:** Incremental ingestion (**changed** lists + data) must be **idempotent** and **observable** (`job_runs`, `operation_logs`, schedule `last_error`).
- **FR-6:** Full/backfill flows must be **explicit** (operator intent visible in UI or CLI flags), not mixed with incremental defaults without confirmation.
- **FR-7:** Documentation must reference the official [WDS user guide](https://www.statcan.gc.ca/en/developers/wds/user-guide) for semantics of **coordinate**, **vector**, and **responseStatusCode** handling.

---

## Non-goals (out of scope for this PRD)

- **Dashboards/charts** of normalized housing time series (belongs to analytics/curated layer epics).
- **Automatic** selection of “all series in a cube” without operator confirmation (too heavy; may use full-table download separately).
- **Replacing** StatCan’s **Delta File** or large enterprise batch pipelines—only what WDS JSON/CSV/SDMX APIs reasonably support.
- **Multi-source** ingestion UI beyond StatCan WDS in this PRD.

---

## Design considerations

- **Wizard:** Reuse patterns from existing guided schedule flow ([web ops console](prd-web-ops-console.md)); add **stepper** states for series + mode.
- **Language:** Copy emphasizes **UTC** for schedule times; optional note on StatCan **release windows** (per WDS availability section).
- **Empty/error states:** WDS **409** / unavailable windows need friendly messaging, not raw HTTP text only.
- **Accessibility:** Series picker should be keyboard-navigable; large tables need search/virtualization where needed.

---

## Technical considerations

- **WDS surface area:** Today’s code paths: [`StatCanClient`](../apps/api/src/connectors/statcan/statcan-client.ts), [`wds-routes.ts`](../apps/api/src/connectors/statcan/wds-routes.ts), [`statcan-scheduled.ts`](../apps/api/src/jobs/statcan-scheduled.ts). New methods need **routes**, **Zod validation**, **fixtures**, and **job** integration.
- **SQLite:** Schedule table may need new columns (`ingest_mode`, optional `backfill_until`, etc.)—**migrations** required.
- **Idempotency:** `raw_payloads` uniqueness is `(source, sha256)` today; backfill/incremental may require **logical keys** for observations (coordination with normalization epic).
- **Rate limits:** WDS documents per-IP limits; daemon/CLI must **throttle** and **retry** consistently.
- **Reference:** Statistics Canada [WDS User Guide](https://www.statcan.gc.ca/en/developers/wds/user-guide) for method names and payload shapes.

---

## Success metrics

- **Time to create** a valid “fetch data” schedule **without support**: target median **under 5 minutes** for a new operator (usability test).
- **Reduction** in schedule-related failures due to **missing/invalid coordinate** (track `last_error` patterns pre/post).
- **Incremental** job path (when shipped) shows **lower volume** of redundant raw payloads vs naive latest-N-only for the same series set (sample comparison in staging).

---

## Open questions

1. **MVP boundary:** Is **metadata-only series picker + latest_n** sufficient for v1, with incremental/backfill in v2? 
Answer: Nope, we must include the incremental/backfill now.
2. **Full table:** Do we ever **ingest CSV/SDMX zip** in-product, or delegate to offline ETL?
Answer: It should be an in-product functionality.
3. **Watchlists:** Is incremental driven by **per-schedule interest** only, or a **global** “subscribe to subject X” model?
Answer: A global subscribe to subject approach seems a better fit. 
4. **Normalization:** Which **ingest modes** must land in **`statcan_wds_data_observation`** vs raw-only first?
Answer: I believe we can start with a raw-only first, but we must be prepared for a normalization on v2.

---

## Related documents

- [WDS User Guide](https://www.statcan.gc.ca/en/developers/wds/user-guide)
- [PRD: Web operations console](./prd-web-ops-console.md)
- [docs/specs/statcan-wds-automation/](../docs/specs/statcan-wds-automation/) (existing automation spec—may be extended or split)
