import { describe, expect, it } from "bun:test";
import { ApiHttpError } from "../src/api/client.ts";
import type { StatcanSchedule } from "../src/api/statcan-schedules.ts";
import {
  formatApiError,
  formatUtcTime,
  truncateText,
  utcScheduleSummary,
  validateWizardAdvanced,
  validateWizardStep2,
} from "../src/composables/statcanScheduleHelpers.ts";

function schedule(
  overrides: Partial<StatcanSchedule> = {},
): StatcanSchedule {
  return {
    id: 1,
    product_id: 99,
    frequency: "daily",
    hour_utc: 6,
    minute_utc: 5,
    day_of_week: null,
    day_of_month: null,
    latest_n: null,
    data_coordinate: null,
    data_vector_id: null,
    fetch_metadata: true,
    fetch_data: true,
    enabled: true,
    next_run_at: null,
    last_run_at: null,
    last_error: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("statcanScheduleHelpers", () => {
  it("formatUtcTime pads hours and minutes", () => {
    expect(formatUtcTime(6, 5)).toBe("06:05 UTC");
    expect(formatUtcTime(0, 0)).toBe("00:00 UTC");
  });

  it("utcScheduleSummary reflects frequency and UTC time", () => {
    expect(utcScheduleSummary(schedule())).toBe("Daily · 06:05 UTC");
    expect(
      utcScheduleSummary(
        schedule({ frequency: "weekly", day_of_week: 2, hour_utc: 10, minute_utc: 0 }),
      ),
    ).toBe("Weekly · Tue · 10:00 UTC");
    expect(
      utcScheduleSummary(
        schedule({ frequency: "monthly", day_of_month: 15, hour_utc: 0, minute_utc: 0 }),
      ),
    ).toBe("Monthly · day 15 · 00:00 UTC");
  });

  it("truncateText handles null and long strings", () => {
    expect(truncateText(null)).toBe("—");
    expect(truncateText("")).toBe("—");
    expect(truncateText("short")).toBe("short");
    expect(truncateText("x".repeat(80), 10)).toBe("xxxxxxxxxx…");
  });

  it("formatApiError prefers string error body", () => {
    const e = new ApiHttpError("Bad Request", 400, { error: "duplicate" });
    expect(formatApiError(e)).toBe("duplicate");
  });

  it("formatApiError flattens Zod-style field errors", () => {
    const e = new ApiHttpError("Bad Request", 400, {
      error: {
        formErrors: ["Bad input"],
        fieldErrors: { day_of_week: ["required"] },
      },
    });
    expect(formatApiError(e)).toBe("Bad input; day_of_week: required");
  });

  it("validateWizardStep2 matches API rules", () => {
    const ok = validateWizardStep2({
      frequency: "daily",
      hour_utc: 12,
      minute_utc: 0,
      day_of_week: null,
      day_of_month: null,
    });
    expect(ok.ok).toBe(true);

    const weeklyMissingDow = validateWizardStep2({
      frequency: "weekly",
      hour_utc: 0,
      minute_utc: 0,
      day_of_week: null,
      day_of_month: null,
    });
    expect(weeklyMissingDow.ok).toBe(false);
    expect(weeklyMissingDow.messages.some((m) => m.includes("day_of_week"))).toBe(
      true,
    );
  });

  it("validateWizardAdvanced bounds latest_n and data_vector_id", () => {
    expect(
      validateWizardAdvanced({ latest_n: 201, data_vector_id: null }).ok,
    ).toBe(false);
    expect(
      validateWizardAdvanced({ latest_n: null, data_vector_id: 0 }).ok,
    ).toBe(false);
    expect(validateWizardAdvanced({ latest_n: 3, data_vector_id: 1 }).ok).toBe(
      true,
    );
  });
});
