import { ApiHttpError } from "../api/client.ts";
import type { ScheduleFrequency, StatcanSchedule } from "../api/statcan-schedules.ts";

const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function formatUtcTime(h: number, m: number): string {
  const hh = String(h).padStart(2, "0");
  const mm = String(m).padStart(2, "0");
  return `${hh}:${mm} UTC`;
}

/** Matches API: day_of_week 0 = Sunday … 6 = Saturday. */
export function utcScheduleSummary(s: StatcanSchedule): string {
  const t = formatUtcTime(s.hour_utc, s.minute_utc);
  if (s.frequency === "daily") return `Daily · ${t}`;
  if (s.frequency === "weekly") {
    const d =
      s.day_of_week != null && s.day_of_week >= 0 && s.day_of_week <= 6
        ? DOW_LABELS[s.day_of_week]
        : "?";
    return `Weekly · ${d} · ${t}`;
  }
  const dom = s.day_of_month ?? "?";
  return `Monthly · day ${dom} · ${t}`;
}

export function truncateText(s: string | null, max = 72): string {
  if (s == null || s === "") return "—";
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

export function formatApiError(e: ApiHttpError): string {
  const b = e.body;
  if (typeof b === "object" && b !== null && "error" in b) {
    const err = (b as { error: unknown }).error;
    if (typeof err === "string") return err;
    if (typeof err === "object" && err !== null) {
      const f = err as {
        formErrors?: string[];
        fieldErrors?: Record<string, string[]>;
      };
      const parts: string[] = [];
      if (Array.isArray(f.formErrors)) {
        for (const x of f.formErrors) {
          if (x) parts.push(x);
        }
      }
      for (const [k, v] of Object.entries(f.fieldErrors ?? {})) {
        if (Array.isArray(v) && v.length) {
          parts.push(`${k}: ${v.join(", ")}`);
        }
      }
      if (parts.length) return parts.join("; ");
    }
  }
  return e.message;
}

export type WizardStep2Validation = {
  ok: boolean;
  messages: string[];
};

export function validateWizardStep2(input: {
  frequency: ScheduleFrequency;
  hour_utc: number;
  minute_utc: number;
  day_of_week: number | null;
  day_of_month: number | null;
}): WizardStep2Validation {
  const messages: string[] = [];
  if (!Number.isInteger(input.hour_utc) || input.hour_utc < 0 || input.hour_utc > 23) {
    messages.push("hour_utc must be an integer from 0 to 23");
  }
  if (
    !Number.isInteger(input.minute_utc) ||
    input.minute_utc < 0 ||
    input.minute_utc > 59
  ) {
    messages.push("minute_utc must be an integer from 0 to 59");
  }
  if (input.frequency === "weekly" && input.day_of_week == null) {
    messages.push("day_of_week is required when frequency is weekly");
  }
  if (
    input.frequency === "weekly" &&
    input.day_of_week != null &&
    (input.day_of_week < 0 || input.day_of_week > 6)
  ) {
    messages.push("day_of_week must be between 0 (Sunday) and 6 (Saturday)");
  }
  if (input.frequency === "monthly" && input.day_of_month == null) {
    messages.push("day_of_month is required when frequency is monthly");
  }
  if (
    input.frequency === "monthly" &&
    input.day_of_month != null &&
    (input.day_of_month < 1 || input.day_of_month > 31)
  ) {
    messages.push("day_of_month must be between 1 and 31");
  }
  return { ok: messages.length === 0, messages };
}

export function validateWizardAdvanced(input: {
  latest_n: number | null;
  data_vector_id: number | null;
}): { ok: boolean; messages: string[] } {
  const messages: string[] = [];
  if (
    input.latest_n != null &&
    (!Number.isInteger(input.latest_n) || input.latest_n < 1 || input.latest_n > 200)
  ) {
    messages.push("latest_n must be between 1 and 200 when set");
  }
  if (
    input.data_vector_id != null &&
    (!Number.isInteger(input.data_vector_id) || input.data_vector_id < 1)
  ) {
    messages.push("data_vector_id must be a positive integer when set");
  }
  return { ok: messages.length === 0, messages };
}
