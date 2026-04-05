import { describe, expect, it } from "bun:test";
import {
  extractChangedCubeProductIds,
  extractChangedSeriesEntries,
} from "../src/connectors/statcan/wds-changed-parse.ts";

describe("wds-changed-parse", () => {
  it("extracts changed series entries from nested JSON", () => {
    const raw = {
      status: "SUCCESS",
      object: [
        {
          responseStatusCode: 0,
          vectorId: 107028707,
          productId: 25100059,
          coordinate: "5.2.1.0.0.0.0.0.0.0",
        },
      ],
    };
    const entries = extractChangedSeriesEntries(raw);
    expect(entries.length).toBe(1);
    expect(entries[0]!.productId).toBe(25100059);
    expect(entries[0]!.vectorId).toBe(107028707);
  });

  it("extracts product ids from changed-cube style payloads", () => {
    const raw = {
      status: "SUCCESS",
      object: [[{ responseStatusCode: 0, productId: 34100009 }]],
    };
    const ids = extractChangedCubeProductIds(raw);
    expect(ids.has(34100009)).toBe(true);
  });
});
