import type { Database } from "bun:sqlite";
import { Hono } from "hono";
import { z } from "zod";
import * as jobRunsRepo from "../db/repositories/job-runs.ts";
import * as rawPayloadsRepo from "../db/repositories/raw-payloads.ts";
import type { Env } from "../env.ts";
import { jobStatusSchema } from "@housing-insights/types";

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

  return app;
}
