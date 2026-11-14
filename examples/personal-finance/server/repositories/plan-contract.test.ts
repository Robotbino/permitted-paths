// One suite, two implementations, for the stores of planning: the plan store, the income store,
// the kind and class of a category, and the expenses between two dates.
// If memory and SQLite both pass, a test of the plan service with the stores in memory tells the truth.
import { describe, expect, test } from 'vitest';
import type { Expense } from '../../shared/contracts.ts';
import type { Income, PlanSettings, StoredCommitment } from '../../shared/contracts.plan.ts';
import { CARD, MAIN, example } from '../../shared/planning/plan-example.ts';
import { DuplicateKey } from '../errors.ts';
import { memoryStores } from './memory.ts';
import type { Stores } from './ports.ts';
import { seed } from './seed.ts';
import { openDatabase, sqliteStores } from './sqlite.ts';

const expense = (n: number, over: Partial<Expense> = {}): Expense => ({
  id: 'exp_' + n, idempotency_key: 'key-000' + n, occurred_on: '2026-03-14', amount_cents: 18500, currency: 'ZAR',
  merchant_name: 'Woolworths', merchant_key: 'woolworths', category_id: 'groceries', note: null, account: 'main', created_at: '2026-03-14T10:00:0' + n + '.000Z', ...over,
});
const income = (n: number, over: Partial<Income> = {}): Income => ({
  id: 'inc_' + n, idempotency_key: 'pay-000' + n, occurred_on: '2026-01-25', amount_cents: 3_200_000, source: 'Salary', account: MAIN, created_at: '2026-01-25T06:00:0' + n + '.000Z', ...over,
});
const settings: PlanSettings = { payday: 1, variable_living_cents: 100, savings_request_cents: 200, card_account: null, buffer_items: [] };
const commitment: StoredCommitment = { id: 'water', name: 'Water', amount_cents: 30_000, due_day: 7, account: MAIN, pay_to_person: false, active: true };

const implementations: Array<[string, () => Stores]> = [
  ['memory', () => memoryStores()],
  ['sqlite', () => sqliteStores(openDatabase(':memory:'))],
];

