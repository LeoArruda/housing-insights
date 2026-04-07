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
import { jobStatcanSubjectChangedIngest } from "./statcan-subject-changed.ts";
import { jobStatcanWdsDataNormalize } from "./statcan-wds-normalize.ts";
import { jobStatcanBulkTrackedSync } from "./statcan-bulk-tracked-sync.ts";

export const JOB_NAMES = [
  "statcan-rss",
  "boc-rss",
  "statcan-catalog-index",
  "statcan-wds-metadata",
  "statcan-wds-data",
  "statcan-scheduled-ingest",
  "statcan-subject-changed-ingest",
  "boc-valet",
  "statcan-wds-data-normalize",
  "statcan-bulk-tracked-sync",
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
  "statcan-subject-changed-ingest": jobStatcanSubjectChangedIngest,
  "boc-valet": jobBocValet,
  "statcan-wds-data-normalize": jobStatcanWdsDataNormalize,
  "statcan-bulk-tracked-sync": jobStatcanBulkTrackedSync,
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
