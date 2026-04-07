# ADR-001: StatCan bulk download channel (WDS full table vs portal ZIP)

**Status:** Accepted (MVP)  
**Date:** 2026-04-05  
**Context:** [spec.md](./spec.md) — StatCan bulk dataset ingestion

## Context

StatCan exposes full-table data via:

1. **WDS** — `getFullTableDownloadCSV` (and related) through the authenticated/REST-style WDS interface already integrated in this repo.
2. **Public portal** — CSV packaged as ZIP, e.g. `https://www150.statcan.gc.ca/n1/en/tbl/csv/{productId}-eng.zip`.

Operators need a **single mental model** (full table per ProductID) while engineering needs **one raw-ingestion path** with swappable fetchers.

## Decision

- **MVP primary channel:** **`wds_full_table_csv`** — use the existing WDS client path for full-table CSV download into **`raw_payloads`**.
- **Optional channel:** **`statcan_portal_zip`** — same state machine and `raw_payloads` target; implementation fetches ZIP, extracts CSV (or stores ZIP as raw if spec requires byte-for-byte preservation—prefer extracting and storing CSV bytes as raw payload with clear metadata for downstream parsers).

## Rationale

- **Reuse:** Aligns with current connector tests, error handling, and job patterns.
- **Consistency:** Same metadata and lineage fields as other WDS-backed jobs.
- **ZIP when needed:** Some teams prefer portal ZIP for operational reasons; per-row `download_channel` allows A/B without a second product epic.

## Consequences

- Two code paths to maintain (HTTP GET ZIP + unzip vs WDS CSV).
- Normalization layer must not assume a single on-disk layout until it reads explicit payload metadata.
- **Parquet** or **object storage** are **out of scope** for this ADR; see Phase 2 in [plan.md](./plan.md).

## Alternatives considered

- **ZIP only:** Fewer WDS calls but diverges from existing WDS integration and complicates auth/rate-limit alignment.
- **WDS only:** Simplest; rejected as optional product requirement from [tasks/full-load.md](../../../tasks/full-load.md).
