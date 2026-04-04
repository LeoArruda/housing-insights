import { z } from "zod";
import type { Env } from "../env.ts";
import type { FetchFn } from "./fetch-types.ts";
import { createHttpGet } from "./http-client.ts";

export const BOC_VALET_SOURCE = "boc-valet" as const;

const valetObservationsSchema = z
  .object({
    observations: z.array(z.record(z.string(), z.unknown())).optional(),
  })
  .passthrough();

export async function fetchBocValetExemplar(
  env: Env,
  fetchImpl?: FetchFn,
): Promise<{ body: string; contentType: string; sourceKey: string }> {
  const get = createHttpGet(
    {
      timeoutMs: env.HTTP_TIMEOUT_MS,
      maxRetries: env.HTTP_MAX_RETRIES,
      userAgent: env.HTTP_USER_AGENT,
    },
    fetchImpl,
  );
  const url = env.BOC_VALET_URL;
  const res = await get(url);
  const contentType = res.headers.get("content-type") ?? "application/json";
  const body = await res.text();
  const parsed: unknown = JSON.parse(body);
  valetObservationsSchema.parse(parsed);
  return { body, contentType, sourceKey: url };
}
