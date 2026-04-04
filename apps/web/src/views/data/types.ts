/** Shape returned by `GET /raw-payloads` and `GET /raw-payloads/:id`. */
export type RawPayloadRow = {
  id: number;
  source: string;
  source_key: string | null;
  fetched_at: string;
  content_type: string;
  body: string;
  sha256: string;
  job_run_id: number | null;
};
