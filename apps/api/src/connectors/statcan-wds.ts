import { z } from "zod";
import type { Env } from "../env.ts";
import type { FetchFn } from "./fetch-types.ts";
import { createHttpGet } from "./http-client.ts";

export const STATCAN_WDS_SOURCE = "statcan-wds" as const;

const jsonValue: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValue),
    z.record(z.string(), jsonValue),
  ]),
);

export async function fetchStatcanWdsExemplar(
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
  const url = env.STATCAN_WDS_URL;
  const res = await get(url);
  const contentType = res.headers.get("content-type") ?? "application/json";
  const body = await res.text();
  const parsed: unknown = JSON.parse(body);
  jsonValue.parse(parsed);
  return { body, contentType, sourceKey: url };
}
