import type { CubeListItem } from "./wds-schemas.ts";
import { cubeListItemSchema } from "./wds-schemas.ts";
import type { StatCanClient } from "./statcan-client.ts";

export async function loadCatalogFromFile(
  path: string,
): Promise<CubeListItem[]> {
  const file = Bun.file(path);
  if (!(await file.exists())) {
    throw new Error(`StatCan catalog file not found: ${path}`);
  }
  const parsed: unknown = await file.json();
  if (!Array.isArray(parsed)) {
    throw new Error("Catalog file must contain a JSON array");
  }
  const out: CubeListItem[] = [];
  for (let i = 0; i < parsed.length; i++) {
    const row = cubeListItemSchema.safeParse(parsed[i]);
    if (!row.success) {
      throw new Error(`Catalog row ${i}: ${row.error.message}`);
    }
    out.push(row.data);
  }
  return out;
}

export async function loadCatalogFromApi(
  client: StatCanClient,
): Promise<CubeListItem[]> {
  const rows = await client.getAllCubesListLite();
  return rows as CubeListItem[];
}
