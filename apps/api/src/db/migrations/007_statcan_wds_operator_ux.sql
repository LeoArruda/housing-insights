ALTER TABLE statcan_product_schedules ADD COLUMN ingest_mode TEXT NOT NULL DEFAULT 'latest_n';
ALTER TABLE statcan_product_schedules ADD COLUMN bulk_release_start TEXT;
ALTER TABLE statcan_product_schedules ADD COLUMN bulk_release_end TEXT;

CREATE TABLE IF NOT EXISTS statcan_subject_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subject_code TEXT NOT NULL UNIQUE,
  label TEXT,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_statcan_subject_sub_enabled ON statcan_subject_subscriptions(enabled);
