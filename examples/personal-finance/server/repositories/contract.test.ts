// One suite, two implementations. If the stores in memory and the stores in SQLite both pass,
// a test that uses the stores in memory tells the truth about the application.
import { describe, expect, test } from 'vitest';
import type { Expense } from '../../shared/contracts.ts';
import { DuplicateKey } from '../errors.ts';
import { memoryStores } from './memory.ts';
import type { Stores } from './ports.ts';
import { seed } from './seed.ts';
import { openDatabase, sqliteStores } from './sqlite.ts';

const expense = (n: number, over: Partial<Expense> = {}): Expense => ({
  id: 'exp_' + n, idempotency_key: 'key-000' + n, occurred_on: '2026-03-14', amount_cents: 18500, currency: 'ZAR',
  merchant_name: 'Woolworths', merchant_key: 'woolworths', category_id: 'groceries', note: null, account: 'main', created_at: '2026-03-14T10:00:0' + n + '.000Z', ...over,
});

const implementations: Array<[string, () => Stores]> = [
  ['memory', () => memoryStores()],
  ['sqlite', () => sqliteStores(openDatabase(':memory:'))],
];

describe.each(implementations)('the stores: %s', (_name, make) => {
  const fresh = () => {
    const stores = make();
    seed(stores, '2026-03');
    return stores;
  };

  test('the seed gives categories and budgets, and a second seed changes nothing', () => {
    const stores = fresh();
    seed(stores, '2026-03');
    expect(stores.categories.get('groceries')).toEqual({ id: 'groceries', name: 'Groceries', active: true, kind: 'consumption', class: 'variable' });
    expect(stores.categories.get('gym')?.active).toBe(false);
    expect(stores.budgets.find('groceries', '2026-03')?.limit_cents).toBe(450_000);
    expect(stores.budgets.find('entertainment', '2026-03')).toBeNull();
  });

  test('an expense that goes in comes out the same', () => {
    const stores = fresh();
    stores.expenses.insert(expense(1, { note: 'milk', account: 'northbank-current' }));
    expect(stores.expenses.findByKey('key-0001')).toEqual(expense(1, { note: 'milk', account: 'northbank-current' }));
    expect(stores.expenses.listBetween('2026-03-14', '2026-03-14')[0]!.account).toBe('northbank-current');
    expect(stores.expenses.findByKey('key-9999')).toBeNull();
  });

  test('R8: a second insert with the same request key is refused', () => {
    const stores = fresh();
    stores.expenses.insert(expense(1));
    expect(() => stores.expenses.insert(expense(2, { idempotency_key: 'key-0001' }))).toThrow(DuplicateKey);
  });

  test('R10: spent is the sum of the expenses of the category in the month', () => {
    const stores = fresh();
    stores.expenses.insert(expense(1, { occurred_on: '2026-03-01' }));
    stores.expenses.insert(expense(2, { occurred_on: '2026-03-31', amount_cents: 500 }));
    stores.expenses.insert(expense(3, { occurred_on: '2026-04-01' })); // the subsequent month
    stores.expenses.insert(expense(4, { occurred_on: '2026-02-28' })); // the month before
    stores.expenses.insert(expense(5, { category_id: 'transport' })); // a different category
    expect(stores.expenses.sumForCategory('groceries', '2026-03')).toBe(19000);
    expect(stores.expenses.sumForCategory('health', '2026-03')).toBe(0);
  });

  test('similar expenses: the same date, amount and merchant', () => {
    const stores = fresh();
    stores.expenses.insert(expense(1));
    stores.expenses.insert(expense(2, { amount_cents: 100 }));
    expect(stores.expenses.findSimilar('2026-03-14', 18500, 'woolworths')).toEqual(['exp_1']);
  });

  test('the last expenses of a month, the newest first', () => {
    const stores = fresh();
    stores.expenses.insert(expense(1, { occurred_on: '2026-03-10' }));
    stores.expenses.insert(expense(2, { occurred_on: '2026-03-12' }));
    stores.expenses.insert(expense(3, { occurred_on: '2026-03-12' }));
    expect(stores.expenses.listRecent('2026-03', 2).map((e) => e.id)).toEqual(['exp_3', 'exp_2']);
  });
});
