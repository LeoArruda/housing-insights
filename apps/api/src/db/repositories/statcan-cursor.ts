import type { Database } from "bun:sqlite";

export function upsertCursorMetadata(
  db: Database,
  productId: number,
  sha256: string,
  at: string,
): void {
  db.run(
    `INSERT INTO statcan_ingest_cursor (product_id, last_metadata_sha256, last_metadata_at)
     VALUES (?, ?, ?)
     ON CONFLICT(product_id) DO UPDATE SET
       last_metadata_sha256 = excluded.last_metadata_sha256,
       last_metadata_at = excluded.last_metadata_at`,
    [productId, sha256, at],
  );
}

export function upsertCursorData(
  db: Database,
  productId: number,
  at: string,
): void {
  db.run(
    `INSERT INTO statcan_ingest_cursor (product_id, last_data_at)
     VALUES (?, ?)
     ON CONFLICT(product_id) DO UPDATE SET last_data_at = excluded.last_data_at`,
    [productId, at],
  );
}

export function setCursorError(
  db: Database,
  productId: number,
  err: string | null,
): void {
  db.run(
    `INSERT INTO statcan_ingest_cursor (product_id, last_error)
     VALUES (?, ?)
     ON CONFLICT(product_id) DO UPDATE SET last_error = excluded.last_error`,
    [productId, err],
  );
}
