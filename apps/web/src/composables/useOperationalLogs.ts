import { apiFetch } from "../api/client.ts";

export type OperationalLogLevel = "debug" | "info" | "warn" | "error";

export type OperationalLogRow = {
  id: number;
  occurred_at: string;
  level: OperationalLogLevel;
  source: string;
  job_run_id: number | null;
  message: string;
  detail: string | null;
  correlation_id: string | null;
};

export type OperationalLogListResponse = { data: OperationalLogRow[] };

export type OperationalLogsListParams = {
  from?: string;
  to?: string;
  level?: OperationalLogLevel | "";
  source?: string;
  job_run_id?: number;
  q?: string;
  limit: number;
  offset: number;
};

export function buildOperationalLogsListPath(
  params: OperationalLogsListParams,
): string {
  const sp = new URLSearchParams();
  if (params.from?.trim()) sp.set("from", params.from.trim());
  if (params.to?.trim()) sp.set("to", params.to.trim());
  if (params.level) sp.set("level", params.level);
  const src = params.source?.trim();
  if (src) sp.set("source", src);
  if (params.job_run_id != null && Number.isFinite(params.job_run_id)) {
    sp.set("job_run_id", String(params.job_run_id));
  }
  const q = params.q?.trim();
  if (q) sp.set("q", q);
  sp.set("limit", String(params.limit));
  sp.set("offset", String(params.offset));
  return `/operations/logs?${sp.toString()}`;
}

export function fetchOperationalLogsList(
  params: OperationalLogsListParams,
): Promise<OperationalLogListResponse> {
  return apiFetch<OperationalLogListResponse>(
    buildOperationalLogsListPath(params),
  );
}
