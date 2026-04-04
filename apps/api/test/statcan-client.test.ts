import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { FetchFn } from "../src/connectors/fetch-types.ts";
import type { CubeListItem } from "../src/connectors/statcan/wds-schemas.ts";
import { cubeListItemSchema } from "../src/connectors/statcan/wds-schemas.ts";
import { StatCanClient } from "../src/connectors/statcan/statcan-client.ts";
import { wdsPaths } from "../src/connectors/statcan/wds-routes.ts";

const fixtureDir = join(import.meta.dir, "fixtures");

function mockFetch(handler: (url: string, init?: RequestInit) => Response): FetchFn {
  return (url, init) => Promise.resolve(handler(String(url), init));
}

describe("StatCanClient", () => {
  it("cubeListItemSchema accepts null optional fields (live WDS JSON)", () => {
    const r = cubeListItemSchema.safeParse({
      productId: 34100135,
      cansimId: null,
      subjectCode: null,
      surveyCode: null,
      cubeTitleEn: "Example",
      archived: "0",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.cansimId).toBeNull();
      expect(r.data.subjectCode).toBeNull();
    }
  });

  it("getAllCubesListLite parses array", async () => {
    const json = readFileSync(join(fixtureDir, "catalog-small.json"), "utf-8");
    const client = new StatCanClient({
      timeoutMs: 5000,
      maxRetries: 0,
      userAgent: "test",
      fetchImpl: mockFetch((url) => {
        expect(url).toBe(wdsPaths.getAllCubesListLite);
        return new Response(json, { status: 200 });
      }),
    });
    const rows = await client.getAllCubesListLite();
    expect(rows.length).toBe(3);
    expect((rows[0] as CubeListItem).productId).toBe(34100135);
  });

  it("getCubeMetadata POSTs JSON array body", async () => {
    const body = readFileSync(
      join(fixtureDir, "wds-metadata-response.json"),
      "utf-8",
    );
    let posted = "";
    const client = new StatCanClient({
      timeoutMs: 5000,
      maxRetries: 0,
      userAgent: "test",
      fetchImpl: mockFetch((url, init) => {
        expect(url).toBe(wdsPaths.getCubeMetadata);
        expect(init?.method).toBe("POST");
        posted = String(init?.body ?? "");
        return new Response(body, { status: 200 });
      }),
    });
    const data = await client.getCubeMetadata(34100135);
    expect(posted).toBe('[{"productId":34100135}]');
    expect(Array.isArray(data)).toBe(true);
  });

  it("getDataFromVectorsAndLatestNPeriods validates envelope", async () => {
    const body = readFileSync(
      join(fixtureDir, "wds-vector-data-response.json"),
      "utf-8",
    );
    const client = new StatCanClient({
      timeoutMs: 5000,
      maxRetries: 0,
      userAgent: "test",
      fetchImpl: mockFetch(() => new Response(body, { status: 200 })),
    });
    const data = await client.getDataFromVectorsAndLatestNPeriods(32164132, 2);
    expect(Array.isArray(data)).toBe(true);
  });
});
