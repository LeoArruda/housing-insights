CREATE TABLE IF NOT EXISTS operation_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  occurred_at TEXT NOT NULL,
  level TEXT NOT NULL,
  source TEXT NOT NULL,
  job_run_id INTEGER REFERENCES job_runs(id) ON DELETE SET NULL,
  message TEXT NOT NULL,
  detail TEXT,
  correlation_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_operation_logs_occurred ON operation_logs(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_operation_logs_level ON operation_logs(level);
CREATE INDEX IF NOT EXISTS idx_operation_logs_source ON operation_logs(source);
CREATE INDEX IF NOT EXISTS idx_operation_logs_job_run ON operation_logs(job_run_id);
