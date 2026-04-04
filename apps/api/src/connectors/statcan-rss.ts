import type { Env } from "../env.ts";
import type { FetchFn } from "./fetch-types.ts";
import { createHttpGet } from "./http-client.ts";
import { parseRssXml } from "./rss-common.ts";

export const STATCAN_RSS_SOURCE = "statcan-rss" as const;

export async function fetchStatcanRss(
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
  const url = env.STATCAN_RSS_URL;
  const res = await get(url);
  const contentType = res.headers.get("content-type") ?? "application/xml";
  const body = await res.text();
  parseRssXml(body);
  return { body, contentType, sourceKey: url };
}
