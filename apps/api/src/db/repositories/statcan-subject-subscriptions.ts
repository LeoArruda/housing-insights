import type { Database } from "bun:sqlite";

export type StatcanSubjectSubscriptionRow = {
  id: number;
  subject_code: string;
  label: string | null;
  enabled: number;
  created_at: string;
  updated_at: string;
};

export function listAllSubscriptions(
  db: Database,
): StatcanSubjectSubscriptionRow[] {
  return db
    .query(
      `SELECT * FROM statcan_subject_subscriptions ORDER BY subject_code`,
    )
    .all() as StatcanSubjectSubscriptionRow[];
}

export function listEnabledSubscriptions(
  db: Database,
): StatcanSubjectSubscriptionRow[] {
  return db
    .query(
      `SELECT * FROM statcan_subject_subscriptions WHERE enabled = 1 ORDER BY subject_code`,
    )
    .all() as StatcanSubjectSubscriptionRow[];
}

export function getSubscriptionById(
  db: Database,
  id: number,
): StatcanSubjectSubscriptionRow | undefined {
  return db
    .query(`SELECT * FROM statcan_subject_subscriptions WHERE id = ?`)
    .get(id) as StatcanSubjectSubscriptionRow | undefined;
}

export function getSubscriptionBySubjectCode(
  db: Database,
  code: string,
): StatcanSubjectSubscriptionRow | undefined {
  return db
    .query(`SELECT * FROM statcan_subject_subscriptions WHERE subject_code = ?`)
    .get(code) as StatcanSubjectSubscriptionRow | undefined;
}

export type InsertSubscriptionInput = {
  subject_code: string;
  label: string | null;
  enabled: boolean;
};

export function insertSubscription(
  db: Database,
  input: InsertSubscriptionInput,
): number {
  const now = new Date().toISOString();
  const r = db.run(
    `INSERT INTO statcan_subject_subscriptions (subject_code, label, enabled, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
    [
      input.subject_code.trim(),
      input.label,
      input.enabled ? 1 : 0,
      now,
      now,
    ],
  );
  return Number(r.lastInsertRowid);
}

export type UpdateSubscriptionPatch = Partial<{
  label: string | null;
  enabled: boolean;
}>;

export function updateSubscription(
  db: Database,
  id: number,
  patch: UpdateSubscriptionPatch,
): void {
  const row = getSubscriptionById(db, id);
  if (!row) return;
  const now = new Date().toISOString();
  const label = patch.label !== undefined ? patch.label : row.label;
  const enabled =
    patch.enabled !== undefined ? (patch.enabled ? 1 : 0) : row.enabled;
  db.run(
    `UPDATE statcan_subject_subscriptions SET label = ?, enabled = ?, updated_at = ? WHERE id = ?`,
    [label, enabled, now, id],
  );
}

export function deleteSubscription(db: Database, id: number): boolean {
  const r = db.run(`DELETE FROM statcan_subject_subscriptions WHERE id = ?`, [
    id,
  ]);
  return r.changes > 0;
}
