// More tests of the payday plan: the priority split, the order of the moves, the warnings,
// and a cycle where the headroom is below 0.
import { describe, expect, test } from 'vitest';
import { buildPlan } from './plan.ts';
import { MAIN, example, rand } from './plan-example.ts';

describe('split, moves and warnings', () => {
  test('pots with the same priority keep the order of the input', () => {
    const pots = [{ id: 'b', name: 'B', priority: 1, target_cents: 400_000 }, { id: 'a', name: 'A', priority: 1, target_cents: 400_000 }];
    const plan = buildPlan({ ...example(), pots });
    expect(plan.split.map((s) => [s.pot_id, s.funded_cents])).toEqual([['b', 400_000], ['a', 200_000]]);
  });

  test('savings that are more than the targets of the pots are stated, not hidden', () => {
    const plan = buildPlan({ ...example(), pots: [{ id: 'e', name: 'Emergency fund', priority: 1, target_cents: 100_000 }] });
    expect(plan.sacrificed).toEqual([]);
    expect(plan.warnings).toContainEqual({ rule: 'BR5', text: 'R5 000.00 of the savings has no pot. The targets of the pots are smaller than the chosen amount.' });
  });

  test('with no card account there is no card transfer, and savings are never after spending', () => {
    const input = example();
    delete input.card_account;
    const kinds = buildPlan(input).moves.map((m) => m.kind);
    expect(kinds).toEqual(['cover_debits', 'savings', 'savings', 'savings', 'pay_people']);
    expect(kinds.lastIndexOf('savings')).toBeLessThan(kinds.indexOf('pay_people'));
  });

  test('a commitment that is due outside the cycle and a buffer with no item give warnings', () => {
    const input = example();
    input.commitments = [{ id: 'rent', name: 'Rent to the landlord', amount_cents: 950_000, due_on: '2026-02-25', account: MAIN, pay_to_person: true }];
    input.buffer_items = [];
    const rules = buildPlan(input).warnings.map((w) => w.rule);
    expect(rules).toContain('BR1');
    expect(rules).toContain('BR6');
  });
});

describe('a headroom below 0', () => {
  const plan = buildPlan({ ...example(), income_cents: rand('20000') });

  test('the headroom is negative, and nothing is saved or left for free spending', () => {
    expect(plan.headroom_cents).toBe(-354_900);
    expect(plan.arithmetic[4]?.running_cents).toBe(-354_900);
    expect(plan.sizing).toMatchObject({ sustainable_cents: 0, chosen_cents: 0, worst_cycle_id: '2026-01-25' });
    expect(plan.discretionary_cents).toBe(0);
    expect(plan.daily_rate_cents).toBe(0);
    expect(plan.weeks.every((w) => w.cap_cents === 0)).toBe(true);
    expect(plan.remainder_cents).toBe(0);
  });

  test('the warnings state the facts with no judgement word', () => {
    expect(plan.warnings[0]).toEqual({ rule: 'BR2', text: 'The headroom is -R3 549.00. The listed costs and the buffer are more than the income of this cycle.' });
    expect(plan.warnings.map((w) => w.rule)).toEqual(['BR2', 'BR4', 'BR4', 'BR5', 'BR5', 'BR5', 'BR7']);
    const words = /\b(bad|fail\w*|irresponsibl\w*|should have|guilty|shame\w*|lazy|wast\w*)\b/i;
    for (const text of [plan.sizing.reason, ...plan.warnings.map((w) => w.text), ...plan.moves.map((m) => m.label)]) expect(text).not.toMatch(words);
  });

  test('the debits and the people are still in the moves', () => {
    expect(plan.moves.map((m) => m.kind)).toEqual(['cover_debits', 'pay_people', 'card_transfer']);
    expect(plan.moves.map((m) => m.order)).toEqual([1, 2, 3]);
  });
});
