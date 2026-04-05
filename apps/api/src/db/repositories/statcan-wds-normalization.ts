import type { Database } from "bun:sqlite";

export const STATCAN_WDS_DATA_SOURCE = "statcan-wds-data" as const;

export type PendingWdsDataRawRow = {
  id: number;
  body: string;
};

/** Raw rows of type `statcan-wds-data` not yet normalized into `statcan_wds_data_batch`. */
export function listPendingStatcanWdsDataPayloads(
  db: Database,
  limit: number,
): PendingWdsDataRawRow[] {
  const cap = Math.min(Math.max(1, limit), 2_000);
  return db
    .query(
      `SELECT r.id, r.body
       FROM raw_payloads r
       WHERE r.source = ?
         AND NOT EXISTS (
           SELECT 1 FROM statcan_wds_data_batch b WHERE b.raw_payload_id = r.id
         )
       ORDER BY r.id ASC
       LIMIT ?`,
    )
    .all(STATCAN_WDS_DATA_SOURCE, cap) as PendingWdsDataRawRow[];
}

export function insertNormalizeError(
  db: Database,
  rawPayloadId: number,
  message: string,
): void {
  db.run(
    `INSERT INTO statcan_wds_normalize_error (raw_payload_id, message, created_at)
     VALUES (?, ?, ?)`,
    [rawPayloadId, message, new Date().toISOString()],
  );
}

export type ObservationListRow = {
  id: number;
  batch_id: number;
  raw_payload_id: number;
  product_id: number;
  vector_id: number | null;
  coordinate: string | null;
  ref_per: string;
  value: number;
  decimals: number | null;
};

export function listStatcanWdsObservations(
  db: Database,
  filter: { productId?: number; limit: number; offset: number },
): ObservationListRow[] {
  const limit = Math.min(Math.max(1, filter.limit), 500);
  const offset = Math.max(0, filter.offset);
  if (filter.productId != null) {
    return db
      .query(
        `SELECT o.id, o.batch_id, o.raw_payload_id, b.product_id, b.vector_id, b.coordinate,
                o.ref_per, o.value, o.decimals
         FROM statcan_wds_data_observation o
         INNER JOIN statcan_wds_data_batch b ON b.id = o.batch_id
         WHERE b.product_id = ?
         ORDER BY o.ref_per DESC, o.id DESC
         LIMIT ? OFFSET ?`,
      )
      .all(filter.productId, limit, offset) as ObservationListRow[];
  }
  return db
    .query(
      `SELECT o.id, o.batch_id, o.raw_payload_id, b.product_id, b.vector_id, b.coordinate,
              o.ref_per, o.value, o.decimals
       FROM statcan_wds_data_observation o
       INNER JOIN statcan_wds_data_batch b ON b.id = o.batch_id
       ORDER BY o.ref_per DESC, o.id DESC
       LIMIT ? OFFSET ?`,
    )
    .all(limit, offset) as ObservationListRow[];
}

export type DataPointInput = {
  refPer: string;
  value: number;
  decimals?: number;
};

/**
 * Insert one batch row and observation rows in a single transaction.
 * Idempotent at DB level: `UNIQUE(raw_payload_id)` on batch prevents duplicates.
 */
export function insertBatchWithObservations(
  db: Database,
  args: {
    rawPayloadId: number;
    productId: number;
    vectorId: number | null;
    coordinate: string | null;
    points: DataPointInput[];
  },
): number {
  const createdAt = new Date().toISOString();
  const pointCount = args.points.length;
  let batchId = 0;

  const tx = db.transaction(() => {
    db.run(
      `INSERT INTO statcan_wds_data_batch
       (raw_payload_id, product_id, vector_id, coordinate, point_count, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        args.rawPayloadId,
        args.productId,
        args.vectorId,
        args.coordinate,
        pointCount,
        createdAt,
      ],
    );
    batchId = Number(
      (db.query("SELECT last_insert_rowid() AS id").get() as { id: number }).id,
    );
    for (const p of args.points) {
      db.run(
        `INSERT INTO statcan_wds_data_observation
         (batch_id, raw_payload_id, ref_per, value, decimals)
         VALUES (?, ?, ?, ?, ?)`,
        [
          batchId,
          args.rawPayloadId,
          p.refPer,
          p.value,
          p.decimals ?? null,
        ],
      );
    }
  });

  tx();
  return batchId;
}
