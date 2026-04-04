CREATE TABLE IF NOT EXISTS statcan_product_schedules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL UNIQUE,
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly')),
  hour_utc INTEGER NOT NULL CHECK (hour_utc >= 0 AND hour_utc <= 23),
  minute_utc INTEGER NOT NULL DEFAULT 0 CHECK (minute_utc >= 0 AND minute_utc <= 59),
  day_of_week INTEGER CHECK (day_of_week IS NULL OR (day_of_week >= 0 AND day_of_week <= 6)),
  day_of_month INTEGER CHECK (day_of_month IS NULL OR (day_of_month >= 1 AND day_of_month <= 31)),
  latest_n INTEGER CHECK (latest_n IS NULL OR (latest_n >= 1 AND latest_n <= 200)),
  data_coordinate TEXT,
  data_vector_id INTEGER,
  fetch_metadata INTEGER NOT NULL DEFAULT 1 CHECK (fetch_metadata IN (0, 1)),
  fetch_data INTEGER NOT NULL DEFAULT 1 CHECK (fetch_data IN (0, 1)),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  next_run_at TEXT,
  last_run_at TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_statcan_schedules_due ON statcan_product_schedules(enabled, next_run_at);

INSERT OR IGNORE INTO statcan_product_schedules (
  product_id,
  frequency,
  hour_utc,
  minute_utc,
  day_of_week,
  day_of_month,
  latest_n,
  fetch_metadata,
  fetch_data,
  enabled,
  next_run_at,
  created_at,
  updated_at
) VALUES
  (34100096, 'daily', 6, 0, NULL, NULL, 3, 1, 1, 1, '2000-01-01T06:00:00.000Z', datetime('now'), datetime('now')),
  (34100099, 'daily', 6, 0, NULL, NULL, 3, 1, 1, 1, '2000-01-01T06:00:00.000Z', datetime('now'), datetime('now')),
  (34100100, 'daily', 6, 0, NULL, NULL, 3, 1, 1, 1, '2000-01-01T06:00:00.000Z', datetime('now'), datetime('now')),
  (36100350, 'daily', 6, 0, NULL, NULL, 3, 1, 1, 1, '2000-01-01T06:00:00.000Z', datetime('now'), datetime('now')),
  (10100106, 'daily', 6, 0, NULL, NULL, 3, 1, 1, 1, '2000-01-01T06:00:00.000Z', datetime('now'), datetime('now'));
