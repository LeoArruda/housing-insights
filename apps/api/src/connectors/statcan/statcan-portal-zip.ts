import { strFromU8, unzipSync } from "fflate";
import type { FetchFn } from "../fetch-types.ts";

const PORTAL_ZIP = (productId: number, lang: "en" | "fr") =>
  `https://www150.statcan.gc.ca/n1/${lang === "en" ? "en" : "fr"}/tbl/csv/${productId}-${lang === "en" ? "eng" : "fra"}.zip`;

/**
 * Fetches the official portal ZIP for a cube and returns the first `.csv` file as UTF-8 text.
 * Idempotency: callers store `sha256` of the CSV body in `raw_payloads`.
 */
export async function fetchPortalZipFirstCsv(
  productId: number,
  opts: { fetchImpl: FetchFn; userAgent: string; lang?: "en" | "fr" },
): Promise<{ csvText: string; sourceKey: string }> {
  const lang = opts.lang ?? "en";
  const url = PORTAL_ZIP(productId, lang);
  const res = await opts.fetchImpl(url, {
    method: "GET",
    headers: { "User-Agent": opts.userAgent },
  });
  if (!res.ok) {
    throw new Error(`portal zip: HTTP ${res.status} ${res.statusText}`);
  }
  const buf = new Uint8Array(await res.arrayBuffer());
  const files = unzipSync(buf);
  const names = Object.keys(files).filter((n) => /\.csv$/i.test(n));
  if (names.length === 0) {
    throw new Error("portal zip: no .csv entry found");
  }
  names.sort();
  const first = names[0]!;
  const csvText = strFromU8(files[first]!);
  return {
    csvText,
    sourceKey: `portal-zip:${productId}:${lang}:${first}`,
  };
}
