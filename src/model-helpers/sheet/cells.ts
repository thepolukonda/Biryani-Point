/** Lenient readers for cells typed by people in a spreadsheet. */
export { slugify } from '@/shared/text';

const YES = /^(true|yes|y|1|x|✓|✔|☑|on|да|д|კი|დიახ)$/i;
const NO = /^(false|no|n|0|off|нет|н|არა|-)$/i;

/** true / false, or null when the cell is empty or unclear. */
export function readBool(value: string): boolean | null {
  const v = value.trim();
  if (!v) return null;
  if (YES.test(v)) return true;
  if (NO.test(v)) return false;
  return null;
}

/** "0".."3" or words in any of the three languages. */
export function readSpice(value: string): 0 | 1 | 2 | 3 | null | 'invalid' {
  const v = value.trim().toLowerCase();
  if (!v) return null;
  if (/^[0-3]$/.test(v)) return Number(v) as 0 | 1 | 2 | 3;
  if (/^(none|no|not spicy|არა|без|не острое)$/.test(v)) return 0;
  if (/^(mild|low|🌶|მსუბუქი|мягк|слабо)/.test(v)) return 1;
  if (/^(medium|med|🌶🌶|საშუალო|средн)/.test(v)) return 2;
  if (/^(hot|spicy|high|🌶🌶🌶|ცხარე|остр)/.test(v)) return 3;
  return 'invalid';
}

/** Split "a, b; c" into trimmed parts. */
export function readList(value: string): string[] {
  return value
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Signed lari amount for modifier prices: "+2", "2", "-1.50", "0". */
export function readSignedGel(value: string): number | null {
  const v = value
    .trim()
    .replace(/gel|lari|ლარი|₾|лари/gi, '')
    .replace(/\s+/g, '')
    .replace(',', '.');
  if (!v) return 0;
  const m = /^([+-]?)(\d{1,7})(?:\.(\d{1,2}))?$/.exec(v);
  if (!m) return null;
  const tetri = Number(m[2]) * 100 + Number((m[3] ?? '').padEnd(2, '0'));
  return m[1] === '-' ? -tetri : tetri;
}

const DAY_NAMES: Record<number, string[]> = {
  1: ['mon', 'monday', 'ორშაბათი', 'ორშ', 'понедельник', 'пн'],
  2: ['tue', 'tues', 'tuesday', 'სამშაბათი', 'სამ', 'вторник', 'вт'],
  3: ['wed', 'wednesday', 'ოთხშაბათი', 'ოთხ', 'среда', 'ср'],
  4: ['thu', 'thur', 'thurs', 'thursday', 'ხუთშაბათი', 'ხუთ', 'четверг', 'чт'],
  5: ['fri', 'friday', 'პარასკევი', 'პარ', 'пятница', 'пт'],
  6: ['sat', 'saturday', 'შაბათი', 'შაბ', 'суббота', 'сб'],
  7: ['sun', 'sunday', 'კვირა', 'კვი', 'воскресенье', 'вс'],
};

function readOneDay(token: string): number | null {
  const t = token.trim().toLowerCase().replace(/\.$/, '');
  if (/^[1-7]$/.test(t)) return Number(t);
  for (const [day, names] of Object.entries(DAY_NAMES)) if (names.includes(t)) return Number(day);
  return null;
}

/** "Mon", "Monday", "Mon-Fri", "Sat, Sun", "every day" -> [1..7] weekdays, or null. */
export function readDays(value: string): number[] | null {
  const v = value.trim().toLowerCase();
  if (!v) return null;
  if (/^(every ?day|daily|all|all days|ყოველდღე|ежедневно|каждый день)$/.test(v))
    return [1, 2, 3, 4, 5, 6, 7];
  const days = new Set<number>();
  for (const part of v.split(/[,;&]|\band\b/)) {
    const range = part.split(/\s*[-–—]\s*|\s+to\s+/);
    if (range.length === 2) {
      const from = readOneDay(range[0]!);
      const to = readOneDay(range[1]!);
      if (from === null || to === null) return null;
      for (let d = from; ; d = (d % 7) + 1) {
        days.add(d);
        if (d === to) break;
      }
    } else if (range.length === 1 && range[0]!.trim()) {
      const d = readOneDay(range[0]!);
      if (d === null) return null;
      days.add(d);
    } else if (range.length > 2) return null;
  }
  return days.size ? [...days].sort() : null;
}

/** "12:00", "12.00", "12", "9:30", "0:00", "24:00" (midnight) -> "HH:MM", or null. */
export function readTime(value: string): string | null {
  const m = /^(\d{1,2})(?:[:.](\d{2}))?$/.exec(value.trim());
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2] ?? '0');
  if (h === 24 && min === 0) h = 0;
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

/** "2026-12-31", "31.12.2026", "31/12/2026" -> "2026-12-31", or null. */
export function readDate(value: string): string | null {
  const v = value.trim();
  let y: number, m: number, d: number;
  let match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(v);
  if (match) [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  else if ((match = /^(\d{1,2})[./](\d{1,2})[./](\d{4})$/.exec(v)))
    [d, m, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
  else return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d)
    return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** A date or "date - date" (either order of spaces). */
export function readDateRange(value: string): { from: string; to: string } | null {
  const parts = value.split(/\s+[-–—]\s+|\s+to\s+|\s*–\s*/);
  if (parts.length === 1) {
    const d = readDate(parts[0]!);
    return d ? { from: d, to: d } : null;
  }
  if (parts.length !== 2) return null;
  const from = readDate(parts[0]!);
  const to = readDate(parts[1]!);
  if (!from || !to) return null;
  return from <= to ? { from, to } : { from: to, to: from };
}
