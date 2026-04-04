/** All times UTC. `day_of_week`: 0 = Sunday … 6 = Saturday (matches `Date.getUTCDay()`). */

export type ScheduleFrequency = "daily" | "weekly" | "monthly";

export type NextRunInput = {
  frequency: ScheduleFrequency;
  hourUtc: number;
  minuteUtc: number;
  dayOfWeek: number | null;
  dayOfMonth: number | null;
};

function atUtcTime(
  y: number,
  monthIndex0: number,
  day: number,
  hour: number,
  minute: number,
): Date {
  return new Date(Date.UTC(y, monthIndex0, day, hour, minute, 0, 0));
}

function daysInMonthUtc(year: number, monthIndex0: number): number {
  return new Date(Date.UTC(year, monthIndex0 + 1, 0)).getUTCDate();
}

/** Next run strictly after `after` (typically `new Date()`). */
export function computeNextRunAfter(
  after: Date,
  s: NextRunInput,
): Date {
  if (s.frequency === "daily") {
    return nextDaily(after, s.hourUtc, s.minuteUtc);
  }
  if (s.frequency === "weekly") {
    const dow = s.dayOfWeek ?? 0;
    return nextWeekly(after, dow, s.hourUtc, s.minuteUtc);
  }
  const dom = s.dayOfMonth ?? 1;
  return nextMonthly(after, dom, s.hourUtc, s.minuteUtc);
}

function nextDaily(after: Date, h: number, m: number): Date {
  let d = new Date(after.getTime());
  d.setUTCHours(h, m, 0, 0);
  if (d.getTime() <= after.getTime()) {
    d.setUTCDate(d.getUTCDate() + 1);
    d.setUTCHours(h, m, 0, 0);
  }
  return d;
}

function nextWeekly(after: Date, targetDow: number, h: number, m: number): Date {
  const d = new Date(after.getTime());
  d.setUTCHours(h, m, 0, 0);
  let add = (targetDow - d.getUTCDay() + 7) % 7;
  d.setUTCDate(d.getUTCDate() + add);
  if (d.getTime() <= after.getTime()) {
    d.setUTCDate(d.getUTCDate() + 7);
  }
  return d;
}

function nextMonthly(after: Date, dom: number, h: number, m: number): Date {
  let y = after.getUTCFullYear();
  let mon = after.getUTCMonth();
  for (let i = 0; i < 36; i++) {
    const dim = daysInMonthUtc(y, mon);
    const day = Math.min(dom, dim);
    const candidate = atUtcTime(y, mon, day, h, m);
    if (candidate.getTime() > after.getTime()) {
      return candidate;
    }
    mon += 1;
    if (mon > 11) {
      mon = 0;
      y += 1;
    }
  }
  throw new Error("nextMonthly: could not compute next run");
}
