import { describe, expect, it } from 'vitest';
import {
  getOpenState,
  getTimeSlots,
  isSchedulableTime,
  openIntervals,
  zonedTimeToUtc,
  type OpeningRange,
  type Schedule,
  type Weekday,
} from './hours';

const TZ = 'Asia/Tbilisi'; // UTC+4, no DST

/** Local Tbilisi wall time -> Date. */
const at = (iso: string) => {
  const [date, time] = iso.split(' ') as [string, string];
  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  const [h, m] = time.split(':').map(Number) as [number, number];
  return zonedTimeToUtc({ year, month, day }, h * 60 + m, TZ);
};

const everyDay = (opens: string, closes: string): OpeningRange[] =>
  ([1, 2, 3, 4, 5, 6, 7] as Weekday[]).map((weekday) => ({ weekday, opens, closes }));

const schedule = (overrides: Partial<Schedule> = {}): Schedule => ({
  timezone: TZ,
  hours: everyDay('12:00', '23:00'),
  closures: [],
  lastOrderMinutesBeforeClose: 15,
  ...overrides,
});

// 2026-09-28 is a Monday.
describe('zonedTimeToUtc', () => {
  it('converts Tbilisi wall time to UTC', () => {
    expect(at('2026-09-28 12:00').toISOString()).toBe('2026-09-28T08:00:00.000Z');
  });
});

describe('getOpenState', () => {
  it('is open during hours and reports closing time', () => {
    const state = getOpenState(at('2026-09-28 14:30'), schedule());
    expect(state.isOpen).toBe(true);
    expect(state.acceptingOrders).toBe(true);
    expect(state.closesAt).toEqual(at('2026-09-28 23:00'));
  });

  it('is closed before opening and points at today’s opening', () => {
    const state = getOpenState(at('2026-09-28 09:00'), schedule());
    expect(state.isOpen).toBe(false);
    expect(state.nextOpensAt).toEqual(at('2026-09-28 12:00'));
  });

  it('is closed after closing and points at tomorrow', () => {
    const state = getOpenState(at('2026-09-28 23:30'), schedule());
    expect(state.isOpen).toBe(false);
    expect(state.nextOpensAt).toEqual(at('2026-09-29 12:00'));
  });

  it('treats the closing minute as closed', () => {
    expect(getOpenState(at('2026-09-28 23:00'), schedule()).isOpen).toBe(false);
    expect(getOpenState(at('2026-09-28 12:00'), schedule()).isOpen).toBe(true);
  });

  it('stops accepting orders at the last-order cut-off but stays open', () => {
    const state = getOpenState(at('2026-09-28 22:50'), schedule());
    expect(state.isOpen).toBe(true);
    expect(state.acceptingOrders).toBe(false);
  });

  it('handles ranges past midnight, including from the previous day', () => {
    const s = schedule({ hours: [{ weekday: 5, opens: '18:00', closes: '02:00' }] }); // Friday
    // Friday 2026-10-02 23:00 -> open until Saturday 02:00
    expect(getOpenState(at('2026-10-02 23:00'), s).closesAt).toEqual(at('2026-10-03 02:00'));
    // Saturday 01:30 is still Friday's shift
    expect(getOpenState(at('2026-10-03 01:30'), s).isOpen).toBe(true);
    expect(getOpenState(at('2026-10-03 02:30'), s).isOpen).toBe(false);
  });

  it('treats 00:00 closing as midnight', () => {
    const s = schedule({ hours: everyDay('12:00', '00:00') });
    expect(getOpenState(at('2026-09-28 23:59'), s).isOpen).toBe(true);
    expect(getOpenState(at('2026-09-29 00:00'), s).isOpen).toBe(false);
  });

  it('supports split shifts', () => {
    const s = schedule({
      hours: [
        { weekday: 1, opens: '12:00', closes: '15:00' },
        { weekday: 1, opens: '18:00', closes: '22:00' },
      ],
    });
    expect(getOpenState(at('2026-09-28 16:00'), s)).toMatchObject({
      isOpen: false,
      nextOpensAt: at('2026-09-28 18:00'),
    });
  });

  it('skips a weekly day off', () => {
    const s = schedule({ hours: everyDay('12:00', '23:00').filter((r) => r.weekday !== 2) });
    // Monday night -> next opening is Wednesday
    expect(getOpenState(at('2026-09-28 23:30'), s).nextOpensAt).toEqual(at('2026-09-30 12:00'));
  });

  it('respects holiday closures', () => {
    const s = schedule({ closures: [{ startsOn: '2026-09-29', endsOn: '2026-09-30' }] });
    expect(getOpenState(at('2026-09-29 14:00'), s).isOpen).toBe(false);
    expect(getOpenState(at('2026-09-29 14:00'), s).nextOpensAt).toEqual(at('2026-10-01 12:00'));
  });

  it('keeps a shift that started before a closure day', () => {
    const s = schedule({
      hours: everyDay('18:00', '02:00'),
      closures: [{ startsOn: '2026-09-29', endsOn: '2026-09-29' }],
    });
    expect(getOpenState(at('2026-09-29 01:00'), s).isOpen).toBe(true);
    expect(getOpenState(at('2026-09-29 19:00'), s).isOpen).toBe(false);
  });

  it('reports no next opening when there are no hours at all', () => {
    expect(getOpenState(at('2026-09-28 14:00'), schedule({ hours: [] }))).toEqual({
      isOpen: false,
      acceptingOrders: false,
      closesAt: null,
      nextOpensAt: null,
    });
  });

  it('merges overlapping ranges', () => {
    const s = schedule({
      hours: [
        { weekday: 1, opens: '12:00', closes: '16:00' },
        { weekday: 1, opens: '15:00', closes: '20:00' },
      ],
    });
    const monday = openIntervals(at('2026-09-28 10:00'), 0, s);
    expect(monday).toEqual([{ start: at('2026-09-28 12:00'), end: at('2026-09-28 20:00') }]);
  });
});

describe('time slots', () => {
  const opts = { leadMinutes: 30, intervalMinutes: 15, daysAhead: 0 };

  it('starts lead minutes after now, on the slot grid, and ends at closing', () => {
    const slots = getTimeSlots(at('2026-09-28 22:05'), schedule(), opts);
    expect(slots[0]).toEqual(at('2026-09-28 22:45'));
    expect(slots.at(-1)).toEqual(at('2026-09-28 23:00'));
  });

  it('offers the next opening when closed', () => {
    const slots = getTimeSlots(at('2026-09-28 23:30'), schedule(), opts);
    expect(slots[0]).toEqual(at('2026-09-29 12:30'));
  });

  it('validates a requested time on the server', () => {
    const now = at('2026-09-28 14:00');
    const s = schedule();
    const o = { leadMinutes: 30, daysAhead: 1 };
    expect(isSchedulableTime(at('2026-09-28 14:40'), now, s, o)).toBe(true);
    expect(isSchedulableTime(at('2026-09-28 14:10'), now, s, o)).toBe(false); // too soon
    expect(isSchedulableTime(at('2026-09-29 11:00'), now, s, o)).toBe(false); // closed
    expect(isSchedulableTime(at('2026-09-29 12:10'), now, s, o)).toBe(false); // before opening + lead
    expect(isSchedulableTime(at('2026-09-29 12:30'), now, s, o)).toBe(true);
    expect(isSchedulableTime(at('2026-10-05 13:00'), now, s, o)).toBe(false); // too far ahead
  });
});
