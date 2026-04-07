import type { Database } from "bun:sqlite";
import { Hono } from "hono";
import { z } from "zod";
import * as jobRunsRepo from "../db/repositories/job-runs.ts";
import * as operationLogsRepo from "../db/repositories/operation-logs.ts";
import * as rawPayloadsRepo from "../db/repositories/raw-payloads.ts";
import * as statcanCatalogRepo from "../db/repositories/statcan-catalog.ts";
import * as statcanWdsNormRepo from "../db/repositories/statcan-wds-normalization.ts";
import { StatCanClient } from "../connectors/statcan/statcan-client.ts";
import * as statcanSchedulesRepo from "../db/repositories/statcan-product-schedules.ts";
import * as statcanSubscriptionsRepo from "../db/repositories/statcan-subject-subscriptions.ts";
import * as statcanTrackedRepo from "../db/repositories/statcan-tracked-datasets.ts";
import type { StatcanTrackedDatasetWithCatalogRow } from "../db/repositories/statcan-tracked-datasets.ts";
import { runBulkTrackedDatasetRefresh } from "../jobs/statcan-bulk-tracked-sync.ts";
import type { JobContext } from "../jobs/runners.ts";
import type { Env } from "../env.ts";
import { sha256Hex } from "../util/hash.ts";
import { computeNextRunAfter } from "../services/statcan-next-run.ts";
import {
  jobStatusSchema,
  operationLogLevelSchema,
} from "@housing-insights/types";
import { appendOperationalLog } from "../logging/operational.ts";
import { corsAllowOriginMiddleware } from "./cors.ts";
import { dashboardAuthMiddleware, requireOperator } from "./dashboard-auth.ts";

const scheduleFrequencySchema = z.enum(["daily", "weekly", "monthly"]);

const statcanIngestModeSchema = z.enum([
  "latest_n",
  "changed_series",
  "changed_cube",
  "bulk_range",
  "full_table_csv",
  "full_table_sdmx",
]);

const scheduleFieldsSchema = z.object({
  product_id: z.number().int().positive(),
  frequency: scheduleFrequencySchema,
  hour_utc: z.number().int().min(0).max(23),
  minute_utc: z.number().int().min(0).max(59).default(0),
  day_of_week: z.number().int().min(0).max(6).nullable().optional(),
  day_of_month: z.number().int().min(1).max(31).nullable().optional(),
  latest_n: z.number().int().min(1).max(200).nullable().optional(),
  data_coordinate: z.string().nullable().optional(),
  data_vector_id: z.number().int().positive().nullable().optional(),
  ingest_mode: statcanIngestModeSchema.default("latest_n"),
  bulk_release_start: z.string().nullable().optional(),
  bulk_release_end: z.string().nullable().optional(),
  fetch_metadata: z.boolean().default(true),
  fetch_data: z.boolean().default(true),
  enabled: z.boolean().default(true),
  next_run_at: z.string().nullable().optional(),
});

const createScheduleBodySchema = scheduleFieldsSchema.superRefine(
  (data, ctx) => {
    if (data.frequency === "weekly" && data.day_of_week == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "day_of_week is required when frequency is weekly",
        path: ["day_of_week"],
      });
    }
    if (data.frequency === "monthly" && data.day_of_month == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "day_of_month is required when frequency is monthly",
        path: ["day_of_month"],
      });
    }
  },
);

const patchScheduleBodySchema = scheduleFieldsSchema
  .partial()
  .omit({ product_id: true });

const downloadChannelSchema = z.enum([
  "wds_full_table_csv",
  "statcan_portal_zip",
]);

const trackedBodySchema = z.object({
  product_id: z.number().int().positive(),
  frequency: scheduleFrequencySchema,
  hour_utc: z.number().int().min(0).max(23).default(6),
  minute_utc: z.number().int().min(0).max(59).default(0),
  day_of_week: z.number().int().min(0).max(6).nullable().optional(),
  day_of_month: z.number().int().min(1).max(31).nullable().optional(),
  download_channel: downloadChannelSchema.default("wds_full_table_csv"),
  enabled: z.boolean().default(true),
});

