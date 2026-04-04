import { z } from "zod";

export const jobStatusSchema = z.enum(["running", "success", "failed"]);
export type JobStatus = z.infer<typeof jobStatusSchema>;

export const jobRunRowSchema = z.object({
  id: z.number().int(),
  job_name: z.string(),
  started_at: z.string(),
  finished_at: z.string().nullable(),
  status: jobStatusSchema,
  error_message: z.string().nullable(),
  metadata: z.string().nullable(),
});
export type JobRunRow = z.infer<typeof jobRunRowSchema>;

export const rawPayloadRowSchema = z.object({
  id: z.number().int(),
  source: z.string(),
  source_key: z.string().nullable(),
  fetched_at: z.string(),
  content_type: z.string(),
  body: z.string(),
  sha256: z.string(),
  job_run_id: z.number().int().nullable(),
});
export type RawPayloadRow = z.infer<typeof rawPayloadRowSchema>;
