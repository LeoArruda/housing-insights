import { Buffer } from "node:buffer";
import type { FetchFn } from "../fetch-types.ts";
import { createHttpGet } from "../http-client.ts";
import type { Env } from "../../env.ts";
import {
  cubeListItemSchema,
  getCubeMetadataResponseSchema,
  getDataResponseSchema,
  type CubeListItem,
} from "./wds-schemas.ts";
import { wdsPaths } from "./wds-routes.ts";

export type StatCanClientOptions = {
  timeoutMs: number;
  maxRetries: number;
  userAgent: string;
  fetchImpl?: FetchFn;
};

export class StatCanClient {
  private readonly get: ReturnType<typeof createHttpGet>;
  private readonly fetchImpl: FetchFn;
  private readonly userAgent: string;

  constructor(opts: StatCanClientOptions) {
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.userAgent = opts.userAgent;
    this.get = createHttpGet(
      {
        timeoutMs: opts.timeoutMs,
        maxRetries: opts.maxRetries,
        userAgent: opts.userAgent,
      },
      this.fetchImpl,
    );
  }

  static fromEnv(env: Env, fetchImpl?: FetchFn): StatCanClient {
    return new StatCanClient({
      timeoutMs: env.HTTP_TIMEOUT_MS,
      maxRetries: env.HTTP_MAX_RETRIES,
      userAgent: env.HTTP_USER_AGENT,
      fetchImpl,
    });
  }

  /** GET — full cube list (large payload). */
  async getAllCubesListLite(): Promise<unknown[]> {
    const res = await this.get(wdsPaths.getAllCubesListLite);
    const text = await res.text();
    const parsed: unknown = JSON.parse(text);
    if (!Array.isArray(parsed)) {
      throw new Error("getAllCubesListLite: expected JSON array");
    }
    const out: CubeListItem[] = [];
    for (let i = 0; i < parsed.length; i++) {
      const r = cubeListItemSchema.safeParse(parsed[i]);
      if (!r.success) {
        console.warn(
          `[StatCanClient] skipping invalid catalog row ${i}: ${r.error.message}`,
        );
        continue;
      }
      out.push(r.data);
    }
    return out;
  }

