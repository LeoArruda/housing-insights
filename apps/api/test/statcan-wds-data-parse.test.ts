import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseStatcanWdsDataBody } from "../src/services/statcan-wds-data-parse.ts";

const fixtureDir = join(import.meta.dir, "fixtures");

describe("parseStatcanWdsDataBody", () => {
  it("parses fixture body", () => {
    const body = readFileSync(
      join(fixtureDir, "wds-vector-data-response.json"),
      "utf-8",
    );
    const r = parseStatcanWdsDataBody(body);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.productId).toBe(35100003);
      expect(r.data.vectorDataPoint).toHaveLength(1);
    }
  });

  it("rejects invalid JSON", () => {
    const r = parseStatcanWdsDataBody("not json");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("Invalid JSON");
  });

  it("rejects empty array envelope", () => {
    const r = parseStatcanWdsDataBody("[]");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/envelope|No SUCCESS/i);
  });

  it("rejects when no SUCCESS with valid object", () => {
    const r = parseStatcanWdsDataBody(
      JSON.stringify([{ status: "FAILURE", object: {} }]),
    );
    expect(r.ok).toBe(false);
  });
});
