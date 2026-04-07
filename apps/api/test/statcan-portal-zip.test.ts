import { describe, expect, it } from "bun:test";
import { strToU8, zipSync } from "fflate";
import { fetchPortalZipFirstCsv } from "../src/connectors/statcan/statcan-portal-zip.ts";

describe("fetchPortalZipFirstCsv", () => {
  it("extracts first csv from a zip buffer", async () => {
    const zipBytes = zipSync({
      "18100004.csv": strToU8("col\nval\n"),
    });
    const fetchImpl: typeof fetch = async () =>
      new Response(zipBytes, { status: 200 });
    const { csvText, sourceKey } = await fetchPortalZipFirstCsv(18_100_004, {
      fetchImpl,
      userAgent: "test/0",
    });
    expect(csvText.trim()).toBe("col\nval");
    expect(sourceKey).toContain("18100004");
    expect(sourceKey).toContain(".csv");
  });
});
