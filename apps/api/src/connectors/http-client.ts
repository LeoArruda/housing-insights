import type { FetchFn } from "./fetch-types.ts";

export type HttpClientOptions = {
  timeoutMs: number;
  maxRetries: number;
  userAgent: string;
};

export function createHttpGet(
  options: HttpClientOptions,
  fetchImpl: FetchFn = fetch,
) {
  return async function httpGet(url: string): Promise<Response> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), options.timeoutMs);
        const res = await fetchImpl(url, {
          headers: { "User-Agent": options.userAgent },
          signal: controller.signal,
        });
        clearTimeout(timer);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`);
        }
        return res;
      } catch (e) {
        lastError = e;
        if (attempt < options.maxRetries) {
          const delayMs = 2 ** attempt * 200;
          await new Promise((r) => setTimeout(r, delayMs));
        }
      }
    }
    throw lastError;
  };
}
