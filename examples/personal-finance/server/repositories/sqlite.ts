// The stores in SQLite, through the module node:sqlite that is part of Node.
// This is the only file that contains SQL for the three tables of level 1.
// Each failure of the database becomes StorageUnavailable, thus no SQLite error goes out of this file.
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { Budget, Category, Expense } from '../../shared/contracts.ts';
import { monthRange } from '../domain/budget.ts';
import { DuplicateKey, StorageUnavailable } from '../errors.ts';
import { migrate } from './migrate.ts';
import type { Stores } from './ports.ts';

export function openDatabase(file: string): DatabaseSync {
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  migrate(db);
  return db;
}

/** Runs one database operation. A failure becomes an error of the application. */
function guard<T>(operation: () => T): T {
  try {
    return operation();
  } catch (error) {
    const text = error instanceof Error ? error.message : String(error);
    if (/UNIQUE constraint failed: expenses\.idempotency_key/.test(text)) throw new DuplicateKey();
    throw new StorageUnavailable(text);
  }
}

type CategoryRow = { id: string; name: string; active: number };
const toCategory = (row: CategoryRow): Category => ({ id: row.id, name: row.name, active: row.active === 1 });

export function sqliteStores(db: DatabaseSync): Stores {
  const all = <T>(sql: string, ...values: (string | number | null)[]) => guard(() => db.prepare(sql).all(...values).map((row) => ({ ...row }) as T));
  const one = <T>(sql: string, ...values: (string | number | null)[]) => guard(() => {
      const row = db.prepare(sql).get(...values);
      return row ? ({ ...row } as T) : null;
    });
  const run = (sql: string, ...values: (string | number | null)[]) => guard(() => void db.prepare(sql).run(...values));
  return {
    expenses: {
      findByKey: (key) => one<Expense>('SELECT * FROM expenses WHERE idempotency_key = ?', key),
      findSimilar: (occurred_on, amount_cents, merchant_key) =>
        all<{ id: string }>('SELECT id FROM expenses WHERE occurred_on = ? AND amount_cents = ? AND merchant_key = ? ORDER BY id', occurred_on, amount_cents, merchant_key).map((r) => r.id),
      insert: (e) =>
        run(
          'INSERT INTO expenses (id, idempotency_key, occurred_on, amount_cents, currency, merchant_name, merchant_key, category_id, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          e.id, e.idempotency_key, e.occurred_on, e.amount_cents, e.currency, e.merchant_name, e.merchant_key, e.category_id, e.note, e.created_at,
        ),
      sumForCategory(category_id, period) {
        const { from, before } = monthRange(period);
        const row = one<{ total: number }>('SELECT COALESCE(SUM(amount_cents), 0) AS total FROM expenses WHERE category_id = ? AND occurred_on >= ? AND occurred_on < ?', category_id, from, before);
        return row?.total ?? 0;
      },
      listRecent(period, limit) {
        const { from, before } = monthRange(period);
        return all<Expense>('SELECT * FROM expenses WHERE occurred_on >= ? AND occurred_on < ? ORDER BY occurred_on DESC, created_at DESC, id DESC LIMIT ?', from, before, limit);
      },
    },
    categories: {
      get(id) {
        const row = one<CategoryRow>('SELECT id, name, active FROM categories WHERE id = ?', id);
        return row ? toCategory(row) : null;
      },
      list: () => all<CategoryRow>('SELECT id, name, active FROM categories ORDER BY name').map(toCategory),
      upsert: (c) =>
        run("INSERT INTO categories (id, name, kind, active) VALUES (?, ?, 'EXPENSE', ?) ON CONFLICT (id) DO UPDATE SET name = excluded.name, active = excluded.active", c.id, c.name, c.active ? 1 : 0),
    },
    budgets: {
      find: (category_id, period) => one<Budget>('SELECT * FROM budgets WHERE category_id = ? AND period = ?', category_id, period),
      upsert: (b) =>
        run(
          'INSERT INTO budgets (id, category_id, period, limit_cents, currency) VALUES (?, ?, ?, ?, ?) ON CONFLICT (category_id, period) DO UPDATE SET limit_cents = excluded.limit_cents',
          b.id, b.category_id, b.period, b.limit_cents, b.currency,
        ),
    },
  };
}
