import { z } from "zod";

const envSchema = z.object({
  DATABASE_PATH: z.string().default("./data/platform.sqlite"),
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default("127.0.0.1"),
  HTTP_TIMEOUT_MS: z.coerce.number().default(30_000),
  HTTP_MAX_RETRIES: z.coerce.number().min(0).max(10).default(3),
  HTTP_USER_AGENT: z.string().default("housing-insights/0.1"),
  STATCAN_RSS_URL: z
    .string()
    .url()
    .default("https://www.statcan.gc.ca/eng/rss/sc-Bull"),
  BOC_RSS_URL: z.string().url().default("https://www.bankofcanada.ca/feed/"),
  BOC_VALET_URL: z
    .string()
    .url()
    .default(
      "https://www.bankofcanada.ca/valet/observations/FXUSDCAD/json?recent=1",
    ),

  STATCAN_CATALOG_PATH: z.string().optional(),
  /** String env values: only `true`/`1`/`yes` enable API mode; `false` and unset are off (avoid `z.coerce.boolean()`, which treats string `"false"` as truthy). */
  STATCAN_CATALOG_FROM_API: z.preprocess((val: unknown) => {
    if (val === undefined || val === null || val === "") return false;
    if (typeof val === "boolean") return val;
    const s = String(val).trim().toLowerCase();
    if (s === "true" || s === "1" || s === "yes") return true;
    return false;
  }, z.boolean()),
  STATCAN_KEYWORDS_PATH: z.string().optional(),
  STATCAN_INGEST_MODE: z
    .enum(["explicit", "keyword", "hybrid"])
    .default("explicit"),
  STATCAN_PRODUCT_IDS: z.string().default(""),
  STATCAN_MAX_CUBES_PER_JOB: z.coerce.number().min(1).max(50_000).default(50),
  STATCAN_MIN_KEYWORD_SCORE: z.coerce.number().min(0).default(1),
  STATCAN_LATEST_N: z.coerce.number().min(1).max(200).default(3),
  STATCAN_DEFAULT_DATA_COORDINATE: z.string().optional(),
  STATCAN_DATA_VECTOR_IDS: z.string().default(""),
  STATCAN_REQUEST_DELAY_MS: z.coerce.number().min(0).default(200),
  /** Max `statcan-wds-data` raw rows processed per `statcan-wds-data-normalize` job run. */
  STATCAN_WDS_NORMALIZE_BATCH_LIMIT: z.coerce.number().min(1).max(5000).default(500),

  DAEMON_STATCAN_RSS_CRON: z.string().default("0 * * * *"),
  DAEMON_BOC_RSS_CRON: z.string().default("15 * * * *"),
  DAEMON_STATCAN_CATALOG_CRON: z.string().default("0 2 * * 0"),
  DAEMON_STATCAN_WDS_METADATA_CRON: z.string().default("0 6 * * *"),
  DAEMON_STATCAN_WDS_DATA_CRON: z.string().default("30 6 * * *"),
  /** Tick for per-product StatCan schedules (`statcan-scheduled-ingest` job). */
  DAEMON_STATCAN_SCHEDULE_TICK_CRON: z.string().default("*/5 * * * *"),
  DAEMON_BOC_VALET_CRON: z.string().default("30 6 * * *"),
  /** If set (non-empty), daemon runs `statcan-wds-data-normalize` on this cron. Omit to run via CLI only. */
  DAEMON_STATCAN_WDS_DATA_NORMALIZE_CRON: z.string().optional(),

  /** If set, `Authorization: Bearer <token>` required on API routes except `/health` and `/health/ready`. Viewer cannot access `/statcan/schedules` or `/statcan/catalog`. */
  DASHBOARD_OPERATOR_KEY: z.string().optional(),
  DASHBOARD_VIEWER_KEY: z.string().optional(),
  /** Dev: e.g. `http://localhost:5173` — sets CORS headers on API responses. */
  CORS_ALLOW_ORIGIN: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(overrides?: Record<string, string | undefined>): Env {
  const merged = { ...process.env, ...overrides };
  const parsed = envSchema.safeParse(merged);
  if (!parsed.success) {
    console.error(parsed.error.flatten().fieldErrors);
    throw new Error("Invalid environment configuration");
  }
  return parsed.data;
}
