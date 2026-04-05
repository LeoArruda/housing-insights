import { apiFetch } from "./client.ts";

export async function postStatcanSeriesInfo(body: {
  product_id: number;
  coordinate?: string;
  vector_id?: number;
}): Promise<{ data: unknown }> {
  return apiFetch<{ data: unknown }>("/statcan/ingest/series-info", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function postStatcanCubeMetadata(body: {
  product_id: number;
}): Promise<{ data: unknown }> {
  return apiFetch<{ data: unknown }>("/statcan/ingest/cube-metadata", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
