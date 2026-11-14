// The plan service with the stores in memory. The data is the fictional person Sam, paid on day 25.
// The tests put rows into the ledger and read the view: no figure of the view is stored anywhere.
import { describe, expect, test } from 'vitest';
import { cycleContaining } from '../../shared/planning/pay-cycle.ts';
import { buildPlan } from '../../shared/planning/plan.ts';
import { MAIN, example, rand } from '../../shared/planning/plan-example.ts';
import { fixedClock } from '../clock.ts';
import { AppError } from '../errors.ts';
import { memoryStores } from '../repositories/memory.ts';
import { seed } from '../repositories/seed.ts';
import { planCycle, weeksOfCycle } from './plan-cycle.ts';

/** A world with the seed (the plan of the worked example) and a clock. spend and paid add rows to the ledger. */
function world(today = '2026-02-03') {
  const stores = memoryStores();
  seed(stores, '2026-03');
  let n = 0;
  const spend = (occurred_on: string, amount: string, category_id: string, merchant = 'Corner Shop') => {
    n += 1;
    stores.expenses.insert({
      id: 'exp_' + n, idempotency_key: 'key-' + String(n).padStart(4, '0'), occurred_on, amount_cents: rand(amount), currency: 'ZAR',
      merchant_name: merchant, merchant_key: merchant.toLowerCase(), category_id, note: null, account: 'main', created_at: occurred_on + 'T10:00:00.' + String(n).padStart(3, '0') + 'Z',
    });
  };
  const paid = (occurred_on: string, amount = '32000') => {
    n += 1;
    stores.income.insert({ id: 'inc_' + n, idempotency_key: 'pay-' + String(n).padStart(4, '0'), occurred_on, amount_cents: rand(amount), source: 'Salary', account: MAIN, created_at: occurred_on + 'T06:00:00.000Z' });
  };
  return { stores, spend, paid, deps: { stores, clock: fixedClock(today) } };
}

/**
 * The ledger behind the worked example. Two complete cycles and one cycle with no income row.
 * The numbers of the history are not those of plan-example.ts, but they give the same plan:
 * the largest free total of a complete cycle is R1 800, and the lowest headroom is R6 000 (cycle 2025-11-25).
 */
function workedExample(today?: string) {
  const w = world(today);
  w.paid('2025-10-25');
  w.spend('2025-11-01', '13649', 'rent');
  w.spend('2025-11-05', '7000', 'groceries');
  w.spend('2025-11-08', '1500', 'eating-out');
  w.paid('2025-11-25');
  w.spend('2025-12-01', '13649', 'rent');
  w.spend('2025-12-05', '10551', 'groceries');
  w.spend('2025-12-09', '1800', 'entertainment');
  w.spend('2026-01-05', '900', 'groceries'); // the cycle 2025-12-25: an expense, and no income row
  w.paid('2026-01-25');
  return w;
}

describe('the plan of the worked example', () => {
  test('the service gives the same plan as buildPlan(example())', () => {
    const view = planCycle(workedExample().deps);
    expect(view.cycle).toEqual(example().cycle);
    expect([view.income_cents, view.income_source]).toEqual([rand('32000'), 'this_cycle']);
    expect(view.input.commitments).toEqual(example().commitments);
    expect(view.input.unlisted_cents).toBe(rand('1800'));
    expect(view.input_problems).toEqual([]);
    expect(view.plan).toEqual(buildPlan(example()));
    expect(view.plan?.sizing).toMatchObject({ chosen_cents: rand('6000'), worst_cycle_id: '2025-11-25', excluded_cycles: ['2025-12-25'] });
  });

  test('a commitment gets the date in the cycle that has its day of the month, also over a year end', () => {
    const due = Object.fromEntries(planCycle(workedExample().deps, '2026-01-10').input.commitments.map((c) => [c.id, c.due_on]));
    expect(due).toMatchObject({ phone: '2025-12-28', rent: '2026-01-01', gym: '2026-01-10' });
  });

  test('a commitment or a pot that is not active is not in the plan', () => {
    const { stores, deps } = workedExample();
    stores.plan.upsertCommitment({ ...stores.plan.listCommitments().find((c) => c.id === 'gym')!, active: false });
    stores.plan.upsertPot({ ...stores.plan.listPots().find((p) => p.id === 'holiday')!, active: false });
    const view = planCycle(deps);
    expect(view.input.commitments.map((c) => c.id)).not.toContain('gym');
    expect(view.plan?.split.map((s) => s.pot_id)).toEqual(['emergency', 'laptop']);
  });

  test('the date selects the cycle; without a date it is the cycle of today', () => {
    const { deps } = workedExample();
    expect(planCycle(deps).cycle.id).toBe('2026-01-25');
    expect(planCycle(deps, '2025-12-24').cycle).toEqual(cycleContaining('2025-12-24', 25));
    expect(planCycle(deps, '2025-12-24').input.history.map((h) => h.cycle_id)).toEqual(['2025-10-25']);
  });
});

