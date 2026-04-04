import type { JobContext } from "./runners.ts";
import {
  jobBocRss,
  jobBocValet,
  jobStatcanRss,
  jobStatcanWds,
} from "./runners.ts";

export const JOB_NAMES = [
  "statcan-rss",
  "boc-rss",
  "statcan-wds",
  "boc-valet",
] as const;

export type JobName = (typeof JOB_NAMES)[number];

export const jobRegistry: Record<
  JobName,
  (ctx: JobContext) => Promise<void>
> = {
  "statcan-rss": jobStatcanRss,
  "boc-rss": jobBocRss,
  "statcan-wds": jobStatcanWds,
  "boc-valet": jobBocValet,
};

export function isJobName(value: string): value is JobName {
  return (JOB_NAMES as readonly string[]).includes(value);
}

export async function runJobByName(
  ctx: JobContext,
  name: JobName,
): Promise<void> {
  await jobRegistry[name](ctx);
}
