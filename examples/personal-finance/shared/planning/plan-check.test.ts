// Tests of the repairs after a review of the payday plan: an input with a wrong number is refused,
// each cent of the income is in a line of the plan, and the texts state facts only.
import { describe, expect, test } from 'vitest';
import { buildPlan, checkPlanInput, savingsHeld, type Plan, type PlanInput } from './plan.ts';
import { CARD, MAIN, example } from './plan-example.ts';

const sum = (values: number[]): number => values.reduce((a, b) => a + b, 0);
/** Each cent of the income is in a move, in the two estimates, or in the free spending. */
const accountedFor = (input: PlanInput, plan: Plan): number =>
  sum(plan.moves.map((m) => m.amount_cents)) + input.variable_living_cents + input.unlisted_cents + plan.discretionary_cents;

function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null) {
    for (const part of Object.values(value)) deepFreeze(part);
    Object.freeze(value);
  }
  return value;
}

describe('each cent of the income is in the plan', () => {
  test('the worked example adds up to the income', () => {
    expect(accountedFor(example(), buildPlan(example()))).toBe(3_200_000);
  });

  test('chosen savings with no pot get a savings move of their own', () => {
    const input = { ...example(), pots: [] };
    const plan = buildPlan(input);
    expect(plan.sizing.chosen_cents).toBe(600_000);
    expect(plan.unassigned_savings_cents).toBe(600_000);
    expect(plan.moves.filter((m) => m.kind === 'savings')).toEqual([{ order: 2, kind: 'savings', label: 'Move the savings that have no pot', amount_cents: 600_000, on: '2026-01-26' }]);
    expect(plan.moves.map((m) => m.kind)).toEqual(['cover_debits', 'savings', 'pay_people', 'card_transfer']);
    expect(accountedFor(input, plan)).toBe(3_200_000);
    expect(plan.warnings.map((w) => w.rule)).toContain('BR5');
  });

  test('savings above the targets of the pots move after the pots and before the people', () => {
    const input = { ...example(), pots: [{ id: 'e', name: 'Emergency fund', priority: 1, target_cents: 100_000 }] };
    const plan = buildPlan(input);
    expect(plan.moves.map((m) => [m.kind, m.amount_cents])).toEqual([['cover_debits', 340_000], ['savings', 100_000], ['savings', 500_000], ['pay_people', 950_000], ['card_transfer', 234_900]]);
    expect(accountedFor(input, plan)).toBe(3_200_000);
    expect(buildPlan(example()).unassigned_savings_cents).toBe(0);
  });

  test('buildPlan does not change its input and gives the same plan each time', () => {
    const input = deepFreeze(example());
    expect(buildPlan(input)).toEqual(buildPlan(example()));
  });
});

describe('an input with a wrong number is refused', () => {
  const refused = (change: (input: PlanInput) => void, problem: string): void => {
    const input = example();
    change(input);
    expect(checkPlanInput(input)).toContain(problem);
    expect(() => buildPlan(input)).toThrow(RangeError);
  };
  const first = <T>(list: T[]): T => {
    const item = list[0];
    if (item === undefined) throw new Error('the list is empty');
    return item;
  };

  test('the worked example has no problem', () => {
    expect(checkPlanInput(example())).toEqual([]);
  });

  test('an amount below 0 cannot make the headroom larger', () => {
    refused((i) => { first(i.commitments).amount_cents = -950_000; }, 'The amount of the commitment "Rent to the landlord" cannot be below 0.');
    refused((i) => { i.unlisted_cents = -180_000; }, 'The unlisted amount cannot be below 0.');
    refused((i) => { i.buffer_items = [{ name: 'x', amount_cents: -500_000 }]; }, 'The amount of the buffer item "x" cannot be below 0.');
    refused((i) => { i.income_cents = -1; }, 'The income cannot be below 0.');
    refused((i) => { first(i.pots).target_cents = -1; }, 'The target of the pot "New laptop" cannot be below 0.');
  });

  test('NaN, a missing number and a fraction of a cent are refused', () => {
    refused((i) => { i.savings_request_cents = Number.NaN; }, 'The savings request must be a whole number of cents.');
    refused((i) => { i.income_cents = 3_200_000.5; }, 'The income must be a whole number of cents.');
    refused((i) => { i.variable_living_cents = Number.POSITIVE_INFINITY; }, 'The variable living amount must be a whole number of cents.');
    refused((i) => { first(i.pots).priority = Number.NaN; }, 'The priority of the pot "New laptop" must be a number.');
  });

  test('a complete cycle with a missing number is refused, not skipped', () => {
    refused((i) => {
      (i.history[1] as unknown as Record<string, unknown>).unlisted_cents = undefined;
    }, 'The unlisted amount of the cycle 2025-11-25 must be a whole number of cents.');
  });

  test('an incomplete cycle is not used, thus its numbers are not checked', () => {
    const input = example();
    (input.history[2] as unknown as Record<string, unknown>).unlisted_cents = undefined;
    expect(buildPlan(input).sizing.sustainable_cents).toBe(600_000);
  });

  test('a due date that is not a date is refused', () => {
    for (const due_on of ['2026-1-28', '2026-02-1x', '', '2026-02-30']) {
      refused((i) => { first(i.commitments).due_on = due_on; }, 'The due date of the commitment "Rent to the landlord" must be a date in the form YYYY-MM-DD.');
    }
  });

  test('amounts with a sum that is not exact are refused', () => {
    refused((i) => {
      i.commitments = [...i.commitments, { id: 'a', name: 'A', amount_cents: Number.MAX_SAFE_INTEGER, due_on: '2026-02-01', account: MAIN }, { id: 'b', name: 'B', amount_cents: Number.MAX_SAFE_INTEGER, due_on: '2026-02-01', account: MAIN }];
    }, 'The amounts are too large: their sum is not exact.');
    expect(checkPlanInput({ ...example(), income_cents: 1_000_000_000_000_000 })).toEqual([]); // large, and the sum of all amounts is still exact
  });
});

