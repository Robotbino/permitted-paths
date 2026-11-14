import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import type { Expense } from '../../shared/contracts.ts';
import { StorageUnavailable, StoreRejected } from '../errors.ts';
import { migrate } from './migrate.ts';
import { seed } from './seed.ts';
import { openDatabase, sqliteStores } from './sqlite.ts';

const expense: Expense = {
  id: 'exp_1', idempotency_key: 'key-0001', occurred_on: '2026-03-14', amount_cents: 18500, currency: 'ZAR',
  merchant_name: 'Woolworths', merchant_key: 'woolworths', category_id: 'groceries', note: null, created_at: '2026-03-14T10:00:00.000Z',
};

test('the data stays after the database closes and opens again', () => {
  const dir = mkdtempSync(join(tmpdir(), 'studio-'));
  const file = join(dir, 'finance.sqlite');
  try {
    const first = openDatabase(file);
    seed(sqliteStores(first), '2026-03');
    sqliteStores(first).expenses.insert(expense);
    first.close();

    const second = openDatabase(file);
    expect(migrate(second)).toBe(0); // the schema is already at the last version
    expect(sqliteStores(second).expenses.sumForCategory('groceries', '2026-03')).toBe(18500);
    second.close(); // close before the folder is removed: Windows locks an open file
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the database is the last line of defence: it refuses data that breaks a rule', () => {
  const db = openDatabase(':memory:');
  const stores = sqliteStores(db);
  seed(stores, '2026-03');
  // StoreRejected, not StorageUnavailable: a second attempt cannot succeed, thus the graph must not try again.
  expect(() => stores.expenses.insert({ ...expense, amount_cents: 0 })).toThrow(StoreRejected); // CHECK (amount_cents > 0)
  expect(() => stores.expenses.insert({ ...expense, category_id: 'no-such-category' })).toThrow(StoreRejected); // foreign key
  db.close();
});

test('a closed database gives StorageUnavailable, not an error of SQLite', () => {
  const db = openDatabase(':memory:');
  const stores = sqliteStores(db);
  db.close();
  expect(() => stores.categories.list()).toThrow(StorageUnavailable);
});
