# 🧾 Feature: StatCan Bulk & Incremental Data Ingestion (Refactor)

## 1. Background / Problem

The current implementation relies primarily on the [StatCan Web Data Service (WDS)](https://www.statcan.gc.ca/en/developers/wds?utm_source=chatgpt.com) to retrieve data.

While WDS provides flexible API access, it is:

* **Too granular** (vector-level requests)
* **Limited for large datasets**
* Not suitable for **bulk ingestion or efficient refresh cycles**

StatCan explicitly states that:

* WDS is intended for **discrete/small updates** ([Statistics Canada][1])
* It is **not meant for large data updates** ([Statistics Canada][2])

Instead, StatCan provides:

* **Full table downloads (CSV)** → for complete datasets
* **Delta files** → for large-scale incremental updates ([Statistics Canada][3])

👉 The current solution does not leverage these properly.

---

## 2. Objective

Refactor the ingestion workflow to support:

1. **Bulk-first ingestion**

   * Download full datasets (CSV) per ProductID

2. **Efficient incremental updates**

   * Detect and retrieve only changes after initial load

3. **User-driven scheduling**

   * Allow users to define refresh cadence:

     * Daily
     * Weekly
     * Monthly

4. **Multi-product orchestration**

   * Users can select multiple ProductIDs and manage them as a pipeline

---

## 3. User Story

> As a user,
> I want to select multiple datasets (ProductIDs) from a catalog,
> so that I can automatically download and keep them updated
> using an efficient full-load + incremental strategy.

---

## 4. Functional Requirements

### 4.1 Product Selection

* Display catalog of available datasets (via `getAllCubesListLite`)
* Allow multi-selection of ProductIDs
* Persist selected datasets as a “tracked collection”

---

### 4.2 Initial Load (Full Table)

For each selected ProductID:

* Check if dataset exists locally

  * If **not exists**:

    * Download full dataset via CSV

Example:

```bash
https://www150.statcan.gc.ca/n1/en/tbl/csv/{productId}-eng.zip
```

* Extract and store as:

  * Raw (CSV)
  * Processed (Parquet / DB)

---

### 4.3 Incremental Update Logic

When dataset already exists:

#### Option A — Recommended (Simple & Reliable)

1. Call:

```bash
getChangedCubeList/{date}
```

2. If ProductID is in the response:

   * Re-download full table

👉 Rationale:

* Simpler
* Avoids complex diff logic
* Acceptable given dataset sizes

---

#### Option B — Advanced (Future)

Use:

* **Delta File** (daily updates across all datasets)

Delta File characteristics:

* Contains **all changes released each business day** ([Statistics Canada][4])
* Designed for **large-scale ingestion pipelines** ([Statistics Canada][5])

Pipeline:

* Download delta file
* Filter by ProductIDs
* Merge changes into local dataset

---

### 4.4 Scheduling

Users can configure:

* Frequency:

  * Daily
  * Weekly
  * Monthly

* System behavior:

  * Trigger ingestion job
  * Execute per ProductID:

    * Check changes
    * Apply update strategy

---

### 4.5 State Tracking

For each ProductID:

Store metadata:

```json
{
  "productId": 18100004,
  "lastDownloadedAt": "2026-04-01",
  "lastCheckedAt": "2026-04-06",
  "status": "active",
  "updateFrequency": "weekly"
}
```

---

## 5. Non-Functional Requirements

* Must support **parallel ingestion** (multiple ProductIDs)
* Must be **idempotent**
* Must handle:

  * network failures
  * partial downloads
* Must scale to **dozens of datasets**

---

## 6. UX / UI Expectations

### Dataset Selection

* Search + filter catalog
* Show:

  * title
  * frequency (monthly, quarterly, etc.)
  * last release date

---

### Dataset Management

For each dataset:

* Status (Downloaded / Pending / Updating)
* Last updated
* Next scheduled run
* Manual “Refresh Now” button

---

### Scheduling UI

* Simple dropdown:

  * Daily / Weekly / Monthly
* Optional:

  * Day of week
  * Time

---

## 7. Technical Design (High-Level)

### Current (problematic)

```
Frontend → WDS API → per vector queries → store
```

---

### Target Architecture

```
Frontend
   ↓
Ingestion Service (Bun / Node)
   ↓
Catalog Service (getAllCubesListLite)
   ↓
Storage Layer (CSV / Parquet / DB)

Update Flow:
Scheduler → Change Detection → Download → Transform → Store
```

---

### Core Services

#### 1. Catalog Service

* Fetch + cache cube list

#### 2. Ingestion Service

* Full download
* Incremental logic

#### 3. Scheduler

* Cron-based or queue-based

#### 4. Storage Adapter

* File system / S3 / Databricks / DB

---

## 8. Key Design Decisions

### Decision 1 — Prefer Full Reload on Change

* Simpler than partial updates
* Avoids inconsistencies

---

### Decision 2 — Treat ProductID as Primary Entity

* Everything keyed by ProductID

---

### Decision 3 — Separate Discovery from Ingestion

* Catalog ≠ ingestion logic

---

## 9. Risks / Considerations

| Risk                     | Mitigation               |
| ------------------------ | ------------------------ |
| Large file downloads     | Parallel + retry         |
| Schema changes           | Normalize layer          |
| Missing updates          | Use change detection API |
| Complexity of Delta File | Phase 2 implementation   |

---

## 10. Example Flow (CPI)

### User selects:

* ProductID: `18100004`

---

### First run:

* Download:

```bash
https://www150.statcan.gc.ca/n1/en/tbl/csv/18100004-eng.zip
```

---

### Weekly job:

1. Call:

```bash
getChangedCubeList/2026-04-01
```

2. If CPI changed:
   → re-download full table

---

## 11. Success Criteria

* Users can onboard datasets in < 1 min
* Updates run automatically with no manual intervention
* System avoids excessive API calls (vs current WDS approach)
* Data remains consistent and up-to-date

---

## 💡 Final note (important insight)

This feature is not just a refactor — it’s a **shift from API-driven ingestion → data-platform ingestion**.

You’re basically moving from:

* ❌ query-based consumption (WDS)

to:

* ✅ dataset lifecycle management (like a mini data platform)