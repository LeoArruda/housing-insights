import {
  wdsDataSuccessObjectSchema,
  wdsGetDataResponseEnvelopeSchema,
  type WdsDataSuccessObject,
} from "@housing-insights/types";

export type ParseStatcanWdsDataBodyResult =
  | { ok: true; data: WdsDataSuccessObject }
  | { ok: false; error: string };

/**
 * Parse a `raw_payloads.body` for `source = statcan-wds-data`.
 * Uses the **first** array element with `status === "SUCCESS"` whose `object` validates as WDS data.
 */
export function parseStatcanWdsDataBody(
  body: string,
): ParseStatcanWdsDataBodyResult {
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(body);
  } catch {
    return { ok: false, error: "Invalid JSON" };
  }

  const envelope = wdsGetDataResponseEnvelopeSchema.safeParse(parsedJson);
  if (!envelope.success) {
    return {
      ok: false,
      error: `Invalid WDS envelope: ${envelope.error.message}`,
    };
  }

  for (const row of envelope.data) {
    if (row.status !== "SUCCESS") continue;
    const obj = wdsDataSuccessObjectSchema.safeParse(row.object);
    if (obj.success) {
      return { ok: true, data: obj.data };
    }
  }

  return {
    ok: false,
    error:
      "No SUCCESS entry with a valid data object (productId + vectorDataPoint)",
  };
}