const trackedCreateSchema = trackedBodySchema.superRefine((data, ctx) => {
  if (data.frequency === "weekly" && data.day_of_week == null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "day_of_week is required when frequency is weekly",
      path: ["day_of_week"],
    });
  }
  if (data.frequency === "monthly" && data.day_of_month == null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "day_of_month is required when frequency is monthly",
      path: ["day_of_month"],
    });
  }
});

const trackedPatchSchema = trackedBodySchema.partial().omit({ product_id: true });

function trackedRowToJson(row: StatcanTrackedDatasetWithCatalogRow) {
  return {
    id: row.id,
    product_id: row.product_id,
    frequency: row.frequency,
    hour_utc: row.hour_utc,
    minute_utc: row.minute_utc,
    day_of_week: row.day_of_week,
    day_of_month: row.day_of_month,
    download_channel: row.download_channel,
    enabled: row.enabled === 1,
    status: row.status,
    last_full_download_at: row.last_full_download_at,
    last_changed_check_at: row.last_changed_check_at,
    last_changed_query_date: row.last_changed_query_date,
    last_error: row.last_error,
    next_run_at: row.next_run_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    cube_title_en: row.cube_title_en ?? null,
    cube_title_fr: row.cube_title_fr ?? null,
  };
}

function scheduleRowToJson(
  row: statcanSchedulesRepo.StatcanProductScheduleWithCatalogRow,
) {
  return {
    id: row.id,
    product_id: row.product_id,
    frequency: row.frequency,
    hour_utc: row.hour_utc,
    minute_utc: row.minute_utc,
    day_of_week: row.day_of_week,
    day_of_month: row.day_of_month,
    latest_n: row.latest_n,
    data_coordinate: row.data_coordinate,
    data_vector_id: row.data_vector_id,
    ingest_mode: row.ingest_mode ?? "latest_n",
    bulk_release_start: row.bulk_release_start,
    bulk_release_end: row.bulk_release_end,
    fetch_metadata: row.fetch_metadata === 1,
    fetch_data: row.fetch_data === 1,
    enabled: row.enabled === 1,
    next_run_at: row.next_run_at,
    last_run_at: row.last_run_at,
    last_error: row.last_error,
    created_at: row.created_at,
    updated_at: row.updated_at,
    cube_title_en: row.cube_title_en ?? null,
    cube_title_fr: row.cube_title_fr ?? null,
  };
}

