import type { Database } from "bun:sqlite";
import { Hono } from "hono";
import { z } from "zod";
import * as jobRunsRepo from "../db/repositories/job-runs.ts";
import * as rawPayloadsRepo from "../db/repositories/raw-payloads.ts";
import * as statcanCatalogRepo from "../db/repositories/statcan-catalog.ts";
import * as statcanSchedulesRepo from "../db/repositories/statcan-product-schedules.ts";
import type { Env } from "../env.ts";
import { computeNextRunAfter } from "../services/statcan-next-run.ts";
import { jobStatusSchema } from "@housing-insights/types";

const scheduleFrequencySchema = z.enum(["daily", "weekly", "monthly"]);

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

function scheduleRowToJson(row: statcanSchedulesRepo.StatcanProductScheduleRow) {
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
    fetch_metadata: row.fetch_metadata === 1,
    fetch_data: row.fetch_data === 1,
    enabled: row.enabled === 1,
    next_run_at: row.next_run_at,
    last_run_at: row.last_run_at,
    last_error: row.last_error,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function createApp(db: Database, _env: Env) {
  const app = new Hono();

  app.get("/health", (c) => c.json({ status: "ok" }));

  app.get("/health/ready", (c) => {
    try {
      db.query("SELECT 1 AS ok").get();
      return c.json({ status: "ready", database: true });
    } catch {
      return c.json({ status: "not_ready", database: false }, 503);
    }
  });

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

  app.get("/statcan/schedules", (c) => {
    const rows = statcanSchedulesRepo.listAllSchedules(db);
    return c.json({ data: rows.map(scheduleRowToJson) });
  });

  app.post("/statcan/schedules", async (c) => {
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
      fetch_metadata: body.fetch_metadata,
      fetch_data: body.fetch_data,
      enabled: body.enabled,
      next_run_at,
    });
    const row = statcanSchedulesRepo.getScheduleById(db, id);
    return c.json(scheduleRowToJson(row!), 201);
  });

  app.patch("/statcan/schedules/:id", async (c) => {
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
    const row = statcanSchedulesRepo.getScheduleById(db, id);
    return c.json(scheduleRowToJson(row!));
  });

  app.delete("/statcan/schedules/:id", (c) => {
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

  return app;
}
