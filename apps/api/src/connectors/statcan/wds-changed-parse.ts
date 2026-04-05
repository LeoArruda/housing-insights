/** Best-effort extraction from WDS changed-series / changed-cube JSON (nested arrays allowed). */

export function extractChangedSeriesEntries(
  raw: unknown,
): Array<{ productId: number; vectorId: number; coordinate: string }> {
  const out: Array<{
    productId: number;
    vectorId: number;
    coordinate: string;
  }> = [];
  const visit = (v: unknown): void => {
    if (v && typeof v === "object" && "vectorId" in v && "productId" in v) {
      const o = v as Record<string, unknown>;
      const pid = o.productId;
      const vid = o.vectorId;
      if (typeof pid === "number" && typeof vid === "number") {
        out.push({
          productId: pid,
          vectorId: vid,
          coordinate: typeof o.coordinate === "string" ? o.coordinate : "",
        });
      }
    }
    if (Array.isArray(v)) {
      for (const x of v) visit(x);
    } else if (v && typeof v === "object") {
      for (const x of Object.values(v)) visit(x);
    }
  };
  visit(raw);
  return out;
}

export function extractChangedCubeProductIds(raw: unknown): Set<number> {
  const ids = new Set<number>();
  const visit = (v: unknown): void => {
    if (v && typeof v === "object" && "productId" in v) {
      const pid = (v as { productId?: unknown }).productId;
      if (typeof pid === "number") ids.add(pid);
    }
    if (Array.isArray(v)) {
      for (const x of v) visit(x);
    } else if (v && typeof v === "object") {
      for (const x of Object.values(v)) visit(x);
    }
  };
  visit(raw);
  return ids;
}