  /** POST body: `[{"productId":35100003}]` */
  async getCubeMetadata(productId: number): Promise<unknown> {
    const body = JSON.stringify([{ productId }]);
    const res = await this.fetchImpl(wdsPaths.getCubeMetadata, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": this.userAgent,
      },
      body,
    });
    if (!res.ok) {
      throw new Error(`getCubeMetadata: HTTP ${res.status} ${res.statusText}`);
    }
    const text = await res.text();
    const parsed: unknown = JSON.parse(text);
    getCubeMetadataResponseSchema.parse(parsed);
    return parsed;
  }

  /** POST body: `[{"productId":35100003,"coordinate":"1.12.0.0.0.0.0.0.0.0","latestN":3}]` */
  async getDataFromCubePidCoordAndLatestNPeriods(
    productId: number,
    coordinate: string,
    latestN: number,
  ): Promise<unknown> {
    const body = JSON.stringify([{ productId, coordinate, latestN }]);
    return this.postData(wdsPaths.getDataFromCubePidCoordAndLatestNPeriods, body);
  }

  /** POST body: `[{"vectorId":32164132,"latestN":3}]` */
  async getDataFromVectorsAndLatestNPeriods(
    vectorId: number,
    latestN: number,
  ): Promise<unknown> {
    const body = JSON.stringify([{ vectorId, latestN }]);
    return this.postData(wdsPaths.getDataFromVectorsAndLatestNPeriods, body);
  }

  private async postData(url: string, body: string): Promise<unknown> {
    const res = await this.fetchImpl(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": this.userAgent,
      },
      body,
    });
    if (!res.ok) {
      throw new Error(`WDS POST: HTTP ${res.status} ${res.statusText}`);
    }
    const text = await res.text();
    const parsed: unknown = JSON.parse(text);
    getDataResponseSchema.parse(parsed);
    return parsed;
  }

  private async postJsonLoose(url: string, body: string): Promise<unknown> {
    const res = await this.fetchImpl(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": this.userAgent,
      },
      body,
    });
    if (!res.ok) {
      throw new Error(`WDS POST: HTTP ${res.status} ${res.statusText}`);
    }
    const text = await res.text();
    return JSON.parse(text) as unknown;
  }

  private async getJsonLoose(url: string): Promise<unknown> {
    const res = await this.fetchImpl(url, {
      method: "GET",
      headers: { "User-Agent": this.userAgent },
    });
    if (!res.ok) {
      throw new Error(`WDS GET: HTTP ${res.status} ${res.statusText}`);
    }
    const text = await res.text();
    return JSON.parse(text) as unknown;
  }

  /** GET — series that changed “today” (per WDS guide). */
  async getChangedSeriesList(): Promise<unknown> {
    return this.getJsonLoose(wdsPaths.getChangedSeriesList);
  }

  /** GET — cubes changed on a calendar day (YYYY-MM-DD). */
  async getChangedCubeList(isoDate: string): Promise<unknown> {
    return this.getJsonLoose(wdsPaths.getChangedCubeList(isoDate));
  }

  async getSeriesInfoFromCubePidCoord(
    productId: number,
    coordinate: string,
  ): Promise<unknown> {
    const body = JSON.stringify([{ productId, coordinate }]);
    return this.postJsonLoose(wdsPaths.getSeriesInfoFromCubePidCoord, body);
  }

  async getSeriesInfoFromVector(vectorId: number): Promise<unknown> {
    const body = JSON.stringify([{ vectorId }]);
    return this.postJsonLoose(wdsPaths.getSeriesInfoFromVector, body);
  }

  async getChangedSeriesDataFromCubePidCoord(
    productId: number,
    coordinate: string,
  ): Promise<unknown> {
    const body = JSON.stringify([{ productId, coordinate }]);
    return this.postJsonLoose(
      wdsPaths.getChangedSeriesDataFromCubePidCoord,
      body,
    );
  }

  async getChangedSeriesDataFromVector(vectorId: number): Promise<unknown> {
    const body = JSON.stringify([{ vectorId }]);
    return this.postJsonLoose(wdsPaths.getChangedSeriesDataFromVector, body);
  }

  async getBulkVectorDataByRange(
    vectorIds: string[],
    startDataPointReleaseDate: string,
    endDataPointReleaseDate: string,
  ): Promise<unknown> {
    const body = JSON.stringify({
      vectorIds,
      startDataPointReleaseDate,
      endDataPointReleaseDate,
    });
    return this.postJsonLoose(wdsPaths.getBulkVectorDataByRange, body);
  }

  /** GET — CSV text (not JSON). */
  async getFullTableDownloadCSV(
    productId: number,
    lang: "en" | "fr",
  ): Promise<string> {
    const url = wdsPaths.getFullTableDownloadCSV(productId, lang);
    const res = await this.fetchImpl(url, {
      method: "GET",
      headers: { "User-Agent": this.userAgent },
    });
    if (!res.ok) {
      throw new Error(
        `getFullTableDownloadCSV: HTTP ${res.status} ${res.statusText}`,
      );
    }
    return res.text();
  }

  /** GET — SDMX package (often zip); returned as base64 for storage in `raw_payloads.body`. */
  async getFullTableDownloadSDMXBase64(productId: number): Promise<string> {
    const url = wdsPaths.getFullTableDownloadSDMX(productId);
    const res = await this.fetchImpl(url, {
      method: "GET",
      headers: { "User-Agent": this.userAgent },
    });
    if (!res.ok) {
      throw new Error(
        `getFullTableDownloadSDMX: HTTP ${res.status} ${res.statusText}`,
      );
    }
    const buf = new Uint8Array(await res.arrayBuffer());
    return Buffer.from(buf).toString("base64");
  }

}
