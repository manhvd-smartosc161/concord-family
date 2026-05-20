import {
  getFinancialMonthRange,
  getCurrentFinancialMonth,
} from './date-helpers';

describe('getFinancialMonthRange', () => {
  it('cutoff=1 returns calendar month range', () => {
    const { start, end } = getFinancialMonthRange(2026, 5, 1);
    expect(start.toISOString()).toBe('2026-05-01T00:00:00.000Z');
    expect(end.toISOString()).toBe('2026-06-01T00:00:00.000Z');
  });

  it('cutoff=25 returns 25/prev-month to 25/this-month', () => {
    const { start, end } = getFinancialMonthRange(2026, 5, 25);
    expect(start.toISOString()).toBe('2026-04-25T00:00:00.000Z');
    expect(end.toISOString()).toBe('2026-05-25T00:00:00.000Z');
  });

  it('cutoff=25 January wraps to previous December', () => {
    const { start, end } = getFinancialMonthRange(2026, 1, 25);
    expect(start.toISOString()).toBe('2025-12-25T00:00:00.000Z');
    expect(end.toISOString()).toBe('2026-01-25T00:00:00.000Z');
  });

  it('cutoff=28 February range works (no edge clamp needed)', () => {
    const { start, end } = getFinancialMonthRange(2026, 3, 28);
    expect(start.toISOString()).toBe('2026-02-28T00:00:00.000Z');
    expect(end.toISOString()).toBe('2026-03-28T00:00:00.000Z');
  });
});

describe('getCurrentFinancialMonth', () => {
  it('cutoff=1 today=2026-05-15 → {2026, 5}', () => {
    const r = getCurrentFinancialMonth(new Date('2026-05-15T08:00:00.000Z'), 1);
    expect(r).toEqual({ year: 2026, month: 5 });
  });

  it('cutoff=25 today=2026-05-24 (< cutoff) → {2026, 5}', () => {
    const r = getCurrentFinancialMonth(new Date('2026-05-24T08:00:00.000Z'), 25);
    expect(r).toEqual({ year: 2026, month: 5 });
  });

  it('cutoff=25 today=2026-05-25 (>= cutoff) → {2026, 6}', () => {
    const r = getCurrentFinancialMonth(new Date('2026-05-25T00:00:00.000Z'), 25);
    expect(r).toEqual({ year: 2026, month: 6 });
  });

  it('cutoff=25 today=2026-12-26 wraps year → {2027, 1}', () => {
    const r = getCurrentFinancialMonth(new Date('2026-12-26T00:00:00.000Z'), 25);
    expect(r).toEqual({ year: 2027, month: 1 });
  });
});
