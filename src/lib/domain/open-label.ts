import { getOpenState, zonedParts, type Schedule } from './hours';

const WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type WeekdayKey = (typeof WEEKDAY_KEYS)[number];

export type OpenLabel =
  | { kind: 'open'; until: string; acceptingOrders: boolean }
  | { kind: 'closed'; opensWhen: 'today' | 'tomorrow' | 'later'; weekday: WeekdayKey; time: string }
  | { kind: 'closed-indefinitely' };

const hhmm = (p: { hour: number; minute: number }) =>
  `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`;

/** Plain data describing "Open until 23:00" / "Closed, opens tomorrow at 12:00", for any language. */
export function describeOpenState(now: Date, schedule: Schedule): OpenLabel {
  const state = getOpenState(now, schedule);
  if (state.isOpen && state.closesAt) {
    return {
      kind: 'open',
      until: hhmm(zonedParts(state.closesAt, schedule.timezone)),
      acceptingOrders: state.acceptingOrders,
    };
  }
  if (!state.nextOpensAt) return { kind: 'closed-indefinitely' };

  const today = zonedParts(now, schedule.timezone);
  const next = zonedParts(state.nextOpensAt, schedule.timezone);
  const dayDiff = Math.round(
    (Date.UTC(next.year, next.month - 1, next.day) -
      Date.UTC(today.year, today.month - 1, today.day)) /
      86_400_000,
  );
  return {
    kind: 'closed',
    opensWhen: dayDiff === 0 ? 'today' : dayDiff === 1 ? 'tomorrow' : 'later',
    weekday: WEEKDAY_KEYS[next.weekday - 1]!,
    time: hhmm(next),
  };
}
