import type { JobContext } from "./runners.ts";
import {
  jobBocRss,
  jobBocValet,
  jobStatcanCatalogIndex,
  jobStatcanRss,
  jobStatcanWdsData,
  jobStatcanWdsMetadata,
} from "./runners.ts";
import { jobStatcanScheduledIngest } from "./statcan-scheduled.ts";

export const JOB_NAMES = [
  "statcan-rss",
  "boc-rss",
  "statcan-catalog-index",
  "statcan-wds-metadata",
  "statcan-wds-data",
  "statcan-scheduled-ingest",
  "boc-valet",
] as const;

export type JobName = (typeof JOB_NAMES)[number];

export const jobRegistry: Record<
  JobName,
  (ctx: JobContext) => Promise<void>
> = {
  "statcan-rss": jobStatcanRss,
  "boc-rss": jobBocRss,
  "statcan-catalog-index": jobStatcanCatalogIndex,
  "statcan-wds-metadata": jobStatcanWdsMetadata,
  "statcan-wds-data": jobStatcanWdsData,
  "statcan-scheduled-ingest": jobStatcanScheduledIngest,
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