describe('the income of the plan', () => {
  test('with no income row in the cycle, the income is that of the most recent cycle that has one', () => {
    const w = world();
    w.paid('2025-11-25', '30000');
    w.paid('2025-12-10', '500'); // a second row of the same cycle
    w.paid('2025-10-25', '99000'); // an older cycle: not used
    const view = planCycle(w.deps);
    expect([view.income_cents, view.income_source]).toEqual([rand('30500'), 'previous_cycle']);
  });

  test('with no income row at all, the income is 0 and the view says so', () => {
    const view = planCycle(world().deps);
    expect([view.income_cents, view.income_source]).toEqual([0, 'none']);
    expect(view.plan?.headroom_cents).toBeLessThan(0);
  });
});

describe('the history comes from the ledger', () => {
  test('each earlier cycle with an expense row: fixed, variable and free totals, and the income rows', () => {
    const { deps } = workedExample();
    expect(planCycle(deps).input.history).toEqual([
      { cycle_id: '2025-10-25', complete: true, income_cents: rand('32000'), commitments_cents: rand('13649'), variable_cents: rand('7000'), unlisted_cents: rand('1500') },
      { cycle_id: '2025-11-25', complete: true, income_cents: rand('32000'), commitments_cents: rand('13649'), variable_cents: rand('10551'), unlisted_cents: rand('1800') },
      { cycle_id: '2025-12-25', complete: false, income_cents: 0, commitments_cents: 0, variable_cents: rand('900'), unlisted_cents: 0 },
    ]);
  });

  test('a cycle with no income row is incomplete: its free spending does not change the plan', () => {
    const w = workedExample();
    const before = planCycle(w.deps);
    w.spend('2026-01-06', '9000', 'entertainment'); // a large free amount in the cycle that has no income row
    const after = planCycle(w.deps);
    expect(after.input.history[2]).toMatchObject({ cycle_id: '2025-12-25', complete: false, unlisted_cents: rand('9000') });
    expect(after.input.unlisted_cents).toBe(rand('1800'));
    expect(after.plan).toEqual(before.plan);
  });

  test('a cycle that has not ended is incomplete, also with an income row', () => {
    const w = workedExample('2026-01-10'); // today is in the cycle 2025-12-25
    w.paid('2025-12-25');
    const history = planCycle(w.deps, '2026-02-03').input.history;
    expect(history.find((h) => h.cycle_id === '2025-12-25')).toMatchObject({ complete: false, income_cents: rand('32000') });
    w.deps.clock = fixedClock('2026-01-25'); // the day after the cycle ended
    expect(planCycle(w.deps, '2026-02-03').input.history.find((h) => h.cycle_id === '2025-12-25')?.complete).toBe(true);
  });

  test('a savings row and a transfer row of an earlier cycle are not spending of that cycle', () => {
    const w = workedExample();
    w.spend('2025-11-26', '5000', 'savings');
    w.spend('2025-11-27', '2000', 'own-transfer');
    expect(planCycle(w.deps).input.history[1]).toMatchObject({ commitments_cents: rand('13649'), variable_cents: rand('10551'), unlisted_cents: rand('1800') });
  });

  test('with no complete cycle the unlisted amount is 0', () => {
    const w = world();
    w.paid('2026-01-25');
    w.spend('2026-01-05', '700', 'eating-out');
    const view = planCycle(w.deps);
    expect(view.input.unlisted_cents).toBe(0);
    expect(view.plan?.sizing.worst_cycle_id).toBeNull();
  });
});

