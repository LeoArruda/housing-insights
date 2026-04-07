import type { Database } from "bun:sqlite";

export type DownloadChannel = "wds_full_table_csv" | "statcan_portal_zip";
export type TrackedStatus = "pending" | "active" | "error";

export type StatcanTrackedDatasetRow = {
  id: number;
  product_id: number;
  frequency: string;
  hour_utc: number;
  minute_utc: number;
  day_of_week: number | null;
  day_of_month: number | null;
  download_channel: string;
  enabled: number;
  status: string;
  last_full_download_at: string | null;
  last_changed_check_at: string | null;
  last_changed_query_date: string | null;
  last_error: string | null;
  next_run_at: string | null;
  created_at: string;
  updated_at: string;
};

export type StatcanTrackedDatasetWithCatalogRow = StatcanTrackedDatasetRow & {
  cube_title_en: string | null;
  cube_title_fr: string | null;
};

export type InsertTrackedDatasetInput = {
  product_id: number;
  frequency: "daily" | "weekly" | "monthly";
  hour_utc?: number;
  minute_utc?: number;
  day_of_week?: number | null;
  day_of_month?: number | null;
  download_channel?: DownloadChannel;
  enabled?: boolean;
};

export type UpdateTrackedDatasetInput = Partial<{
  frequency: "daily" | "weekly" | "monthly";
  hour_utc: number;
  minute_utc: number;
  day_of_week: number | null;
  day_of_month: number | null;
  download_channel: DownloadChannel;
  enabled: boolean;
  status: TrackedStatus;
  next_run_at: string | null;
}>;

export function listDueTrackedDatasets(
  db: Database,
  nowIso: string,
): StatcanTrackedDatasetRow[] {
  return db
    .query(
      `SELECT * FROM statcan_tracked_datasets
       WHERE enabled = 1
         AND next_run_at IS NOT NULL
         AND next_run_at <= ?
       ORDER BY id`,
    )
    .all(nowIso) as StatcanTrackedDatasetRow[];
}

export function listAllTrackedWithCatalog(
  db: Database,
): StatcanTrackedDatasetWithCatalogRow[] {
  return db
    .query(
      `SELECT t.*, c.cube_title_en AS cube_title_en, c.cube_title_fr AS cube_title_fr
       FROM statcan_tracked_datasets t
       LEFT JOIN statcan_cube_catalog c ON c.product_id = t.product_id
       ORDER BY t.product_id`,
    )
    .all() as StatcanTrackedDatasetWithCatalogRow[];
}

export function getTrackedById(
  db: Database,
  id: number,
): StatcanTrackedDatasetRow | undefined {
  return db
    .query(`SELECT * FROM statcan_tracked_datasets WHERE id = ?`)
    .get(id) as StatcanTrackedDatasetRow | undefined;
}

export function getTrackedByIdWithCatalog(
  db: Database,
  id: number,
): StatcanTrackedDatasetWithCatalogRow | undefined {
  return db
    .query(
      `SELECT t.*, c.cube_title_en AS cube_title_en, c.cube_title_fr AS cube_title_fr
       FROM statcan_tracked_datasets t
       LEFT JOIN statcan_cube_catalog c ON c.product_id = t.product_id
       WHERE t.id = ?`,
    )
    .get(id) as StatcanTrackedDatasetWithCatalogRow | undefined;
}

export function getTrackedByProductId(
  db: Database,
  productId: number,
): StatcanTrackedDatasetRow | undefined {
  return db
    .query(`SELECT * FROM statcan_tracked_datasets WHERE product_id = ?`)
    .get(productId) as StatcanTrackedDatasetRow | undefined;
}