describe('warnings', () => {
  test('a payment that is due on the payday gets a BR3 warning, because the moves are on the day after', () => {
    const input = example();
    input.commitments = [
      { id: 'rent', name: 'Rent to the landlord', amount_cents: 950_000, due_on: '2026-01-25', account: MAIN, pay_to_person: true },
      { id: 'gym', name: 'Ironworks Gym', amount_cents: 55_000, due_on: '2026-01-25', account: CARD },
      { id: 'phone', name: 'Phone contract', amount_cents: 45_000, due_on: '2026-01-25', account: MAIN },
      { id: 'medical', name: 'Medical aid', amount_cents: 210_000, due_on: '2026-01-26', account: MAIN, pay_to_person: true },
    ];
    expect(buildPlan(input).warnings.filter((w) => w.rule === 'BR3')).toEqual([
      { rule: 'BR3', text: 'The commitment "Rent to the landlord" is due on 2026-01-25. The moves of the plan are on 2026-01-26, after that date.' },
      { rule: 'BR3', text: 'The commitment "Ironworks Gym" is due on 2026-01-25. The moves of the plan are on 2026-01-26, after that date.' },
    ]);
    expect(buildPlan(example()).warnings.some((w) => w.rule === 'BR3')).toBe(false);
  });

  test('in a cycle of 1 day the moves are on the payday, not outside the cycle', () => {
    const plan = buildPlan({ ...example(), cycle: { id: '2026-01-25', start: '2026-01-25', end: '2026-01-25', days: 1 } });
    expect(plan.moves.every((m) => m.on === '2026-01-25')).toBe(true);
  });

  test('free spending of less than 1 cent for each day gives a BR7 warning with the amount', () => {
    // The headroom of the example is 845 100. A request of 845 080 leaves 20 cents for 31 days.
    const plan = buildPlan({ ...example(), savings_request_cents: 845_080, history: [] });
    expect(plan).toMatchObject({ discretionary_cents: 20, daily_rate_cents: 0, remainder_cents: 20 });
    expect(plan.warnings).toContainEqual({ rule: 'BR7', text: 'R0.20 is left for free spending. That is less than 1 cent for each day, thus each weekly cap is R0.00.' });
  });

  test('savings rows that add up to less than 0 are stated as that, not as "no savings row"', () => {
    expect(savingsHeld(600_000, -50_000)).toEqual({ held: false, text: 'The plan was R6 000.00. The savings rows of this cycle add up to -R500.00: more came out of savings than went in.' });
  });

  test('no text of the plan contains a judgement word', () => {
    const words = /\b(bad|fail\w*|irresponsibl\w*|should have|guilty|shame\w*|lazy|wast\w*)\b/i;
    const late = example();
    late.commitments = [{ id: 'rent', name: 'Rent to the landlord', amount_cents: 950_000, due_on: '2026-01-25', account: MAIN, pay_to_person: true }, { id: 'old', name: 'Phone contract', amount_cents: 45_000, due_on: '2026-03-01', account: MAIN }];
    late.buffer_items = [];
    const plans = [
      buildPlan(example()),
      buildPlan(late),
      buildPlan({ ...example(), pots: [] }),
      buildPlan({ ...example(), history: [], savings_request_cents: 100 }),
      buildPlan({ ...example(), history: [], savings_request_cents: 845_080 }),
      buildPlan({ ...example(), history: [], savings_request_cents: 900_000 }),
      buildPlan({ ...example(), savings_request_cents: 100 }),
      buildPlan({ ...example(), unlisted_cents: 500_000 }),
    ];
    const texts = plans.flatMap((p) => [p.sizing.reason, ...p.warnings.map((w) => w.text), ...p.moves.map((m) => m.label), ...p.arithmetic.map((a) => a.label)]);
    for (const [planned, rows] of [[0, 0], [600_000, 600_000], [600_000, 0], [600_000, 450_000], [600_000, -50_000]] as const) texts.push(savingsHeld(planned, rows).text);
    expect(new Set(plans.flatMap((p) => p.warnings.map((w) => w.rule)))).toEqual(new Set(['BR1', 'BR3', 'BR4', 'BR5', 'BR6', 'BR7']));
    for (const text of texts) expect(text).not.toMatch(words);
    for (const problem of checkPlanInput({ ...example(), income_cents: -1, unlisted_cents: 0.5 })) expect(problem).not.toMatch(words);
  });
});
