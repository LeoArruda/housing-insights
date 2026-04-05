import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  wdsDataSuccessObjectSchema,
  wdsGetDataResponseEnvelopeSchema,
} from "@housing-insights/types";

const fixtureDir = join(import.meta.dir, "fixtures");

describe("StatCan WDS normalization Zod schemas", () => {
  it("parses wds-vector-data-response.json envelope and SUCCESS object", () => {
    const raw = readFileSync(
      join(fixtureDir, "wds-vector-data-response.json"),
      "utf-8",
    );
    const json: unknown = JSON.parse(raw);
    const envelope = wdsGetDataResponseEnvelopeSchema.parse(json);
    expect(envelope.length).toBeGreaterThanOrEqual(1);
    const first = envelope[0];
    expect(first.status).toBe("SUCCESS");
    const obj = wdsDataSuccessObjectSchema.parse(first.object);
    expect(obj.productId).toBe(35100003);
    expect(obj.vectorId).toBe(32164132);
    expect(obj.vectorDataPoint).toHaveLength(1);
    expect(obj.vectorDataPoint[0].refPer).toBe("2022-01-01");
    expect(obj.vectorDataPoint[0].value).toBe(19.43);
  });
});