export function createApp(db: Database, env: Env) {
  const app = new Hono();

  app.onError((err, c) => {
    appendOperationalLog(db, env, {
      source: "api",
      level: "error",
      message: err instanceof Error ? err.message : String(err),
      detail: {
        path: c.req.path,
        method: c.req.method,
        stack: err instanceof Error ? err.stack : undefined,
      },
    });
    return c.json({ error: "Internal Server Error" }, 500);
  });

  app.get("/health", (c) => c.json({ status: "ok" }));

  app.get("/health/ready", (c) => {
    try {
      db.query("SELECT 1 AS ok").get();
      return c.json({ status: "ready", database: true });
    } catch {
      return c.json({ status: "not_ready", database: false }, 503);
    }
  });

  const corsOrigin = env.CORS_ALLOW_ORIGIN?.trim();
  if (corsOrigin) {
    app.use("*", corsAllowOriginMiddleware(corsOrigin));
  }

  app.use("*", dashboardAuthMiddleware(env, { db }));

  app.get("/job-runs", (c) => {
    const q = c.req.query();
    const job_name = q.job_name;
    const statusParse = q.status
      ? jobStatusSchema.safeParse(q.status)
      : { success: true as const, data: undefined };
    if (!statusParse.success) {
      return c.json({ error: "Invalid status" }, 400);
    }
    const limit = z.coerce.number().min(1).max(500).safeParse(q.limit);
    const rows = jobRunsRepo.listJobRuns(db, {
      job_name: job_name ?? undefined,
      status: statusParse.data,
      limit: limit.success ? limit.data : 50,
    });
    return c.json({ data: rows });
  });

  app.get("/operations/logs", (c) => {
    const q = c.req.query();
    const from = q.from?.trim() || undefined;
    const to = q.to?.trim() || undefined;
    const source = q.source?.trim() || undefined;
    const qStr = q.q?.trim() || undefined;
    const jobRunParse = z.coerce.number().int().positive().safeParse(q.job_run_id);
    const levelParse = q.level
      ? operationLogLevelSchema.safeParse(q.level)
      : { success: true as const, data: undefined };
    if (!levelParse.success) {
      return c.json({ error: "Invalid level" }, 400);
    }
    const limitParse = z.coerce.number().min(1).max(500).safeParse(q.limit);
    const offsetParse = z.coerce.number().min(0).safeParse(q.offset);
    const rows = operationLogsRepo.listOperationLogs(db, {
      from,
      to,
      level: levelParse.data,
      source,
      jobRunId: jobRunParse.success ? jobRunParse.data : undefined,
      q: qStr,
      limit: limitParse.success ? limitParse.data : 50,
      offset: offsetParse.success ? offsetParse.data : 0,
    });
    return c.json({ data: rows });
  });

  app.get("/job-runs/:id", (c) => {
    const id = Number(c.req.param("id"));
    if (!Number.isFinite(id)) {
      return c.json({ error: "Invalid id" }, 400);
    }
    const row = jobRunsRepo.getJobRunById(db, id);
    if (!row) {
      return c.json({ error: "Not found" }, 404);
    }
    return c.json(row);
  });

  app.get("/raw-payloads", (c) => {
    const q = c.req.query();
    const source = q.source;
    const limit = z.coerce.number().min(1).max(500).safeParse(q.limit);
    const offset = z.coerce.number().min(0).safeParse(q.offset);
    const rows = rawPayloadsRepo.listRawPayloads(db, {
      source: source ?? undefined,
      limit: limit.success ? limit.data : 50,
      offset: offset.success ? offset.data : 0,
    });
    return c.json({ data: rows });
  });

  app.get("/stats/summary", (c) => {
    const window = c.req.query("window") ?? "24h";
    if (window !== "24h") {
      return c.json({ error: "Unsupported window" }, 400);
    }
    const sinceIso = new Date(
      Date.now() - 24 * 60 * 60 * 1000,
    ).toISOString();
    const jobCounts = jobRunsRepo.getJobRunCountsForDashboard(db, sinceIso);
    const recentFailed = jobRunsRepo.listRecentFailedJobRuns(db, 15);
    const schedules = statcanSchedulesRepo.getScheduleDashboardStats(db);
    return c.json({
      window_utc_hours: 24,
      job_runs_finished_last_window: {
        success: jobCounts.success,
        failed: jobCounts.failed,
      },
      job_runs_running_unfinished: jobCounts.running_unfinished,
      recent_failed_runs: recentFailed,
      schedules,
    });
  });

  const statcanCatalog = new Hono();
  statcanCatalog.use(requireOperator({ db, env }));
  statcanCatalog.get("/", (c) => {
    const q = c.req.query("q");
    const limitParse = z.coerce
      .number()
      .min(1)
      .max(100)
      .safeParse(c.req.query("limit"));
    const offsetParse = z.coerce
      .number()
      .min(0)
      .safeParse(c.req.query("offset"));
    const limit = limitParse.success ? limitParse.data : 25;
    const offset = offsetParse.success ? offsetParse.data : 0;
    const rows = statcanCatalogRepo.searchCatalog(db, q, limit, offset);
    return c.json({ data: rows, limit, offset });
  });
  app.route("/statcan/catalog", statcanCatalog);

  const statcanSchedules = new Hono();
  statcanSchedules.use(requireOperator({ db, env }));
  statcanSchedules.get("/", (c) => {
    const rows = statcanSchedulesRepo.listAllSchedulesWithCatalog(db);
    return c.json({ data: rows.map(scheduleRowToJson) });
  });

  statcanSchedules.post("/", async (c) => {
    let bodyJson: unknown;
    try {
      bodyJson = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }
    const parsed = createScheduleBodySchema.safeParse(bodyJson);
    if (!parsed.success) {
      return c.json({ error: parsed.error.flatten() }, 400);
    }
    const body = parsed.data;
    if (
      statcanCatalogRepo.countCatalogRows(db) > 0 &&
      !statcanCatalogRepo.catalogHasProduct(db, body.product_id)
    ) {
      return c.json(
        { error: "product_id not found in statcan_cube_catalog" },
        400,
      );
    }
    if (statcanSchedulesRepo.getScheduleByProductId(db, body.product_id)) {
      return c.json(
        { error: "A schedule already exists for this product_id" },
        409,
      );
    }
    const next_run_at =
      body.next_run_at ??
      computeNextRunAfter(new Date(), {
        frequency: body.frequency,
        hourUtc: body.hour_utc,
        minuteUtc: body.minute_utc,
        dayOfWeek: body.day_of_week ?? null,
        dayOfMonth: body.day_of_month ?? null,
      }).toISOString();
    const id = statcanSchedulesRepo.insertSchedule(db, {
      product_id: body.product_id,
      frequency: body.frequency,
      hour_utc: body.hour_utc,
      minute_utc: body.minute_utc,
      day_of_week: body.day_of_week ?? null,
      day_of_month: body.day_of_month ?? null,
      latest_n: body.latest_n ?? null,
      data_coordinate: body.data_coordinate ?? null,
      data_vector_id: body.data_vector_id ?? null,
      ingest_mode: body.ingest_mode,
      bulk_release_start: body.bulk_release_start ?? null,
      bulk_release_end: body.bulk_release_end ?? null,
      fetch_metadata: body.fetch_metadata,
      fetch_data: body.fetch_data,
      enabled: body.enabled,
      next_run_at,
    });
    const row = statcanSchedulesRepo.getScheduleByIdWithCatalog(db, id);
    return c.json(scheduleRowToJson(row!), 201);
  });

  statcanSchedules.patch("/:id", async (c) => {
    const id = Number(c.req.param("id"));
    if (!Number.isFinite(id)) {
      return c.json({ error: "Invalid id" }, 400);
    }
    const existing = statcanSchedulesRepo.getScheduleById(db, id);
    if (!existing) {
      return c.json({ error: "Not found" }, 404);
    }
    let bodyJson: unknown;
    try {
      bodyJson = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }
    const parsed = patchScheduleBodySchema.safeParse(bodyJson);
    if (!parsed.success) {
      return c.json({ error: parsed.error.flatten() }, 400);
    }
    const p = parsed.data;
    const mergedFreq = p.frequency ?? existing.frequency;
    const mergedDow =
      p.day_of_week !== undefined ? p.day_of_week : existing.day_of_week;
    const mergedDom =
      p.day_of_month !== undefined ? p.day_of_month : existing.day_of_month;
    if (mergedFreq === "weekly" && mergedDow == null) {
      return c.json(
        { error: "day_of_week is required when frequency is weekly" },
        400,
      );
    }
    if (mergedFreq === "monthly" && mergedDom == null) {
      return c.json(
        { error: "day_of_month is required when frequency is monthly" },
        400,
      );
    }
    statcanSchedulesRepo.updateSchedule(db, id, p);
    const row = statcanSchedulesRepo.getScheduleByIdWithCatalog(db, id);
    return c.json(scheduleRowToJson(row!));
  });

  statcanSchedules.delete("/:id", (c) => {
    const id = Number(c.req.param("id"));
    if (!Number.isFinite(id)) {
      return c.json({ error: "Invalid id" }, 400);
    }
    const ok = statcanSchedulesRepo.deleteSchedule(db, id);
    if (!ok) {
      return c.json({ error: "Not found" }, 404);
    }
    return c.body(null, 204);
  });

  app.route("/statcan/schedules", statcanSchedules);

  const statcanIngestTools = new Hono();
  statcanIngestTools.use(requireOperator({ db, env }));
  const cubeMetaBodySchema = z.object({
    product_id: z.number().int().positive(),
  });
  const seriesInfoBodySchema = z
    .object({
      product_id: z.number().int().positive(),
      coordinate: z.string().min(1).optional(),
      vector_id: z.number().int().positive().optional(),
    })
    .superRefine((data, ctx) => {
      if (!data.coordinate && data.vector_id == null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Provide coordinate or vector_id",
          path: ["coordinate"],
        });
      }
    });
  const fullTableBodySchema = z.object({
    product_id: z.number().int().positive(),
    format: z.enum(["csv", "sdmx"]),
    lang: z.enum(["en", "fr"]).optional(),
  });

  statcanIngestTools.post("/cube-metadata", async (c) => {
    let bodyJson: unknown;
    try {
      bodyJson = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }
    const parsed = cubeMetaBodySchema.safeParse(bodyJson);
    if (!parsed.success) {
      return c.json({ error: parsed.error.flatten() }, 400);
    }
    if (
      statcanCatalogRepo.countCatalogRows(db) > 0 &&
      !statcanCatalogRepo.catalogHasProduct(db, parsed.data.product_id)
    ) {
      return c.json(
        { error: "product_id not found in statcan_cube_catalog" },
        400,
      );
    }
    const client = StatCanClient.fromEnv(env);
    const data = await client.getCubeMetadata(parsed.data.product_id);
    return c.json({ data });
  });

  statcanIngestTools.post("/series-info", async (c) => {
    let bodyJson: unknown;
    try {
      bodyJson = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }
    const parsed = seriesInfoBodySchema.safeParse(bodyJson);
    if (!parsed.success) {
      return c.json({ error: parsed.error.flatten() }, 400);
    }
    const { product_id, coordinate, vector_id } = parsed.data;
    if (
      statcanCatalogRepo.countCatalogRows(db) > 0 &&
      !statcanCatalogRepo.catalogHasProduct(db, product_id)
    ) {
      return c.json(
        { error: "product_id not found in statcan_cube_catalog" },
        400,
      );
    }
    const client = StatCanClient.fromEnv(env);
    const data =
      vector_id != null
        ? await client.getSeriesInfoFromVector(vector_id)
        : await client.getSeriesInfoFromCubePidCoord(
            product_id,
            coordinate!,
          );
    return c.json({ data });
  });

  statcanIngestTools.post("/full-table", async (c) => {
    let bodyJson: unknown;
    try {
      bodyJson = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }
    const parsed = fullTableBodySchema.safeParse(bodyJson);
    if (!parsed.success) {
      return c.json({ error: parsed.error.flatten() }, 400);
    }
    const { product_id, format } = parsed.data;
    const lang = parsed.data.lang ?? "en";
    if (
      statcanCatalogRepo.countCatalogRows(db) > 0 &&
      !statcanCatalogRepo.catalogHasProduct(db, product_id)
    ) {
      return c.json(
        { error: "product_id not found in statcan_cube_catalog" },
        400,
      );
    }
    const client = StatCanClient.fromEnv(env);
    if (format === "csv") {
      const csv = await client.getFullTableDownloadCSV(product_id, lang);
      const sha = sha256Hex(csv);
      rawPayloadsRepo.insertRawPayload(db, {
        source: "statcan-wds-full-table",
        sourceKey: `api:full-table-csv:${product_id}:${lang}`,
        contentType: "text/csv",
        body: csv,
        sha256: sha,
        jobRunId: null,
      });
      return c.json({ ok: true, sha256: sha, format: "csv" });
    }
    const b64 = await client.getFullTableDownloadSDMXBase64(product_id);
    const sha = sha256Hex(b64);
    rawPayloadsRepo.insertRawPayload(db, {
      source: "statcan-wds-full-table",
      sourceKey: `api:full-table-sdmx:${product_id}`,
      contentType: "application/octet-stream",
      body: b64,
      sha256: sha,
      jobRunId: null,
    });
    return c.json({ ok: true, sha256: sha, format: "sdmx" });
  });

  app.route("/statcan/ingest", statcanIngestTools);

  const statcanSubscriptions = new Hono();
  statcanSubscriptions.use(requireOperator({ db, env }));
  const subscriptionCreateSchema = z.object({
    subject_code: z.string().min(1).max(64),
    label: z.string().max(200).nullable().optional(),
    enabled: z.boolean().optional(),
  });
  const subscriptionPatchSchema = z.object({
    label: z.string().max(200).nullable().optional(),
    enabled: z.boolean().optional(),
  });

  statcanSubscriptions.get("/", (c) => {
    const rows = statcanSubscriptionsRepo.listAllSubscriptions(db);
    return c.json({
      data: rows.map((r) => ({
        id: r.id,
        subject_code: r.subject_code,
        label: r.label,
        enabled: r.enabled === 1,
        created_at: r.created_at,
        updated_at: r.updated_at,
      })),
    });
  });

  statcanSubscriptions.post("/", async (c) => {
    let bodyJson: unknown;
    try {
      bodyJson = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }
    const parsed = subscriptionCreateSchema.safeParse(bodyJson);
    if (!parsed.success) {
      return c.json({ error: parsed.error.flatten() }, 400);
    }
    if (
      statcanSubscriptionsRepo.getSubscriptionBySubjectCode(
        db,
        parsed.data.subject_code,
      )
    ) {
      return c.json({ error: "subject_code already exists" }, 409);
    }
    const id = statcanSubscriptionsRepo.insertSubscription(db, {
      subject_code: parsed.data.subject_code,
      label: parsed.data.label ?? null,
      enabled: parsed.data.enabled ?? true,
    });
    const row = statcanSubscriptionsRepo.getSubscriptionById(db, id)!;
    return c.json(
      {
        id: row.id,
        subject_code: row.subject_code,
        label: row.label,
        enabled: row.enabled === 1,
        created_at: row.created_at,
        updated_at: row.updated_at,
      },
      201,
    );
  });

  statcanSubscriptions.patch("/:id", async (c) => {
    const id = Number(c.req.param("id"));
    if (!Number.isFinite(id)) {
      return c.json({ error: "Invalid id" }, 400);
    }
    const existing = statcanSubscriptionsRepo.getSubscriptionById(db, id);
    if (!existing) {
      return c.json({ error: "Not found" }, 404);
    }
    let bodyJson: unknown;
    try {
      bodyJson = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }
    const parsed = subscriptionPatchSchema.safeParse(bodyJson);
    if (!parsed.success) {
      return c.json({ error: parsed.error.flatten() }, 400);
    }
    statcanSubscriptionsRepo.updateSubscription(db, id, parsed.data);
    const row = statcanSubscriptionsRepo.getSubscriptionById(db, id)!;
    return c.json({
      id: row.id,
      subject_code: row.subject_code,
      label: row.label,
      enabled: row.enabled === 1,
      created_at: row.created_at,
      updated_at: row.updated_at,
    });
  });

  statcanSubscriptions.delete("/:id", (c) => {
    const id = Number(c.req.param("id"));
    if (!Number.isFinite(id)) {
      return c.json({ error: "Invalid id" }, 400);
    }
    const ok = statcanSubscriptionsRepo.deleteSubscription(db, id);
    if (!ok) {
      return c.json({ error: "Not found" }, 404);
    }
    return c.body(null, 204);
  });

  app.route("/statcan/subject-subscriptions", statcanSubscriptions);

  const statcanTracked = new Hono();
  statcanTracked.use(requireOperator({ db, env }));
  statcanTracked.get("/", (c) => {
    const rows = statcanTrackedRepo.listAllTrackedWithCatalog(db);
    return c.json({ data: rows.map(trackedRowToJson) });
  });
  statcanTracked.post("/", async (c) => {
    let bodyJson: unknown;
    try {
      bodyJson = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }
    const parsed = trackedCreateSchema.safeParse(bodyJson);
    if (!parsed.success) {
      return c.json({ error: parsed.error.flatten() }, 400);
    }
    if (
      statcanCatalogRepo.countCatalogRows(db) > 0 &&
      !statcanCatalogRepo.catalogHasProduct(db, parsed.data.product_id)
    ) {
      return c.json(
        { error: "product_id not found in statcan_cube_catalog" },
        400,
      );
    }
    if (statcanTrackedRepo.getTrackedByProductId(db, parsed.data.product_id)) {
      return c.json({ error: "product_id already tracked" }, 409);
    }
    const id = statcanTrackedRepo.insertTrackedDataset(db, {
      product_id: parsed.data.product_id,
      frequency: parsed.data.frequency,
      hour_utc: parsed.data.hour_utc,
      minute_utc: parsed.data.minute_utc,
      day_of_week: parsed.data.day_of_week ?? null,
      day_of_month: parsed.data.day_of_month ?? null,
      download_channel: parsed.data.download_channel,
      enabled: parsed.data.enabled,
    });
    const row = statcanTrackedRepo.getTrackedByIdWithCatalog(db, id)!;
    return c.json(trackedRowToJson(row), 201);
  });
  statcanTracked.patch("/:id", async (c) => {
    const id = Number(c.req.param("id"));
    if (!Number.isFinite(id)) {
      return c.json({ error: "Invalid id" }, 400);
    }
    const existing = statcanTrackedRepo.getTrackedById(db, id);
    if (!existing) {
      return c.json({ error: "Not found" }, 404);
    }
    let bodyJson: unknown;
    try {
      bodyJson = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }
    const parsed = trackedPatchSchema.safeParse(bodyJson);
    if (!parsed.success) {
      return c.json({ error: parsed.error.flatten() }, 400);
    }
    const p = parsed.data;
    const mergedFreq = (p.frequency ?? existing.frequency) as
      | "daily"
      | "weekly"
      | "monthly";
    const mergedHour = p.hour_utc ?? existing.hour_utc;
    const mergedMin = p.minute_utc ?? existing.minute_utc;
    const mergedDow =
      p.day_of_week !== undefined ? p.day_of_week : existing.day_of_week;
    const mergedDom =
      p.day_of_month !== undefined ? p.day_of_month : existing.day_of_month;
    const next = computeNextRunAfter(new Date(), {
      frequency: mergedFreq,
      hourUtc: mergedHour,
      minuteUtc: mergedMin,
      dayOfWeek: mergedDow,
      dayOfMonth: mergedDom,
    });
    statcanTrackedRepo.updateTrackedDataset(db, id, {
      ...p,
      next_run_at: next.toISOString(),
    });
    const row = statcanTrackedRepo.getTrackedByIdWithCatalog(db, id)!;
    return c.json(trackedRowToJson(row));
  });
  statcanTracked.delete("/:id", (c) => {
    const id = Number(c.req.param("id"));
    if (!Number.isFinite(id)) {
      return c.json({ error: "Invalid id" }, 400);
    }
    const ok = statcanTrackedRepo.deleteTrackedDataset(db, id);
    if (!ok) {
      return c.json({ error: "Not found" }, 404);
    }
    return c.body(null, 204);
  });
  statcanTracked.post("/:id/refresh", async (c) => {
    const id = Number(c.req.param("id"));
    if (!Number.isFinite(id)) {
      return c.json({ error: "Invalid id" }, 400);
    }
    const ctx: JobContext = { db, env };
    try {
      await runBulkTrackedDatasetRefresh(ctx, id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return c.json({ error: msg }, 400);
    }
    const row = statcanTrackedRepo.getTrackedByIdWithCatalog(db, id);
    return c.json({ ok: true, data: row ? trackedRowToJson(row) : null });
  });
  app.route("/statcan/tracked-datasets", statcanTracked);

  app.get("/statcan/wds/observations", (c) => {
    const q = c.req.query();
    const productParse = z.coerce.number().int().positive().safeParse(q.product_id);
    const limitParse = z.coerce.number().min(1).max(500).safeParse(q.limit);
    const offsetParse = z.coerce.number().min(0).safeParse(q.offset);
    const limit = limitParse.success ? limitParse.data : 50;
    const offset = offsetParse.success ? offsetParse.data : 0;
    const rows = statcanWdsNormRepo.listStatcanWdsObservations(db, {
      productId: productParse.success ? productParse.data : undefined,
      limit,
      offset,
    });
    return c.json({
      data: rows.map((r) => ({
        id: r.id,
        batch_id: r.batch_id,
        raw_payload_id: r.raw_payload_id,
        product_id: r.product_id,
        vector_id: r.vector_id,
        coordinate: r.coordinate,
        ref_per: r.ref_per,
        value: r.value,
        decimals: r.decimals,
      })),
      limit,
      offset,
    });
  });

  app.get("/raw-payloads/:id", (c) => {
    const id = Number(c.req.param("id"));
    if (!Number.isFinite(id)) {
      return c.json({ error: "Invalid id" }, 400);
    }
    const row = rawPayloadsRepo.getRawPayloadById(db, id);
    if (!row) {
      return c.json({ error: "Not found" }, 404);
    }
    return c.json(row);
  });

  return app;
}
