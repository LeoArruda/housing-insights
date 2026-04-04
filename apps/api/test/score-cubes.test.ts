import { describe, expect, it } from "bun:test";
import {
  normalizeForMatch,
  scoreCubeTitles,
} from "../src/connectors/statcan/score-cubes.ts";

const buckets = {
  housing: ["housing", "starts"],
  macro: ["cpi", "consumer price index"],
};

describe("scoreCubeTitles", () => {
  it("scores housing title", () => {
    const s = scoreCubeTitles(
      "Housing starts in Canada",
      undefined,
      buckets,
    );
    expect(s.housingScore).toBeGreaterThanOrEqual(1);
    expect(s.macroScore).toBe(0);
  });

  it("scores macro title", () => {
    const s = scoreCubeTitles("Consumer Price Index, all items", undefined, buckets);
    expect(s.macroScore).toBeGreaterThanOrEqual(1);
  });

  it("normalizeForMatch strips accents", () => {
    expect(normalizeForMatch("Économie")).toContain("economie");
  });
});
