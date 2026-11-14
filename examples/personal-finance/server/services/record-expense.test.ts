// The service with the stores in memory. These tests say what "record an expense" means.
// They do not know how the service is made, thus they stay the same when its inner structure changes.
import { expect, test } from 'vitest';
import { fixedClock, sequentialIds } from '../clock.ts';
import { AppError, StorageUnavailable } from '../errors.ts';
import { memoryStores } from '../repositories/memory.ts';
import { seed } from '../repositories/seed.ts';
import { recordExpense, type RecordExpenseDeps } from './record-expense.ts';

const request = { idempotency_key: 'key-0001', amount_cents: 18500, currency: 'ZAR', occurred_on: '2026-03-14', merchant_name: 'Woolworths', category_id: 'groceries' };

function setup(): RecordExpenseDeps {
  const stores = memoryStores();
  seed(stores, '2026-03');
  return { stores, clock: fixedClock('2026-03-14'), ids: sequentialIds() };
}
const codeOf = async (promise: Promise<unknown>) => {
  try {
    await promise;
    return 'NO ERROR';
  } catch (error) {
    return error instanceof AppError ? error.code + ' ' + error.problems.map((p) => p.rule).join(',') : String(error);
  }
};

test('a correct expense is saved and the budget shows it', async () => {
  const deps = setup();
  const result = await recordExpense(deps, request);
  expect(result.replayed).toBe(false);
  expect(result.expense).toMatchObject({ id: 'exp_0001', amount_cents: 18500, merchant_key: 'woolworths', category_id: 'groceries' });
  expect(result.budget).toEqual({ category_id: 'groceries', period: '2026-03', state: 'WITHIN', limit_cents: 450_000, spent_cents: 18500, remaining_cents: 431_500 });
});

test('the budget of the month of the expense changes, not the budget of today', async () => {
  const deps = setup();
  const result = await recordExpense(deps, { ...request, occurred_on: '2026-02-27' });
  expect(result.budget.period).toBe('2026-02');
  expect(result.budget.state).toBe('NO_BUDGET'); // the seed made budgets only for March
});

test('over budget is a result, not an error: the expense is saved', async () => {
  const deps = setup();
  const result = await recordExpense(deps, { ...request, amount_cents: 460_000 });
  expect(result.budget.state).toBe('OVER');
  expect(result.budget.remaining_cents).toBe(-10_000);
  expect(deps.stores.expenses.findByKey('key-0001')).not.toBeNull();
});

test('a wrong shape is refused and nothing is saved', async () => {
  const deps = setup();
  expect(await codeOf(recordExpense(deps, { ...request, amount_cents: 185.5 }))).toBe('SHAPE R1');
  expect(deps.stores.expenses.sumForCategory('groceries', '2026-03')).toBe(0);
});

test('a rule problem is refused and nothing is saved', async () => {
  const deps = setup();
  expect(await codeOf(recordExpense(deps, { ...request, category_id: 'gym' }))).toBe('RULE R6');
  expect(await codeOf(recordExpense(deps, { ...request, occurred_on: '2026-03-15' }))).toBe('RULE R5');
  expect(deps.stores.expenses.listRecent('2026-03', 10)).toEqual([]);
});

test('the same request two times records one expense', async () => {
  const deps = setup();
  const first = await recordExpense(deps, request);
  const second = await recordExpense(deps, request);
  expect(second.replayed).toBe(true);
  expect(second.expense).toEqual(first.expense);
  expect(second.budget.spent_cents).toBe(18500);
});

test('the same request key with a different body is a conflict', async () => {
  const deps = setup();
  await recordExpense(deps, request);
  expect(await codeOf(recordExpense(deps, { ...request, amount_cents: 999 }))).toBe('KEY_CONFLICT R8');
});

test('a similar expense needs a confirmation; with the confirmation it is saved', async () => {
  const deps = setup();
  await recordExpense(deps, request);
  const again = { ...request, idempotency_key: 'key-0002' };
  expect(await codeOf(recordExpense(deps, again))).toBe('NEEDS_CONFIRMATION R7');
  const result = await recordExpense(deps, { ...again, confirm_duplicate: true });
  expect(result.budget.spent_cents).toBe(37000);
});

test('when the store fails during the save, the error goes up and nothing is saved', async () => {
  const deps = setup();
  deps.stores.expenses.insert = () => {
    throw new StorageUnavailable('disk');
  };
  await expect(recordExpense(deps, request)).rejects.toBeInstanceOf(StorageUnavailable);
  expect(deps.stores.expenses.findByKey('key-0001')).toBeNull();
});
