import { apiFetch } from "./client.ts";
import type { ScheduleFrequency } from "./statcan-schedules.ts";

export type TrackedDownloadChannel =
  | "wds_full_table_csv"
  | "statcan_portal_zip";

export type TrackedDatasetStatus = "pending" | "active" | "error";

export type StatcanTrackedDataset = {
  id: number;
  product_id: number;
  cube_title_en: string | null;
  cube_title_fr: string | null;
  frequency: ScheduleFrequency;
  hour_utc: number;
  minute_utc: number;
  day_of_week: number | null;
  day_of_month: number | null;
  download_channel: TrackedDownloadChannel;
  enabled: boolean;
  status: TrackedDatasetStatus;
  last_full_download_at: string | null;
  last_changed_check_at: string | null;
  last_changed_query_date: string | null;
  last_error: string | null;
  next_run_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateTrackedDatasetBody = {
  product_id: number;
  frequency: ScheduleFrequency;
  hour_utc?: number;
  minute_utc?: number;
  day_of_week?: number | null;
  day_of_month?: number | null;
  download_channel?: TrackedDownloadChannel;
  enabled?: boolean;
};

export type PatchTrackedDatasetBody = Partial<
  Omit<CreateTrackedDatasetBody, "product_id">
>;

export async function fetchStatcanTrackedDatasets(): Promise<
  StatcanTrackedDataset[]
> {
  const res = await apiFetch<{ data: StatcanTrackedDataset[] }>(
    "/statcan/tracked-datasets",
  );
  return res.data;
}

export async function createStatcanTrackedDataset(
  body: CreateTrackedDatasetBody,
): Promise<StatcanTrackedDataset> {
  return apiFetch<StatcanTrackedDataset>("/statcan/tracked-datasets", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function patchStatcanTrackedDataset(
  id: number,
  body: PatchTrackedDatasetBody,
): Promise<StatcanTrackedDataset> {
  return apiFetch<StatcanTrackedDataset>(`/statcan/tracked-datasets/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function deleteStatcanTrackedDataset(id: number): Promise<void> {
  await apiFetch<null>(`/statcan/tracked-datasets/${id}`, {
    method: "DELETE",
  });
}

export async function refreshStatcanTrackedDataset(
  id: number,
): Promise<{ ok: boolean; data: StatcanTrackedDataset | null }> {
  return apiFetch<{ ok: boolean; data: StatcanTrackedDataset | null }>(
    `/statcan/tracked-datasets/${id}/refresh`,
    { method: "POST" },
  );
}
