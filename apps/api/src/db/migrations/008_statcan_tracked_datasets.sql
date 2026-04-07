/* Tracked ProductIDs — docs/specs/statcan-bulk-dataset-ingestion/ */

CREATE TABLE IF NOT EXISTS statcan_tracked_datasets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL UNIQUE,
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly')),
  hour_utc INTEGER NOT NULL DEFAULT 6,
  minute_utc INTEGER NOT NULL DEFAULT 0,
  day_of_week INTEGER,
  day_of_month INTEGER,
  download_channel TEXT NOT NULL DEFAULT 'wds_full_table_csv'
    CHECK (download_channel IN ('wds_full_table_csv', 'statcan_portal_zip')),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'error')),
  last_full_download_at TEXT,
  last_changed_check_at TEXT,
  last_changed_query_date TEXT,
  last_error TEXT,
  next_run_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_statcan_tracked_datasets_enabled_next
  ON statcan_tracked_datasets (enabled, next_run_at);

CREATE INDEX IF NOT EXISTS idx_statcan_tracked_datasets_product_id
  ON statcan_tracked_datasets (product_id);
