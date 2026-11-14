// Tests of the payday plan. The worked example (plan-example.ts) checks each line of the arithmetic,
// then the sizing: the worst complete cycle, the excluded cycles, a request below and above the limit.
import { describe, expect, test } from 'vitest';
import { buildPlan } from './plan.ts';
import { example, rand } from './plan-example.ts';

describe('the worked example', () => {
  const plan = buildPlan(example());

  test('each subtraction is one line, in order, and the last line is the headroom', () => {
    expect(plan.arithmetic).toEqual([
      { label: 'Income', amount_cents: 3_200_000, running_cents: 3_200_000 },
      { label: 'Minus commitments', amount_cents: 1_364_900, running_cents: 1_835_100 },
      { label: 'Minus variable living', amount_cents: 650_000, running_cents: 1_185_100 },
      { label: 'Minus unlisted spending', amount_cents: 180_000, running_cents: 1_005_100 },
      { label: 'Minus buffer = headroom', amount_cents: 160_000, running_cents: 845_100 },
    ]);
    expect(plan.headroom_cents).toBe(845_100);
  });

  test('the headroom without the unlisted layer is overstated by the unlisted amount', () => {
    expect(plan.naive_headroom_cents).toBe(1_025_100);
    expect(plan.overstated_by_cents).toBe(180_000);
  });

  test('the sustainable amount comes from the worst complete cycle, and the incomplete cycle is excluded', () => {
    expect(plan.sizing).toEqual({
      sustainable_cents: 600_000,
      worst_cycle_id: '2025-11-25',
      excluded_cycles: ['2025-12-25'],
      requested_cents: 700_000,
      chosen_cents: 600_000,
      reason: 'The cycle 2025-11-25 had the lowest headroom on record, and it limits the amount to R6 000.00.',
    });
  });

  test('the pots are funded in priority order, and the plan names the pot that gets less', () => {
    expect(plan.split).toEqual([
      { pot_id: 'emergency', name: 'Emergency fund', target_cents: 300_000, funded_cents: 300_000, shortfall_cents: 0 },
      { pot_id: 'holiday', name: 'Holiday', target_cents: 200_000, funded_cents: 200_000, shortfall_cents: 0 },
      { pot_id: 'laptop', name: 'New laptop', target_cents: 200_000, funded_cents: 100_000, shortfall_cents: 100_000 },
    ]);
    expect(plan.sacrificed).toEqual(['New laptop']);
  });

  test('the moves are on the day after payday: debits, then savings, then people, then the card', () => {
    expect(plan.moves.map((m) => [m.order, m.kind, m.amount_cents])).toEqual([
      [1, 'cover_debits', 340_000],
      [2, 'savings', 300_000],
      [3, 'savings', 200_000],
      [4, 'savings', 100_000],
      [5, 'pay_people', 950_000],
      [6, 'card_transfer', 234_900], // R749.00 of card commitments + R1 600.00 of buffer
    ]);
    expect(plan.moves.every((m) => m.on === '2026-01-26')).toBe(true);
    expect(plan.moves[4]?.label).toBe('Pay Rent to the landlord');
  });

  test('the weekly caps come from the daily rate, and the remainder is stated', () => {
    expect(plan.discretionary_cents).toBe(245_100);
    expect(plan.daily_rate_cents).toBe(7_906);
    expect(plan.weeks.map((w) => [w.index, w.days, w.cap_cents])).toEqual([[1, 7, 55_342], [2, 7, 55_342], [3, 7, 55_342], [4, 7, 55_342], [5, 3, 23_718]]);
    expect(plan.weeks[4]).toMatchObject({ start: '2026-02-22', end: '2026-02-24' });
    expect(plan.remainder_cents).toBe(14);
    expect(plan.weeks.reduce((sum, w) => sum + w.cap_cents, 0) + plan.remainder_cents).toBe(plan.discretionary_cents);
  });

  test('the warnings say that the request is above the limit and that a cycle is excluded', () => {
    expect(plan.warnings).toEqual([
      { rule: 'BR4', text: 'The history has incomplete cycles. They are not used: 2025-12-25.' },
      { rule: 'BR4', text: 'The request of R7 000.00 is above the sustainable amount of R6 000.00. The plan uses R6 000.00.' },
    ]);
  });
});

describe('sizing', () => {
  test('a request below the sustainable amount is used as it is, with no warning', () => {
    const plan = buildPlan({ ...example(), savings_request_cents: rand('4000'), history: example().history.filter((h) => h.complete) });
    expect(plan.sizing.chosen_cents).toBe(400_000);
    expect(plan.sizing.reason).toBe('The request of R4 000.00 fits in each complete cycle on record and in this cycle.');
    expect(plan.warnings).toEqual([{ rule: 'BR5', text: 'The pot "New laptop" gets no funding in this cycle. Pots with a higher priority use the amount.' }]);
    expect(plan.sacrificed).toEqual(['New laptop', 'Holiday']);
    expect(plan.discretionary_cents).toBe(445_100);
  });

  test('a request equal to the sustainable amount fits', () => {
    const plan = buildPlan({ ...example(), savings_request_cents: 600_000 });
    expect(plan.sizing.chosen_cents).toBe(600_000);
    expect(plan.warnings.some((w) => w.text.includes('above the sustainable amount'))).toBe(false);
  });

  test('this cycle is the worst cycle when its headroom is the lowest', () => {
    const plan = buildPlan({ ...example(), unlisted_cents: rand('5000') });
    expect(plan.headroom_cents).toBe(525_100);
    expect(plan.sizing).toMatchObject({ sustainable_cents: 525_100, worst_cycle_id: '2026-01-25', chosen_cents: 525_100 });
    expect(plan.sizing.reason).toBe('The headroom of this cycle limits the amount to R5 251.00.');
  });

  test('with no complete history the limit is the headroom of this cycle, and the reason says so', () => {
    const plan = buildPlan({ ...example(), savings_request_cents: rand('9000'), history: example().history.filter((h) => !h.complete) });
    expect(plan.sizing).toMatchObject({ sustainable_cents: 845_100, worst_cycle_id: null, excluded_cycles: ['2025-12-25'], chosen_cents: 845_100 });
    expect(plan.sizing.reason).toBe('No complete cycle is on record, thus the limit is the headroom of this cycle: R8 451.00.');
    expect(plan.warnings.map((w) => w.rule)).toContain('BR4');
    expect(plan.discretionary_cents).toBe(0);
  });

  test('a complete cycle with a headroom below 0 makes the sustainable amount 0', () => {
    const history = [{ cycle_id: '2025-09-25', complete: true, income_cents: 1_000_000, commitments_cents: 1_364_900, variable_cents: 0, unlisted_cents: 0 }];
    const plan = buildPlan({ ...example(), history });
    expect(plan.sizing).toMatchObject({ sustainable_cents: 0, worst_cycle_id: '2025-09-25', chosen_cents: 0 });
    expect(plan.moves.some((m) => m.kind === 'savings')).toBe(false);
    expect(plan.sacrificed).toEqual(['New laptop', 'Holiday', 'Emergency fund']);
  });

  test('a request below 0 is treated as 0', () => {
    expect(buildPlan({ ...example(), savings_request_cents: -500 }).sizing).toMatchObject({ requested_cents: 0, chosen_cents: 0 });
  });
});
