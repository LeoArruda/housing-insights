import { apiFetch } from "../api/client.ts";

export type JobRunStatus = "running" | "success" | "failed";

export type JobRunRow = {
  id: number;
  job_name: string;
  started_at: string;
  finished_at: string | null;
  status: string;
  error_message: string | null;
  metadata: string | null;
};

export type JobRunListResponse = { data: JobRunRow[] };

export type JobRunsListParams = {
  job_name?: string;
  status?: JobRunStatus | "";
  limit: number;
};

export function buildJobRunsListPath(params: JobRunsListParams): string {
  const sp = new URLSearchParams();
  const name = params.job_name?.trim();
  if (name) sp.set("job_name", name);
  if (params.status) sp.set("status", params.status);
  sp.set("limit", String(params.limit));
  return `/job-runs?${sp.toString()}`;
}

export function fetchJobRunsList(
  params: JobRunsListParams,
): Promise<JobRunListResponse> {
  return apiFetch<JobRunListResponse>(buildJobRunsListPath(params));
}

export function fetchJobRunById(id: number): Promise<JobRunRow> {
  return apiFetch<JobRunRow>(`/job-runs/${id}`);
}