describe.each(implementations)('the stores of planning: %s', (_name, make) => {
  const fresh = () => {
    const stores = make();
    seed(stores, '2026-03');
    return stores;
  };

  test('a category has a kind and a class, and an upsert changes them', () => {
    const stores = fresh();
    expect(stores.categories.get('utilities')).toMatchObject({ kind: 'consumption', class: 'fixed' });
    expect(stores.categories.get('eating-out')).toMatchObject({ kind: 'consumption', class: 'free' });
    expect(stores.categories.get('savings')).toMatchObject({ kind: 'savings', active: true });
    expect(stores.categories.get('own-transfer')).toMatchObject({ kind: 'transfer', active: true });
    stores.categories.upsert({ id: 'health', name: 'Health', active: true, kind: 'consumption', class: 'fixed' });
    expect(stores.categories.list().find((c) => c.id === 'health')).toEqual({ id: 'health', name: 'Health', active: true, kind: 'consumption', class: 'fixed' });
  });

  test('with no settings on record the answer is null', () => {
    const stores = make();
    expect(stores.plan.getSettings()).toBeNull();
    expect(stores.plan.listCommitments()).toEqual([]);
    expect(stores.plan.listPots()).toEqual([]);
  });

  test('the seed gives the plan of the worked example, with a day of the month for each commitment', () => {
    const stores = fresh();
    const sam = example();
    expect(stores.plan.getSettings()).toEqual({ payday: 25, variable_living_cents: 650_000, savings_request_cents: 700_000, card_account: CARD, buffer_items: sam.buffer_items });
    expect(stores.plan.listCommitments().map((c) => [c.id, c.due_day, c.amount_cents, c.pay_to_person, c.active])).toEqual([
      ['rent', 1, 950_000, true, true], ['medical', 1, 210_000, false, true], ['phone', 28, 45_000, false, true],
      ['insurance', 2, 85_000, false, true], ['stream', 5, 19_900, false, true], ['gym', 10, 55_000, false, true],
    ]);
    expect(stores.plan.listCommitments().find((c) => c.id === 'stream')?.account).toBe(CARD);
    expect(stores.plan.listPots()).toEqual(sam.pots.map((pot) => ({ ...pot, active: true })));
  });

  test('the seed does not replace settings that are on record', () => {
    const stores = make();
    stores.plan.setSettings(settings);
    seed(stores, '2026-03');
    expect(stores.plan.getSettings()).toEqual(settings);
    expect(stores.plan.listCommitments()).toEqual([]);
  });

  test('the settings are one row: a second set replaces the first', () => {
    const stores = fresh();
    stores.plan.setSettings({ ...settings, card_account: CARD, buffer_items: [{ name: 'Car service', amount_cents: 120_000 }] });
    stores.plan.setSettings(settings);
    expect(stores.plan.getSettings()).toEqual(settings);
  });

  test('an upsert of a commitment or a pot changes the item and keeps its position in the list', () => {
    const stores = fresh();
    stores.plan.upsertCommitment(commitment);
    stores.plan.upsertCommitment({ ...commitment, id: 'rent', name: 'Rent', amount_cents: 990_000, due_day: 1, pay_to_person: true });
    stores.plan.upsertCommitment({ ...commitment, active: false });
    const list = stores.plan.listCommitments();
    expect(list.map((c) => c.id)).toEqual(['rent', 'medical', 'phone', 'insurance', 'stream', 'gym', 'water']);
    expect(list[0]).toEqual({ id: 'rent', name: 'Rent', amount_cents: 990_000, due_day: 1, account: MAIN, pay_to_person: true, active: true });
    expect(list[6]).toEqual({ ...commitment, active: false });

    stores.plan.upsertPot({ id: 'laptop', name: 'New laptop', priority: 4, target_cents: 0, active: false });
    expect(stores.plan.listPots().map((p) => [p.id, p.priority, p.target_cents, p.active])).toEqual([['laptop', 4, 0, false], ['emergency', 1, 300_000, true], ['holiday', 2, 200_000, true]]);
  });

  test('an income row that goes in comes out the same', () => {
    const stores = fresh();
    stores.income.insert(income(1));
    expect(stores.income.findByKey('pay-0001')).toEqual(income(1));
    expect(stores.income.findByKey('pay-9999')).toBeNull();
  });

  test('a second income row with the same request key is refused', () => {
    const stores = fresh();
    stores.income.insert(income(1));
    expect(() => stores.income.insert(income(2, { idempotency_key: 'pay-0001' }))).toThrow(DuplicateKey);
    expect(stores.income.sumBetween('2026-01-01', '2026-12-31')).toBe(3_200_000);
  });

  test('income between two dates: the two dates are included, and the oldest row is first', () => {
    const stores = fresh();
    stores.income.insert(income(1, { occurred_on: '2026-02-24', amount_cents: 500 }));
    stores.income.insert(income(2, { occurred_on: '2026-01-25' }));
    stores.income.insert(income(3, { occurred_on: '2026-01-25', amount_cents: 70 }));
    stores.income.insert(income(4, { occurred_on: '2026-01-24' })); // the day before
    stores.income.insert(income(5, { occurred_on: '2026-02-25' })); // the day after
    expect(stores.income.listBetween('2026-01-25', '2026-02-24').map((i) => i.id)).toEqual(['inc_2', 'inc_3', 'inc_1']);
    expect(stores.income.sumBetween('2026-01-25', '2026-02-24')).toBe(3_200_570);
    expect(stores.income.sumBetween('2027-01-01', '2027-01-31')).toBe(0);
    expect(stores.income.listBetween('2027-01-01', '2027-01-31')).toEqual([]);
  });

  test('expenses between two dates: the two dates are included, and the oldest row is first', () => {
    const stores = fresh();
    stores.expenses.insert(expense(1, { occurred_on: '2026-03-24' }));
    stores.expenses.insert(expense(2, { occurred_on: '2026-02-25' }));
    stores.expenses.insert(expense(3, { occurred_on: '2026-02-25', category_id: 'transport' }));
    stores.expenses.insert(expense(4, { occurred_on: '2026-02-24' })); // the day before
    stores.expenses.insert(expense(5, { occurred_on: '2026-03-25' })); // the day after
    expect(stores.expenses.listBetween('2026-02-25', '2026-03-24').map((e) => e.id)).toEqual(['exp_2', 'exp_3', 'exp_1']);
    expect(stores.expenses.listBetween('2026-02-25', '2026-03-24')[2]).toEqual(expense(1, { occurred_on: '2026-03-24' }));
    expect(stores.expenses.listBetween('2027-01-01', '2027-01-31')).toEqual([]);
  });
});
