CREATE TABLE IF NOT EXISTS statcan_cube_catalog (
  product_id INTEGER PRIMARY KEY,
  cansim_id TEXT,
  cube_title_en TEXT,
  cube_title_fr TEXT,
  archived TEXT,
  frequency_code INTEGER,
  subject_codes TEXT,
  housing_score INTEGER NOT NULL DEFAULT 0,
  macro_score INTEGER NOT NULL DEFAULT 0,
  indexed_at TEXT NOT NULL,
  raw_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_statcan_catalog_housing ON statcan_cube_catalog(housing_score DESC);

CREATE INDEX IF NOT EXISTS idx_statcan_catalog_macro ON statcan_cube_catalog(macro_score DESC);

CREATE TABLE IF NOT EXISTS statcan_ingest_cursor (
  product_id INTEGER PRIMARY KEY,
  last_metadata_sha256 TEXT,
  last_metadata_at TEXT,
  last_data_at TEXT,
  last_error TEXT,
  data_coordinate TEXT,
  data_vector_id INTEGER
);
