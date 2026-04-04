import type { Database } from "bun:sqlite";

export type CubeCatalogRow = {
  product_id: number;
  cansim_id: string | null;
  cube_title_en: string | null;
  cube_title_fr: string | null;
  archived: string | null;
  frequency_code: number | null;
  subject_codes: string | null;
  housing_score: number;
  macro_score: number;
  indexed_at: string;
  raw_json: string | null;
};

export function upsertCubeCatalog(db: Database, row: CubeCatalogRow): void {
  db.run(
    `INSERT INTO statcan_cube_catalog (
      product_id, cansim_id, cube_title_en, cube_title_fr, archived,
      frequency_code, subject_codes, housing_score, macro_score, indexed_at, raw_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(product_id) DO UPDATE SET
      cansim_id = excluded.cansim_id,
      cube_title_en = excluded.cube_title_en,
      cube_title_fr = excluded.cube_title_fr,
      archived = excluded.archived,
      frequency_code = excluded.frequency_code,
      subject_codes = excluded.subject_codes,
      housing_score = excluded.housing_score,
      macro_score = excluded.macro_score,
      indexed_at = excluded.indexed_at,
      raw_json = excluded.raw_json`,
    [
      row.product_id,
      row.cansim_id,
      row.cube_title_en,
      row.cube_title_fr,
      row.archived,
      row.frequency_code,
      row.subject_codes,
      row.housing_score,
      row.macro_score,
      row.indexed_at,
      row.raw_json,
    ],
  );
}

export function listKeywordTargets(
  db: Database,
  minScore: number,
  limit: number,
): number[] {
  const rows = db
    .query(
      `SELECT product_id FROM statcan_cube_catalog
       WHERE housing_score >= ? OR macro_score >= ?
       ORDER BY (housing_score + macro_score) DESC
       LIMIT ?`,
    )
    .all(minScore, minScore, limit) as { product_id: number }[];
  return rows.map((r) => r.product_id);
}

export function countCatalogRows(db: Database): number {
  const row = db
    .query(`SELECT COUNT(*) AS c FROM statcan_cube_catalog`)
    .get() as { c: number };
  return row.c;
}

export function catalogHasProduct(db: Database, productId: number): boolean {
  const row = db
    .query(
      `SELECT 1 AS ok FROM statcan_cube_catalog WHERE product_id = ? LIMIT 1`,
    )
    .get(productId) as { ok: number } | undefined;
  return row != null;
}

export type CatalogSearchRow = {
  product_id: number;
  cansim_id: string | null;
  cube_title_en: string | null;
  cube_title_fr: string | null;
  archived: string | null;
  housing_score: number;
  macro_score: number;
};

/** `q` empty: browse by product_id. Else integer string → product_id match; else case-insensitive substring on EN/FR titles. */
export function searchCatalog(
  db: Database,
  q: string | undefined,
  limit: number,
  offset: number,
): CatalogSearchRow[] {
  const lim = Math.min(Math.max(limit, 1), 100);
  const off = Math.max(offset, 0);
  const trimmed = q?.trim() ?? "";

  if (trimmed === "") {
    return db
      .query(
        `SELECT product_id, cansim_id, cube_title_en, cube_title_fr, archived, housing_score, macro_score
         FROM statcan_cube_catalog
         ORDER BY product_id
         LIMIT ? OFFSET ?`,
      )
      .all(lim, off) as CatalogSearchRow[];
  }

  const asInt = Number(trimmed);
  if (Number.isInteger(asInt) && String(asInt) === trimmed && asInt > 0) {
    return db
      .query(
        `SELECT product_id, cansim_id, cube_title_en, cube_title_fr, archived, housing_score, macro_score
         FROM statcan_cube_catalog
         WHERE product_id = ?
         LIMIT ? OFFSET ?`,
      )
      .all(asInt, lim, off) as CatalogSearchRow[];
  }

  const needle = trimmed.toLowerCase();
  return db
    .query(
      `SELECT product_id, cansim_id, cube_title_en, cube_title_fr, archived, housing_score, macro_score
       FROM statcan_cube_catalog
       WHERE instr(lower(coalesce(cube_title_en, '')), ?) > 0
          OR instr(lower(coalesce(cube_title_fr, '')), ?) > 0
       ORDER BY product_id
       LIMIT ? OFFSET ?`,
    )
    .all(needle, needle, lim, off) as CatalogSearchRow[];
}
