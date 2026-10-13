/**
 * Opening hours and open/closed state, evaluated in the restaurant's time zone
 * (Asia/Tbilisi) no matter where the server or the visitor is.
 *
 * Hours are weekly ranges. A range whose closing time is at or before its opening
 * time runs past midnight: { weekday: 5, opens: '12:00', closes: '01:00' } is
 * Friday 12:00 until Saturday 01:00. Closures are whole local days, inclusive, and
 * cancel any range that *starts* on those days.
 */

export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7; // ISO: 1 = Monday ... 7 = Sunday
export type OpeningRange = { weekday: Weekday; opens: string; closes: string };
export type Closure = { startsOn: string; endsOn: string }; // 'YYYY-MM-DD'
export type Interval = { start: Date; end: Date };

export type Schedule = {
  timezone: string;
  hours: OpeningRange[];
  closures: Closure[];
  /** Online ordering stops this many minutes before closing. */
  lastOrderMinutesBeforeClose: number;
};

export type OpenState = {
  isOpen: boolean;
  /** Open and not yet past the last-order cut-off. */
  acceptingOrders: boolean;
  closesAt: Date | null;
  nextOpensAt: Date | null;
};

const MINUTE = 60_000;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function parseTime(value: string): number {
  const m = TIME_RE.exec(value.trim());
  if (!m) throw new Error(`Invalid time "${value}", expected HH:MM`);
  return Number(m[1]) * 60 + Number(m[2]);
}

export function isValidTime(value: string): boolean {
  return TIME_RE.test(value.trim());
}

type LocalDate = { year: number; month: number; day: number };

const partsFormatters = new Map<string, Intl.DateTimeFormat>();
function formatterFor(timezone: string): Intl.DateTimeFormat {
  let f = partsFormatters.get(timezone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    partsFormatters.set(timezone, f);
  }
  return f;
}

/** Wall-clock parts of an instant in a time zone. */
export function zonedParts(date: Date, timezone: string) {
  const p: Record<string, number> = {};
  for (const part of formatterFor(timezone).formatToParts(date)) {
    if (part.type !== 'literal') p[part.type] = Number(part.value);
  }
  const year = p.year!;
  const month = p.month!;
  const day = p.day!;
  const weekdayJs = new Date(Date.UTC(year, month - 1, day)).getUTCDay(); // 0 = Sunday
  return {
    year,
    month,
    day,
    hour: p.hour!,
    minute: p.minute!,
    second: p.second!,
    weekday: (weekdayJs === 0 ? 7 : weekdayJs) as Weekday,
  };
}

/** The instant at which the clock in `timezone` shows the given local date and time. */
export function zonedTimeToUtc(date: LocalDate, minutesOfDay: number, timezone: string): Date {
  const guess = Date.UTC(date.year, date.month - 1, date.day, 0, minutesOfDay);
  // Two passes handle offset changes (DST) near the target time.
  let result = guess;
  for (let i = 0; i < 2; i++) {
    const p = zonedParts(new Date(result), timezone);
    const shown = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
    result += guess - shown;
  }
  return new Date(result);
}

