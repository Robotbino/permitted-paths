// Tests of the pace: the status of a week at its boundaries, the variance with no carry-over,
// and the rule that the plan held only if the savings really moved.
// The functions are imported from plan.ts, because that is the file that other code uses.
import { describe, expect, test } from 'vitest';
import { paceOf, savingsHeld, weekStatus } from './plan.ts';

describe('weekStatus', () => {
  test('OK while 20% or more of the cap is left', () => {
    expect(weekStatus(50_000, 0)).toBe('OK');
    expect(weekStatus(50_000, 40_000)).toBe('OK'); // exactly 20% is left
  });

  test('NEAR when less than 20% of the cap is left, up to the cap', () => {
    expect(weekStatus(50_000, 40_001)).toBe('NEAR');
    expect(weekStatus(50_000, 50_000)).toBe('NEAR'); // exactly the cap is not over
  });

  test('OVER only when the spending is more than the cap', () => {
    expect(weekStatus(50_000, 50_001)).toBe('OVER');
    expect(weekStatus(0, 1)).toBe('OVER');
  });

  test('a cap of 0 with no spending is OK', () => {
    expect(weekStatus(0, 0)).toBe('OK');
  });

  test('the near percent can be changed, and a cap that does not divide evenly uses integer arithmetic', () => {
    expect(weekStatus(50_000, 30_000, 50)).toBe('NEAR');
    expect(weekStatus(50_000, 25_000, 50)).toBe('OK');
    expect(weekStatus(55_342, 44_273)).toBe('OK'); // 11 069 left; 20% of the cap is 11 068.4
    expect(weekStatus(55_342, 44_274)).toBe('NEAR'); // 11 068 left
  });
});

describe('paceOf', () => {
  test('the variance of a week is cap minus spent, and the sum is the cumulative number', () => {
    const pace = paceOf([{ cap_cents: 50_000, spent_cents: 42_000 }, { cap_cents: 50_000, spent_cents: 61_000 }, { cap_cents: 20_000, spent_cents: 20_000 }]);
    expect(pace.per_week).toEqual([{ variance_cents: 8_000 }, { variance_cents: -11_000 }, { variance_cents: 0 }]);
    expect(pace.cumulative_cents).toBe(-3_000);
  });

  test('a week with no data has a variance of null and counts as 0', () => {
    const pace = paceOf([{ cap_cents: 50_000, spent_cents: 45_000 }, { cap_cents: 50_000, spent_cents: null }]);
    expect(pace.per_week).toEqual([{ variance_cents: 5_000 }, { variance_cents: null }]);
    expect(pace.cumulative_cents).toBe(5_000);
  });

  test('nothing carries over: the variance of a week uses only the cap of that week', () => {
    const quietFirst = paceOf([{ cap_cents: 50_000, spent_cents: 0 }, { cap_cents: 50_000, spent_cents: 60_000 }]);
    const heavyFirst = paceOf([{ cap_cents: 50_000, spent_cents: 90_000 }, { cap_cents: 50_000, spent_cents: 60_000 }]);
    expect(quietFirst.per_week[1]).toEqual({ variance_cents: -10_000 });
    expect(heavyFirst.per_week[1]).toEqual({ variance_cents: -10_000 });
  });

  test('no weeks gives an empty list and 0', () => {
    expect(paceOf([])).toEqual({ per_week: [], cumulative_cents: 0 });
  });
});

describe('savingsHeld', () => {
  test('the plan held when the planned amount or more moved to savings', () => {
    expect(savingsHeld(600_000, 600_000)).toEqual({ held: true, text: 'R6 000.00 moved to savings. The plan was R6 000.00.' });
    expect(savingsHeld(600_000, 650_000).held).toBe(true);
  });

  test('the plan did not hold when no savings moved, also if the spending was under the caps', () => {
    expect(savingsHeld(600_000, 0)).toEqual({
      held: false,
      text: 'The plan was R6 000.00 and no savings row is on record. Money that is under the caps is not saved until it moves.',
    });
  });

  test('a part of the savings is stated with the amount that has not moved', () => {
    expect(savingsHeld(600_000, 450_000)).toEqual({ held: false, text: 'R4 500.00 of the planned R6 000.00 moved to savings. R1 500.00 has not moved yet.' });
  });

  test('a plan with no savings holds', () => {
    expect(savingsHeld(0, 0)).toEqual({ held: true, text: 'The plan had no savings for this cycle.' });
  });
});
