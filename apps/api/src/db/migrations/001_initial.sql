CREATE TABLE IF NOT EXISTS job_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_name TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  status TEXT NOT NULL,
  error_message TEXT,
  metadata TEXT
);

CREATE TABLE IF NOT EXISTS raw_payloads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,
  source_key TEXT,
  fetched_at TEXT NOT NULL,
  content_type TEXT NOT NULL,
  body TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  job_run_id INTEGER REFERENCES job_runs(id),
  UNIQUE(source, sha256)
);

CREATE INDEX IF NOT EXISTS idx_job_runs_job_name ON job_runs(job_name);
CREATE INDEX IF NOT EXISTS idx_job_runs_started ON job_runs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_raw_payloads_source ON raw_payloads(source);
CREATE INDEX IF NOT EXISTS idx_raw_payloads_fetched ON raw_payloads(fetched_at DESC);
