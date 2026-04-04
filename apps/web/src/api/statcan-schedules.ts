import { apiFetch } from "./client.ts";

export type ScheduleFrequency = "daily" | "weekly" | "monthly";

export type StatcanSchedule = {
  id: number;
  product_id: number;
  frequency: ScheduleFrequency;
  hour_utc: number;
  minute_utc: number;
  day_of_week: number | null;
  day_of_month: number | null;
  latest_n: number | null;
  data_coordinate: string | null;
  data_vector_id: number | null;
  fetch_metadata: boolean;
  fetch_data: boolean;
  enabled: boolean;
  next_run_at: string | null;
  last_run_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

export type StatcanCatalogRow = {
  product_id: number;
  cansim_id: string | null;
  cube_title_en: string | null;
  cube_title_fr: string | null;
  archived: number;
  housing_score: number | null;
  macro_score: number | null;
};

export type CreateScheduleBody = {
  product_id: number;
  frequency: ScheduleFrequency;
  hour_utc: number;
  minute_utc: number;
  day_of_week?: number | null;
  day_of_month?: number | null;
  latest_n?: number | null;
  data_coordinate?: string | null;
  data_vector_id?: number | null;
  fetch_metadata?: boolean;
  fetch_data?: boolean;
  enabled?: boolean;
  next_run_at?: string | null;
};

export type PatchScheduleBody = Partial<
  Omit<CreateScheduleBody, "product_id">
>;

export async function fetchStatcanSchedules(): Promise<StatcanSchedule[]> {
  const res = await apiFetch<{ data: StatcanSchedule[] }>("/statcan/schedules");
  return res.data;
}

export async function patchStatcanSchedule(
  id: number,
  body: PatchScheduleBody,
): Promise<StatcanSchedule> {
  return apiFetch<StatcanSchedule>(`/statcan/schedules/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function deleteStatcanSchedule(id: number): Promise<void> {
  await apiFetch<null>(`/statcan/schedules/${id}`, { method: "DELETE" });
}

export async function createStatcanSchedule(
  body: CreateScheduleBody,
): Promise<StatcanSchedule> {
  return apiFetch<StatcanSchedule>("/statcan/schedules", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function searchStatcanCatalog(params: {
  q?: string;
  limit?: number;
  offset?: number;
}): Promise<{ data: StatcanCatalogRow[]; limit: number; offset: number }> {
  const sp = new URLSearchParams();
  if (params.q != null && params.q !== "") sp.set("q", params.q);
  if (params.limit != null) sp.set("limit", String(params.limit));
  if (params.offset != null) sp.set("offset", String(params.offset));
  const q = sp.toString();
  const path = q ? `/statcan/catalog?${q}` : "/statcan/catalog";
  return apiFetch(path);
}