describe('the weeks, the savings and the headline', () => {
  // Discretionary = R8 451 - R6 000 = R2 451. Daily rate = 245100 / 31 = 7906 cents. A block of 7 days has a cap of 55342 cents.
  function inProgress() {
    const w = workedExample();
    w.spend('2026-01-26', '300', 'eating-out');
    w.spend('2026-01-27', '500', 'groceries'); // variable: not free spending
    w.spend('2026-02-01', '9500', 'rent'); // fixed: not free spending
    w.spend('2026-01-27', '1000', 'own-transfer'); // a move between own accounts
    w.spend('2026-02-02', '150', 'entertainment');
    return w;
  }

  test('spent counts only free consumption; a block that has not started has null', () => {
    const view = planCycle(inProgress().deps);
    expect(view.weeks.map((w) => [w.start, w.cap_cents, w.spent_cents, w.status])).toEqual([
      ['2026-01-25', 55342, 30000, 'OK'], ['2026-02-01', 55342, 15000, 'OK'], ['2026-02-08', 55342, null, null], ['2026-02-15', 55342, null, null], ['2026-02-22', 23718, null, null],
    ]);
    expect(view.pace).toEqual({ per_week: [{ variance_cents: 25342 }, { variance_cents: 40342 }, { variance_cents: null }, { variance_cents: null }, { variance_cents: null }], cumulative_cents: 65684 });
  });

  test('a transfer row and a savings row are not consumption: they are in no week', () => {
    const w = inProgress();
    const before = planCycle(w.deps).weeks;
    w.spend('2026-01-26', '6000', 'savings');
    w.spend('2026-02-02', '4000', 'own-transfer');
    expect(planCycle(w.deps).weeks).toEqual(before);
  });

  test('a week over its cap has the status OVER', () => {
    const w = inProgress();
    w.spend('2026-01-30', '300', 'entertainment');
    expect(planCycle(w.deps).weeks[0]).toMatchObject({ spent_cents: 60000, status: 'OVER' });
  });

  test('the savings are the rows of the cycle with a category of the kind savings', () => {
    const w = inProgress();
    w.spend('2026-01-20', '6000', 'savings'); // the cycle before: not counted
    expect(planCycle(w.deps).savings).toMatchObject({ planned_cents: rand('6000'), moved_cents: 0, held: false });
    w.spend('2026-01-26', '2500', 'savings');
    expect(planCycle(w.deps).savings).toMatchObject({ moved_cents: rand('2500'), held: false });
    w.spend('2026-01-26', '3500', 'savings');
    expect(planCycle(w.deps).savings).toEqual({ planned_cents: rand('6000'), moved_cents: rand('6000'), held: true, text: 'R6 000.00 moved to savings. The plan was R6 000.00.' });
  });

  test('the headline does not say "on track" or "under budget" while the savings have not moved', () => {
    const w = inProgress();
    const none = planCycle(w.deps).headline;
    expect(none).toBe('Cycle 2026-01-25 to 2026-02-24: free spending is R450.00 of R2 451.00. The plan was R6 000.00 and no savings row is on record. Money that is under the caps is not saved until it moves.');
    w.spend('2026-01-26', '2500', 'savings');
    const part = planCycle(w.deps).headline;
    expect(part).toContain('R3 500.00 has not moved yet.');
    for (const text of [none, part]) expect(text).not.toMatch(/on track|under budget/i);
  });

  test('the headline says "on track" only when the savings moved and no week is over its cap', () => {
    const w = inProgress();
    w.spend('2026-01-26', '6000', 'savings');
    expect(planCycle(w.deps).savings?.held).toBe(true);
    expect(planCycle(w.deps).headline).toBe('Cycle 2026-01-25 to 2026-02-24: free spending is R450.00 of R2 451.00. The savings moved and no week is over its cap: the cycle is on track.');
    w.spend('2026-01-30', '300', 'entertainment');
    expect(planCycle(w.deps).headline).toBe('Cycle 2026-01-25 to 2026-02-24: free spending is R750.00 of R2 451.00. 1 week is over the weekly cap.');
  });

  test('the insights come from the same rows', () => {
    const w = inProgress();
    expect(planCycle(w.deps).insights.map((i) => i.id)).toEqual(['savings_not_moved']);
    w.spend('2026-01-26', '6000', 'savings');
    for (const day of ['2025-11-28', '2025-12-28', '2026-01-28']) w.spend(day, '199', 'entertainment', 'Streamhouse');
    expect(planCycle(w.deps).insights.map((i) => i.id)).toEqual(['recurring_charges:streamhouse:19900']);
  });

  test('weeksOfCycle gives only the weeks, the pace and the savings of the same view', () => {
    const { deps } = inProgress();
    const { cycle, weeks, pace, savings } = planCycle(deps);
    expect(weeksOfCycle(deps)).toEqual({ cycle, weeks, pace, savings });
  });
});

describe('what the service refuses', () => {
  const codeOf = (run: () => unknown) => {
    try {
      run();
      return 'NO ERROR';
    } catch (error) {
      return error instanceof AppError ? error.code : String(error);
    }
  };

  test('a date that is not a day of the calendar, and a store with no settings', () => {
    expect(codeOf(() => planCycle(world().deps, '2026-02-30'))).toBe('BAD_REQUEST');
    expect(codeOf(() => planCycle({ stores: memoryStores(), clock: fixedClock('2026-02-03') }))).toBe('NOT_FOUND');
  });

  test('an input with a problem gives no plan: the view has the problems', () => {
    const w = workedExample();
    w.stores.plan.setSettings({ ...w.stores.plan.getSettings()!, variable_living_cents: 6500.5 });
    const view = planCycle(w.deps);
    expect(view.plan).toBeNull();
    expect(view.input_problems).toEqual(['The variable living amount must be a whole number of cents.']);
    expect([view.weeks, view.savings, view.insights]).toEqual([[], null, []]);
    expect(view.headline).toBe('The plan of the cycle 2026-01-25 to 2026-02-24 cannot be made: the input has 1 problem.');
  });
});
