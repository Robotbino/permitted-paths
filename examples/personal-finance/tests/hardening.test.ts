// Tests of the repairs of the final hardening pass. Each test failed before its repair.
//   1 A date at the edge of the calendar made GET /api/plan answer 500. One old row in the ledger did the same for each request.
//   2 +10% and -10% of the free spending amount were not the same number of cents (float arithmetic and Math.round).
import { describe, expect, test } from 'vitest';
import type { PlanView } from '../shared/contracts.plan.ts';
import { MAIN } from '../shared/planning/plan-example.ts';
import { fixedClock } from '../server/clock.ts';
import { memoryStores } from '../server/repositories/memory.ts';
import { seed } from '../server/repositories/seed.ts';
import { allowanceConsequences } from '../server/services/assist-checks.ts';
import { planCycle } from '../server/services/plan-cycle.ts';
import { call, makeWorld, PLAN_TODAY, send } from '../scripts/world.ts';

describe('a date at the edge of the calendar is an answer, not a defect', () => {
  test('GET /api/plan and GET /api/weeks give 400 with rule R3 for a date that has no pay cycle', async () => {
    const world = await makeWorld({ today: PLAN_TODAY, ledger: 'worked_example' });
    try {
      // Payday 25. The cycle of 9999-12-31 ends in the year 10000; the cycle of 0100-01-05 starts in the year 0099.
      for (const date of ['9999-12-31', '0100-01-05', '0100-01-26']) {
        for (const path of ['/api/plan', '/api/weeks']) {
          const answer = await call(world, 'GET', path + '?date=' + date);
          expect([answer.status, answer.body.error?.code, answer.body.error?.problems[0]?.rule], path + ' ' + date).toEqual([400, 'BAD_REQUEST', 'R3']);
        }
      }
      // The last cycle and the first cycle that the calendar has are answered.
      expect((await call(world, 'GET', '/api/plan?date=9999-12-24')).body.cycle).toMatchObject({ start: '9999-11-25', end: '9999-12-24' });
      expect((await call(world, 'GET', '/api/weeks?date=0100-02-26')).body.cycle).toMatchObject({ start: '0100-02-25', end: '0100-03-24' });
    } finally {
      await world.close();
    }
  });

  test('an expense and an income row with a very old date do not stop the plan, and do not change it', async () => {
    const world = await makeWorld({ today: PLAN_TODAY, ledger: 'worked_example', interpreter: 'answer' });
    try {
      const before = (await call(world, 'GET', '/api/plan')).body as PlanView;
      const old = await send(world, '/api/expenses', { idempotency_key: 'key-old-0001', amount_cents: 100, currency: 'ZAR', occurred_on: '0100-01-05', merchant_name: 'Old Shop', category_id: 'eating-out' });
      expect(old.status).toBe(201);
      world.app.stores.income.insert({ id: 'inc_old', idempotency_key: 'old-pay-0001', occurred_on: '0100-01-06', amount_cents: 5_000_000, source: 'Old pay', account: MAIN, created_at: '2026-02-03T10:00:00.000Z' });

      const after = await call(world, 'GET', '/api/plan');
      expect(after.status).toBe(200);
      expect(after.body).toEqual(before);
      expect((await call(world, 'GET', '/api/weeks')).status).toBe(200);
      // The assist path reads the same plan: the proposal is made, it is not "the plan cannot be read".
      const proposed = await send(world, '/api/assist', { text: 'Raise my weekly allowance' });
      expect(proposed.body.status).toBe('NEEDS_APPROVAL');
    } finally {
      await world.close();
    }
  });

  test('with only an old income row on record, the plan has no income', () => {
    const stores = memoryStores();
    seed(stores, '2026-02');
    stores.income.insert({ id: 'inc_old', idempotency_key: 'old-pay-0001', occurred_on: '0100-01-06', amount_cents: 5_000_000, source: 'Old pay', account: MAIN, created_at: '2026-02-03T10:00:00.000Z' });
    const view = planCycle({ stores, clock: fixedClock(PLAN_TODAY) });
    expect([view.income_cents, view.income_source]).toEqual([0, 'none']);
  });
});

describe('a percentage of the free spending amount uses integers', () => {
  test('+10% and -10% change the free spending by the same number of cents, also at half a cent', () => {
    const stores = memoryStores();
    seed(stores, '2026-03');
    stores.income.insert({ id: 'inc_1', idempotency_key: 'pay-0001', occurred_on: '2026-03-25', amount_cents: 3_200_000, source: 'Salary', account: MAIN, created_at: '2026-03-25T06:00:00.000Z' });
    const facts = { stores, clock: fixedClock('2026-03-28') };
    // Make the free spending amount end in 5 cents: 10% of it is then a half cent.
    const settings = stores.plan.getSettings()!;
    const free = planCycle(facts).plan!.discretionary_cents;
    stores.plan.setSettings({ ...settings, variable_living_cents: settings.variable_living_cents + ((free - 5) % 10) });
    const odd = planCycle(facts).plan!.discretionary_cents;
    expect(odd % 10).toBe(5);

    const change = (percent: number): number => {
      const answer = allowanceConsequences(facts, percent);
      expect(answer.problems, 'percent ' + percent).toEqual([]);
      const c = answer.consequences as { free_spending_before_cents: number; free_spending_after_cents: number; savings_before_cents: number; savings_after_cents: number };
      // The cents that the free spending gets are the cents that the savings lose.
      expect(c.free_spending_after_cents - c.free_spending_before_cents).toBe(c.savings_before_cents - c.savings_after_cents);
      return c.free_spending_after_cents - c.free_spending_before_cents;
    };
    expect(change(10)).toBe((odd * 10 + 50) / 100); // a half cent goes away from 0
    expect(change(-10)).toBe(-change(10));
  });

  test('a percentage that is not a whole number is refused, not rounded', () => {
    const stores = memoryStores();
    seed(stores, '2026-03');
    stores.income.insert({ id: 'inc_1', idempotency_key: 'pay-0001', occurred_on: '2026-03-25', amount_cents: 3_200_000, source: 'Salary', account: MAIN, created_at: '2026-03-25T06:00:00.000Z' });
    const answer = allowanceConsequences({ stores, clock: fixedClock('2026-03-28') }, 2.5);
    expect([answer.ok, answer.problems.map((p) => p.rule)]).toEqual([false, ['R16']]);
  });
});
