// The stores in SQLite, through the module node:sqlite that is part of Node.
// This file contains the SQL for expenses, categories and budgets. sqlite-plan.ts has the SQL of the plan and the income.
// No SQLite error goes out of this file. A failure becomes one of three errors of the application:
// DuplicateKey, StoreRejected (the data breaks a rule of the schema) or StorageUnavailable.
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { Budget, Category, Expense } from '../../shared/contracts.ts';
import { monthRange } from '../domain/budget.ts';
import { DuplicateKey, StorageUnavailable, StoreRejected } from '../errors.ts';
import { migrate } from './migrate.ts';
import type { Stores } from './ports.ts';
import { sqlitePlanStores } from './sqlite-plan.ts';

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
    if (/UNIQUE constraint failed: (expenses|income)\.idempotency_key/.test(text)) throw new DuplicateKey();
    if (/constraint failed|datatype mismatch|cannot store/i.test(text)) throw new StoreRejected(text);
    throw new StorageUnavailable(text);
  }
}

// The old column "kind" of categories holds 'EXPENSE' in each row. The kind and the class of the type are in two newer columns.
type CategoryRow = { id: string; name: string; active: number; entry_kind: Category['kind']; spend_class: Category['class'] };
const toCategory = (row: CategoryRow): Category => ({ id: row.id, name: row.name, active: row.active === 1, kind: row.entry_kind, class: row.spend_class });
const CATEGORY_COLUMNS = 'id, name, active, entry_kind, spend_class';
// The columns of the Expense type, in the order of the type.
const EXPENSE_COLUMNS = 'id, idempotency_key, occurred_on, amount_cents, currency, merchant_name, merchant_key, category_id, note, account, created_at';

export function sqliteStores(db: DatabaseSync): Stores {
  const all = <T>(sql: string, ...values: (string | number | null)[]) => guard(() => db.prepare(sql).all(...values).map((row) => ({ ...row }) as T));
  const one = <T>(sql: string, ...values: (string | number | null)[]) => guard(() => {
      const row = db.prepare(sql).get(...values);
      return row ? ({ ...row } as T) : null;
    });
  const run = (sql: string, ...values: (string | number | null)[]) => guard(() => void db.prepare(sql).run(...values));
  return {
    expenses: {
      findByKey: (key) => one<Expense>('SELECT ' + EXPENSE_COLUMNS + ' FROM expenses WHERE idempotency_key = ?', key),
      findSimilar: (occurred_on, amount_cents, merchant_key) =>
        all<{ id: string }>('SELECT id FROM expenses WHERE occurred_on = ? AND amount_cents = ? AND merchant_key = ? ORDER BY id', occurred_on, amount_cents, merchant_key).map((r) => r.id),
      insert: (e) =>
        run(
          'INSERT INTO expenses (' + EXPENSE_COLUMNS + ') VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          e.id, e.idempotency_key, e.occurred_on, e.amount_cents, e.currency, e.merchant_name, e.merchant_key, e.category_id, e.note, e.account, e.created_at,
        ),
      sumForCategory(category_id, period) {
        const { from, before } = monthRange(period);
        const row = one<{ total: number }>('SELECT COALESCE(SUM(amount_cents), 0) AS total FROM expenses WHERE category_id = ? AND occurred_on >= ? AND occurred_on < ?', category_id, from, before);
        return row?.total ?? 0;
      },
      listRecent(period, limit) {
        const { from, before } = monthRange(period);
        return all<Expense>('SELECT ' + EXPENSE_COLUMNS + ' FROM expenses WHERE occurred_on >= ? AND occurred_on < ? ORDER BY occurred_on DESC, created_at DESC, id DESC LIMIT ?', from, before, limit);
      },
      listBetween: (from, toInclusive) =>
        all<Expense>('SELECT ' + EXPENSE_COLUMNS + ' FROM expenses WHERE occurred_on >= ? AND occurred_on <= ? ORDER BY occurred_on, created_at, id', from, toInclusive),
    },
    categories: {
      get(id) {
        const row = one<CategoryRow>('SELECT ' + CATEGORY_COLUMNS + ' FROM categories WHERE id = ?', id);
        return row ? toCategory(row) : null;
      },
      list: () => all<CategoryRow>('SELECT ' + CATEGORY_COLUMNS + ' FROM categories ORDER BY name').map(toCategory),
      upsert: (c) =>
        run(
          "INSERT INTO categories (id, name, kind, active, entry_kind, spend_class) VALUES (?, ?, 'EXPENSE', ?, ?, ?) ON CONFLICT (id) DO UPDATE SET name = excluded.name, active = excluded.active, entry_kind = excluded.entry_kind, spend_class = excluded.spend_class",
          c.id, c.name, c.active ? 1 : 0, c.kind, c.class,
        ),
    },
    budgets: {
      find: (category_id, period) => one<Budget>('SELECT * FROM budgets WHERE category_id = ? AND period = ?', category_id, period),
      upsert: (b) =>
        run(
          'INSERT INTO budgets (id, category_id, period, limit_cents, currency) VALUES (?, ?, ?, ?, ?) ON CONFLICT (category_id, period) DO UPDATE SET limit_cents = excluded.limit_cents',
          b.id, b.category_id, b.period, b.limit_cents, b.currency,
        ),
    },
    ...sqlitePlanStores({ all, one, run }),
  };
}