function addDays(date: LocalDate, days: number): LocalDate {
  const d = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

function isoDate(date: LocalDate): string {
  return `${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`;
}

function weekdayOf(date: LocalDate): Weekday {
  const js = new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay();
  return (js === 0 ? 7 : js) as Weekday;
}

function isClosedOn(date: LocalDate, closures: Closure[]): boolean {
  const iso = isoDate(date);
  return closures.some((c) => iso >= c.startsOn && iso <= c.endsOn);
}

/**
 * Concrete open intervals starting from the local day before `from` (so a
 * past-midnight range from yesterday is included) through `days` days ahead.
 * Overlapping or touching intervals are merged.
 */
export function openIntervals(from: Date, days: number, schedule: Schedule): Interval[] {
  const today = zonedParts(from, schedule.timezone);
  const start: LocalDate = { year: today.year, month: today.month, day: today.day };
  const raw: Interval[] = [];

  for (let offset = -1; offset <= days; offset++) {
    const date = addDays(start, offset);
    if (isClosedOn(date, schedule.closures)) continue;
    const weekday = weekdayOf(date);
    for (const range of schedule.hours) {
      if (range.weekday !== weekday) continue;
      const opens = parseTime(range.opens);
      const closes = parseTime(range.closes);
      const endDate = closes <= opens ? addDays(date, 1) : date;
      raw.push({
        start: zonedTimeToUtc(date, opens, schedule.timezone),
        end: zonedTimeToUtc(endDate, closes, schedule.timezone),
      });
    }
  }

  raw.sort((a, b) => a.start.getTime() - b.start.getTime());
  const merged: Interval[] = [];
  for (const interval of raw) {
    const last = merged[merged.length - 1];
    if (last && interval.start.getTime() <= last.end.getTime()) {
      if (interval.end > last.end) last.end = interval.end;
    } else {
      merged.push({ ...interval });
    }
  }
  return merged;
}

export function getOpenState(now: Date, schedule: Schedule): OpenState {
  const intervals = openIntervals(now, 8, schedule);
  const t = now.getTime();
  const current = intervals.find((i) => i.start.getTime() <= t && t < i.end.getTime());
  const next = intervals.find((i) => i.start.getTime() > t) ?? null;

  if (current) {
    const cutOff = current.end.getTime() - schedule.lastOrderMinutesBeforeClose * MINUTE;
    return {
      isOpen: true,
      acceptingOrders: t < cutOff,
      closesAt: current.end,
      nextOpensAt: next?.start ?? null,
    };
  }
  return {
    isOpen: false,
    acceptingOrders: false,
    closesAt: null,
    nextOpensAt: next?.start ?? null,
  };
}

export type SlotOptions = {
  /** Minutes the kitchen needs (prep, or prep + delivery). */
  leadMinutes: number;
  intervalMinutes: number;
  /** Extra local calendar days beyond today (0 = today only). */
  daysAhead: number;
};

/**
 * The time ranges a scheduled order may target: inside opening hours, no earlier
 * than `leadMinutes` after both now and opening, no later than closing, and no
 * later than the end of local day today + daysAhead. If that leaves nothing
 * (e.g. closed tonight and daysAhead = 0), the next opening is still offered, so
 * customers can always order ahead for when the restaurant reopens.
 */
function schedulingWindows(
  now: Date,
  schedule: Schedule,
  options: Omit<SlotOptions, 'intervalMinutes'>,
): Interval[] {
  const lead = options.leadMinutes * MINUTE;
  const today = zonedParts(now, schedule.timezone);
  const horizon = zonedTimeToUtc(
    addDays({ year: today.year, month: today.month, day: today.day }, options.daysAhead + 1),
    0,
    schedule.timezone,
  ).getTime();

  const windows: Interval[] = [];
  let fallback: Interval | null = null;
  for (const interval of openIntervals(now, options.daysAhead + 8, schedule)) {
    const start = Math.max(now.getTime(), interval.start.getTime()) + lead;
    const end = interval.end.getTime();
    if (end < start) continue;
    if (start < horizon)
      windows.push({ start: new Date(start), end: new Date(Math.min(end, horizon)) });
    else if (!fallback) fallback = { start: new Date(start), end: new Date(end) };
  }
  return windows.length > 0 ? windows : fallback ? [fallback] : [];
}

/** Times a customer can pick for a scheduled order, on the slot grid. */
export function getTimeSlots(now: Date, schedule: Schedule, options: SlotOptions): Date[] {
  const step = options.intervalMinutes * MINUTE;
  const slots: Date[] = [];
  for (const window of schedulingWindows(now, schedule, options)) {
    for (
      let t = Math.ceil(window.start.getTime() / step) * step;
      t <= window.end.getTime();
      t += step
    ) {
      slots.push(new Date(t));
    }
  }
  return slots;
}

/** Server-side check for a requested time (doesn't require it to sit on the slot grid). */
export function isSchedulableTime(
  requested: Date,
  now: Date,
  schedule: Schedule,
  options: Omit<SlotOptions, 'intervalMinutes'>,
): boolean {
  const t = requested.getTime();
  return schedulingWindows(now, schedule, options).some(
    (w) => t >= w.start.getTime() && t <= w.end.getTime(),
  );
}
