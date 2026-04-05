CREATE TABLE IF NOT EXISTS statcan_wds_data_batch (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  raw_payload_id INTEGER NOT NULL UNIQUE REFERENCES raw_payloads(id),
  product_id INTEGER NOT NULL,
  vector_id INTEGER,
  coordinate TEXT,
  point_count INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_statcan_wds_data_batch_product_id ON statcan_wds_data_batch(product_id);

CREATE TABLE IF NOT EXISTS statcan_wds_data_observation (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id INTEGER NOT NULL REFERENCES statcan_wds_data_batch(id),
  raw_payload_id INTEGER NOT NULL REFERENCES raw_payloads(id),
  ref_per TEXT NOT NULL,
  value REAL NOT NULL,
  decimals INTEGER,
  UNIQUE(batch_id, ref_per)
);

CREATE INDEX IF NOT EXISTS idx_statcan_wds_data_obs_batch_id ON statcan_wds_data_observation(batch_id);
CREATE INDEX IF NOT EXISTS idx_statcan_wds_data_obs_ref_per ON statcan_wds_data_observation(ref_per);

CREATE TABLE IF NOT EXISTS statcan_wds_normalize_error (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  raw_payload_id INTEGER NOT NULL REFERENCES raw_payloads(id),
  message TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_statcan_wds_normalize_error_raw_payload_id ON statcan_wds_normalize_error(raw_payload_id);
