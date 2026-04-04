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
  STATCAN_WDS_URL: z
    .string()
    .url()
    .default("https://api.statcan.gc.ca/cubes/v1/cube?page=1&limit=1"),
  BOC_VALET_URL: z
    .string()
    .url()
    .default(
      "https://www.bankofcanada.ca/valet/observations/FXUSDCAD/json?recent=1",
    ),
  DAEMON_STATCAN_RSS_CRON: z.string().default("0 * * * *"),
  DAEMON_BOC_RSS_CRON: z.string().default("15 * * * *"),
  DAEMON_STATCAN_WDS_CRON: z.string().default("0 6 * * *"),
  DAEMON_BOC_VALET_CRON: z.string().default("30 6 * * *"),
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
