import { describe, expect, it } from 'vitest';
import { BILL_LABELS, KOT_LABELS } from './labels';

describe('ticket labels', () => {
  it('has the same labels in every language', () => {
    for (const labels of [BILL_LABELS, KOT_LABELS]) {
      const en = Object.keys(labels.en).sort();
      expect(Object.keys(labels.ka).sort()).toEqual(en);
      expect(Object.keys(labels.ru).sort()).toEqual(en);
    }
  });

  it('fills in times and counts', () => {
    expect(KOT_LABELS.en.readyBy('19:45')).toBe('READY BY 19:45');
    expect(KOT_LABELS.ru.asapLine('19:20', 25)).toContain('25 мин');
    expect(BILL_LABELS.en.items(1)).toBe('1 item');
    expect(BILL_LABELS.en.items(6)).toBe('6 items');
  });
});