export function insertTrackedDataset(
  db: Database,
  input: InsertTrackedDatasetInput,
): number {
  const now = new Date().toISOString();
  const hour = input.hour_utc ?? 6;
  const minute = input.minute_utc ?? 0;
  const ch = input.download_channel ?? "wds_full_table_csv";
  const en = input.enabled !== false ? 1 : 0;
  const r = db.run(
    `INSERT INTO statcan_tracked_datasets (
       product_id, frequency, hour_utc, minute_utc, day_of_week, day_of_month,
       download_channel, enabled, status, next_run_at, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
    [
      input.product_id,
      input.frequency,
      hour,
      minute,
      input.day_of_week ?? null,
      input.day_of_month ?? null,
      ch,
      en,
      now,
      now,
      now,
    ],
  );
  return Number(r.lastInsertRowid);
}

export function updateTrackedDataset(
  db: Database,
  id: number,
  patch: UpdateTrackedDatasetInput,
): void {
  const now = new Date().toISOString();
  const sets: string[] = ["updated_at = ?"];
  const vals: (string | number | null)[] = [now];

  if (patch.frequency !== undefined) {
    sets.push("frequency = ?");
    vals.push(patch.frequency);
  }
  if (patch.hour_utc !== undefined) {
    sets.push("hour_utc = ?");
    vals.push(patch.hour_utc);
  }
  if (patch.minute_utc !== undefined) {
    sets.push("minute_utc = ?");
    vals.push(patch.minute_utc);
  }
  if (patch.day_of_week !== undefined) {
    sets.push("day_of_week = ?");
    vals.push(patch.day_of_week);
  }
  if (patch.day_of_month !== undefined) {
    sets.push("day_of_month = ?");
    vals.push(patch.day_of_month);
  }
  if (patch.download_channel !== undefined) {
    sets.push("download_channel = ?");
    vals.push(patch.download_channel);
  }
  if (patch.enabled !== undefined) {
    sets.push("enabled = ?");
    vals.push(patch.enabled ? 1 : 0);
  }
  if (patch.status !== undefined) {
    sets.push("status = ?");
    vals.push(patch.status);
  }
  if (patch.next_run_at !== undefined) {
    sets.push("next_run_at = ?");
    vals.push(patch.next_run_at);
  }

  vals.push(id);
  db.run(
    `UPDATE statcan_tracked_datasets SET ${sets.join(", ")} WHERE id = ?`,
    vals as (string | number | null)[],
  );
}

export function updateTrackedRunState(
  db: Database,
  id: number,
  fields: {
    last_full_download_at?: string | null;
    last_changed_check_at?: string | null;
    last_changed_query_date?: string | null;
    last_error?: string | null;
    status?: TrackedStatus;
    next_run_at?: string | null;
  },
): void {
  const now = new Date().toISOString();
  const sets: string[] = ["updated_at = ?"];
  const vals: (string | number | null)[] = [now];

  if (fields.last_full_download_at !== undefined) {
    sets.push("last_full_download_at = ?");
    vals.push(fields.last_full_download_at);
  }
  if (fields.last_changed_check_at !== undefined) {
    sets.push("last_changed_check_at = ?");
    vals.push(fields.last_changed_check_at);
  }
  if (fields.last_changed_query_date !== undefined) {
    sets.push("last_changed_query_date = ?");
    vals.push(fields.last_changed_query_date);
  }
  if (fields.last_error !== undefined) {
    sets.push("last_error = ?");
    vals.push(fields.last_error);
  }
  if (fields.status !== undefined) {
    sets.push("status = ?");
    vals.push(fields.status);
  }
  if (fields.next_run_at !== undefined) {
    sets.push("next_run_at = ?");
    vals.push(fields.next_run_at);
  }

  vals.push(id);
  db.run(
    `UPDATE statcan_tracked_datasets SET ${sets.join(", ")} WHERE id = ?`,
    vals as (string | number | null)[],
  );
}

export function deleteTrackedDataset(db: Database, id: number): boolean {
  const r = db.run(`DELETE FROM statcan_tracked_datasets WHERE id = ?`, [id]);
  return r.changes > 0;
}
