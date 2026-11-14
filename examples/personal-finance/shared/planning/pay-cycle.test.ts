// Tests of the pay cycle: month ends, year ends, February, the two limits of the payday, and the week blocks.
import { describe, expect, test } from 'vitest';
import { addDays, cycleContaining, daysBetween, isDate, nextCycle, previousCycle, weekBlocks } from './pay-cycle.ts';

describe('dates', () => {
  test('addDays goes across a month end, a year end and a leap day', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(addDays('2026-03-10', 0)).toBe('2026-03-10');
  });

  test('daysBetween counts from the first date to the second date', () => {
    expect(daysBetween('2026-03-10', '2026-03-10')).toBe(0);
    expect(daysBetween('2026-12-25', '2027-01-24')).toBe(30);
    expect(daysBetween('2027-01-24', '2026-12-25')).toBe(-30);
    expect(daysBetween('2028-02-01', '2028-03-01')).toBe(29);
  });

  test('a date that has a wrong form is refused', () => {
    expect(() => addDays('2026/01/01', 1)).toThrow(RangeError);
  });

  test('a date that is not a day of the calendar is refused, not moved to a different day', () => {
    for (const date of ['2026-02-30', '2026-13-45', '2026-02-29', '2026-00-10', '2026-04-31', '0050-01-01']) {
      expect(() => addDays(date, 0)).toThrow(RangeError);
      expect(isDate(date)).toBe(false);
    }
    expect(() => cycleContaining('2026-02-31', 25)).toThrow(RangeError);
    expect(() => cycleContaining('0099-06-10', 5)).toThrow(RangeError);
    expect(() => daysBetween('2026-02-30', '2026-03-01')).toThrow(RangeError);
    expect(isDate('2028-02-29')).toBe(true);
    expect(isDate('0100-01-01')).toBe(true);
  });

  test('a number of days that is not a whole number is refused', () => {
    expect(() => addDays('2026-01-01', Number.NaN)).toThrow(RangeError);
    expect(() => addDays('2026-01-01', 1.5)).toThrow(RangeError);
    expect(() => addDays('2026-01-01', Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });

  test('a result outside the years 0000 to 9999 is refused, thus dates always compare as strings', () => {
    expect(() => addDays('9999-12-31', 1)).toThrow(RangeError);
    expect(addDays('9999-12-30', 1)).toBe('9999-12-31');
  });
});

describe('cycleContaining', () => {
  test('a date on or after the payday is in the cycle that starts in the same month', () => {
    expect(cycleContaining('2026-03-25', 25)).toEqual({ id: '2026-03-25', start: '2026-03-25', end: '2026-04-24', days: 31 });
    expect(cycleContaining('2026-03-31', 25).id).toBe('2026-03-25');
  });

  test('a date before the payday is in the cycle that started in the previous month', () => {
    expect(cycleContaining('2026-04-24', 25).id).toBe('2026-03-25');
    expect(cycleContaining('2026-04-01', 25).id).toBe('2026-03-25');
  });

  test('a cycle goes across the end of the year', () => {
    expect(cycleContaining('2027-01-10', 25)).toEqual({ id: '2026-12-25', start: '2026-12-25', end: '2027-01-24', days: 31 });
    expect(cycleContaining('2026-12-25', 25).end).toBe('2027-01-24');
  });

  test('February: the cycle has 28 days in a common year and 29 days in a leap year', () => {
    expect(cycleContaining('2026-02-20', 15)).toEqual({ id: '2026-02-15', start: '2026-02-15', end: '2026-03-14', days: 28 });
    expect(cycleContaining('2028-02-20', 15)).toEqual({ id: '2028-02-15', start: '2028-02-15', end: '2028-03-14', days: 29 });
  });

  test('payday 1 gives the calendar month', () => {
    expect(cycleContaining('2026-02-01', 1)).toEqual({ id: '2026-02-01', start: '2026-02-01', end: '2026-02-28', days: 28 });
    expect(cycleContaining('2026-12-31', 1)).toEqual({ id: '2026-12-01', start: '2026-12-01', end: '2026-12-31', days: 31 });
  });

  test('payday 28 works in February and at the end of the year', () => {
    expect(cycleContaining('2026-02-27', 28)).toEqual({ id: '2026-01-28', start: '2026-01-28', end: '2026-02-27', days: 31 });
    expect(cycleContaining('2026-02-28', 28)).toEqual({ id: '2026-02-28', start: '2026-02-28', end: '2026-03-27', days: 28 });
    expect(cycleContaining('2027-01-01', 28).id).toBe('2026-12-28');
  });

  test('a payday outside 1 to 28 is refused', () => {
    expect(() => cycleContaining('2026-03-10', 0)).toThrow(RangeError);
    expect(() => cycleContaining('2026-03-10', 29)).toThrow(RangeError);
    expect(() => cycleContaining('2026-03-10', 2.5)).toThrow(RangeError);
  });
});

describe('nextCycle and previousCycle', () => {
  test('the next cycle starts on the day after the end, also across a year end', () => {
    const cycle = cycleContaining('2026-12-01', 25);
    expect(cycle.id).toBe('2026-11-25');
    expect(nextCycle(cycle, 25).id).toBe('2026-12-25');
    expect(nextCycle(nextCycle(cycle, 25), 25).id).toBe('2027-01-25');
  });

  test('the previous cycle ends on the day before the start', () => {
    const cycle = cycleContaining('2027-01-05', 1);
    expect(previousCycle(cycle, 1)).toEqual({ id: '2026-12-01', start: '2026-12-01', end: '2026-12-31', days: 31 });
  });

  test('previous of next is the same cycle', () => {
    const cycle = cycleContaining('2026-02-10', 28);
    expect(previousCycle(nextCycle(cycle, 28), 28)).toEqual(cycle);
  });
});

describe('a payday that is not the payday of the cycle', () => {
  const cycle = cycleContaining('2026-02-03', 25);

  test('nextCycle and previousCycle refuse it, because the result would overlap the cycle', () => {
    expect(() => nextCycle(cycle, 26)).toThrow(RangeError);
    expect(() => nextCycle(cycle, 1)).toThrow(RangeError);
    expect(() => previousCycle(cycle, 24)).toThrow(RangeError);
    expect(() => nextCycle(cycle, 29)).toThrow(RangeError);
  });

  test('the payday of the cycle is accepted, and the next cycle starts after the end', () => {
    expect(nextCycle(cycle, 25).start > cycle.end).toBe(true);
    expect(previousCycle(cycle, 25).end < cycle.start).toBe(true);
  });
});

describe('weekBlocks', () => {
  test('a 28 day cycle has 4 full blocks', () => {
    const blocks = weekBlocks(cycleContaining('2026-02-15', 15));
    expect(blocks.map((b) => b.days)).toEqual([7, 7, 7, 7]);
    expect(blocks[0]).toEqual({ index: 1, start: '2026-02-15', end: '2026-02-21', days: 7 });
    expect(blocks[3]?.end).toBe('2026-03-14');
  });

  test('a 30 day cycle has a last block of 2 days', () => {
    const cycle = cycleContaining('2026-04-25', 25);
    expect(cycle.days).toBe(30);
    const blocks = weekBlocks(cycle);
    expect(blocks.map((b) => b.days)).toEqual([7, 7, 7, 7, 2]);
    expect(blocks[4]).toEqual({ index: 5, start: '2026-05-23', end: '2026-05-24', days: 2 });
  });

  test('a 31 day cycle has a last block of 3 days', () => {
    const blocks = weekBlocks(cycleContaining('2026-03-25', 25));
    expect(blocks.map((b) => b.days)).toEqual([7, 7, 7, 7, 3]);
    expect(blocks[4]).toEqual({ index: 5, start: '2026-04-22', end: '2026-04-24', days: 3 });
  });

  test('a 29 day cycle has a last block of 1 day, and the blocks cover each day one time', () => {
    const cycle = cycleContaining('2028-02-20', 15);
    const blocks = weekBlocks(cycle);
    expect(blocks.map((b) => b.days)).toEqual([7, 7, 7, 7, 1]);
    expect(blocks.reduce((sum, b) => sum + b.days, 0)).toBe(cycle.days);
    for (let i = 1; i < blocks.length; i++) expect(blocks[i]?.start).toBe(addDays(blocks[i - 1]?.end ?? '', 1));
    expect(blocks[blocks.length - 1]?.end).toBe(cycle.end);
  });
});
