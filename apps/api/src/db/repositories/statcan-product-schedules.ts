import type { Database } from "bun:sqlite";

export type StatcanProductScheduleRow = {
  id: number;
  product_id: number;
  frequency: string;
  hour_utc: number;
  minute_utc: number;
  day_of_week: number | null;
  day_of_month: number | null;
  latest_n: number | null;
  data_coordinate: string | null;
  data_vector_id: number | null;
  fetch_metadata: number;
  fetch_data: number;
  enabled: number;
  next_run_at: string | null;
  last_run_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

export function listDueSchedules(
  db: Database,
  nowIso: string,
): StatcanProductScheduleRow[] {
  return db
    .query(
      `SELECT * FROM statcan_product_schedules
       WHERE enabled = 1
         AND next_run_at IS NOT NULL
         AND next_run_at <= ?
       ORDER BY id`,
    )
    .all(nowIso) as StatcanProductScheduleRow[];
}

export function listAllSchedules(db: Database): StatcanProductScheduleRow[] {
  return db
    .query(`SELECT * FROM statcan_product_schedules ORDER BY product_id`)
    .all() as StatcanProductScheduleRow[];
}

export function getScheduleById(
  db: Database,
  id: number,
): StatcanProductScheduleRow | undefined {
  return db
    .query(`SELECT * FROM statcan_product_schedules WHERE id = ?`)
    .get(id) as StatcanProductScheduleRow | undefined;
}

export function getScheduleByProductId(
  db: Database,
  productId: number,
): StatcanProductScheduleRow | undefined {
  return db
    .query(`SELECT * FROM statcan_product_schedules WHERE product_id = ?`)
    .get(productId) as StatcanProductScheduleRow | undefined;
}

export type InsertScheduleInput = {
  product_id: number;
  frequency: string;
  hour_utc: number;
  minute_utc: number;
  day_of_week: number | null;
  day_of_month: number | null;
  latest_n: number | null;
  data_coordinate: string | null;
  data_vector_id: number | null;
  fetch_metadata: boolean;
  fetch_data: boolean;
  enabled: boolean;
  next_run_at: string | null;
};

export function insertSchedule(
  db: Database,
  input: InsertScheduleInput,
): number {
  const now = new Date().toISOString();
  const r = db.run(
    `INSERT INTO statcan_product_schedules (
      product_id, frequency, hour_utc, minute_utc, day_of_week, day_of_month,
      latest_n, data_coordinate, data_vector_id, fetch_metadata, fetch_data,
      enabled, next_run_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.product_id,
      input.frequency,
      input.hour_utc,
      input.minute_utc,
      input.day_of_week,
      input.day_of_month,
      input.latest_n,
      input.data_coordinate,
      input.data_vector_id,
      input.fetch_metadata ? 1 : 0,
      input.fetch_data ? 1 : 0,
      input.enabled ? 1 : 0,
      input.next_run_at,
      now,
      now,
    ],
  );
  return Number(r.lastInsertRowid);
}

export type UpdateSchedulePatch = Partial<{
  frequency: string;
  hour_utc: number;
  minute_utc: number;
  day_of_week: number | null;
  day_of_month: number | null;
  latest_n: number | null;
  data_coordinate: string | null;
  data_vector_id: number | null;
  fetch_metadata: boolean;
  fetch_data: boolean;
  enabled: boolean;
  next_run_at: string | null;
}>;

export function updateSchedule(
  db: Database,
  id: number,
  patch: UpdateSchedulePatch,
): void {
  const row = getScheduleById(db, id);
  if (!row) return;
  const now = new Date().toISOString();
  const merged = {
    frequency: patch.frequency ?? row.frequency,
    hour_utc: patch.hour_utc ?? row.hour_utc,
    minute_utc: patch.minute_utc ?? row.minute_utc,
    day_of_week:
      patch.day_of_week !== undefined ? patch.day_of_week : row.day_of_week,
    day_of_month:
      patch.day_of_month !== undefined ? patch.day_of_month : row.day_of_month,
    latest_n: patch.latest_n !== undefined ? patch.latest_n : row.latest_n,
    data_coordinate:
      patch.data_coordinate !== undefined
        ? patch.data_coordinate
        : row.data_coordinate,
    data_vector_id:
      patch.data_vector_id !== undefined
        ? patch.data_vector_id
        : row.data_vector_id,
    fetch_metadata:
      patch.fetch_metadata !== undefined
        ? patch.fetch_metadata
        : row.fetch_metadata === 1,
    fetch_data:
      patch.fetch_data !== undefined ? patch.fetch_data : row.fetch_data === 1,
    enabled: patch.enabled !== undefined ? patch.enabled : row.enabled === 1,
    next_run_at:
      patch.next_run_at !== undefined ? patch.next_run_at : row.next_run_at,
  };
  db.run(
    `UPDATE statcan_product_schedules SET
      frequency = ?, hour_utc = ?, minute_utc = ?, day_of_week = ?, day_of_month = ?,
      latest_n = ?, data_coordinate = ?, data_vector_id = ?, fetch_metadata = ?, fetch_data = ?,
      enabled = ?, next_run_at = ?, updated_at = ?
    WHERE id = ?`,
    [
      merged.frequency,
      merged.hour_utc,
      merged.minute_utc,
      merged.day_of_week,
      merged.day_of_month,
      merged.latest_n,
      merged.data_coordinate,
      merged.data_vector_id,
      merged.fetch_metadata ? 1 : 0,
      merged.fetch_data ? 1 : 0,
      merged.enabled ? 1 : 0,
      merged.next_run_at,
      now,
      id,
    ],
  );
}

export function updateScheduleRunState(
  db: Database,
  id: number,
  lastRunAt: string,
  nextRunAt: string,
  lastError: string | null,
): void {
  const now = new Date().toISOString();
  db.run(
    `UPDATE statcan_product_schedules SET
      last_run_at = ?, next_run_at = ?, last_error = ?, updated_at = ?
    WHERE id = ?`,
    [lastRunAt, nextRunAt, lastError, now, id],
  );
}

export function deleteSchedule(db: Database, id: number): boolean {
  const r = db.run(`DELETE FROM statcan_product_schedules WHERE id = ?`, [id]);
  return r.changes > 0;
}
