import { describe, expect, it } from "bun:test";
import { buildJobRunsListPath } from "../src/composables/useJobRuns.ts";

describe("buildJobRunsListPath", () => {
  it("always includes limit", () => {
    expect(buildJobRunsListPath({ limit: 50 })).toBe("/job-runs?limit=50");
  });

  it("adds job_name and status when set", () => {
    expect(
      buildJobRunsListPath({
        job_name: "statcan-rss",
        status: "failed",
        limit: 100,
      }),
    ).toBe("/job-runs?job_name=statcan-rss&status=failed&limit=100");
  });

  it("omits empty job_name and empty status", () => {
    expect(
      buildJobRunsListPath({
        job_name: "   ",
        status: "",
        limit: 25,
      }),
    ).toBe("/job-runs?limit=25");
  });
});
