import { describe, expect, it } from "bun:test";
import { computeNextRunAfter } from "../src/services/statcan-next-run.ts";

describe("computeNextRunAfter (UTC)", () => {
  it("daily: next slot same day if after is before run time", () => {
    const after = new Date("2024-06-10T05:00:00.000Z");
    const next = computeNextRunAfter(after, {
      frequency: "daily",
      hourUtc: 6,
      minuteUtc: 0,
      dayOfWeek: null,
      dayOfMonth: null,
    });
    expect(next.toISOString()).toBe("2024-06-10T06:00:00.000Z");
  });

  it("daily: next calendar day when already past run time", () => {
    const after = new Date("2024-06-10T07:00:00.000Z");
    const next = computeNextRunAfter(after, {
      frequency: "daily",
      hourUtc: 6,
      minuteUtc: 0,
      dayOfWeek: null,
      dayOfMonth: null,
    });
    expect(next.toISOString()).toBe("2024-06-11T06:00:00.000Z");
  });

  it("weekly: next occurrence after Wednesday noon (target Tuesday 10:00 UTC)", () => {
    const after = new Date("2024-06-12T12:00:00.000Z");
    const next = computeNextRunAfter(after, {
      frequency: "weekly",
      hourUtc: 10,
      minuteUtc: 0,
      dayOfWeek: 2,
      dayOfMonth: null,
    });
    expect(next.toISOString()).toBe("2024-06-18T10:00:00.000Z");
  });

  it("monthly: day 31 clamps to last day in February", () => {
    const after = new Date("2024-02-01T00:00:00.000Z");
    const next = computeNextRunAfter(after, {
      frequency: "monthly",
      hourUtc: 12,
      minuteUtc: 0,
      dayOfWeek: null,
      dayOfMonth: 31,
    });
    expect(next.toISOString()).toBe("2024-02-29T12:00:00.000Z");
  });

  it("monthly: next month when day has passed", () => {
    const after = new Date("2024-03-15T00:00:00.000Z");
    const next = computeNextRunAfter(after, {
      frequency: "monthly",
      hourUtc: 0,
      minuteUtc: 0,
      dayOfWeek: null,
      dayOfMonth: 10,
    });
    expect(next.toISOString()).toBe("2024-04-10T00:00:00.000Z");
  });
});
