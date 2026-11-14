// The verifier, tested by sabotage. Each test breaks the ledger in one way and the verifier must give FAIL.
// A verifier that only ever saw correct data is not tested.
import { expect, test } from 'vitest';
import type { Expense } from '../../shared/contracts.ts';
import { budgetStatus } from '../domain/budget.ts';
import { toProposal } from '../domain/expense.ts';
import { seed } from '../repositories/seed.ts';
import { openDatabase, sqliteStores } from '../repositories/sqlite.ts';
import { sqliteLedgerReader, verifyRecorded } from './verifier.ts';

const proposal = toProposal({ idempotency_key: 'key-0001', amount_cents: 18500, currency: 'ZAR', occurred_on: '2026-03-31', merchant_name: 'Woolworths', category_id: 'groceries' });
const expense: Expense = { ...proposal, id: 'exp_1', idempotency_key: 'key-0001', note: null, created_at: '2026-03-31T10:00:00.000Z' };
const reported = budgetStatus('groceries', '2026-03', 450_000, 18500);

function world() {
  const db = openDatabase(':memory:');
  const stores = sqliteStores(db);
  seed(stores, '2026-03');
  return { db, stores, ledger: sqliteLedgerReader(db) };
}
const rules = (v: { problems: { rule: string }[] }) => v.problems.map((p) => p.rule);

test('a correct ledger is PASS, also on the last day of the month', () => {
  const { stores, ledger } = world();
  stores.expenses.insert(expense);
  expect(verifyRecorded(ledger, 'key-0001', expense, proposal, reported)).toEqual({ ok: true, problems: [] });
});

test('sabotage: no row was saved', () => {
  const { ledger } = world();
  expect(rules(verifyRecorded(ledger, 'key-0001', expense, proposal, reported))).toEqual(['R8', 'R10']);
});

test('sabotage: the row has a different amount', () => {
  const { stores, ledger } = world();
  stores.expenses.insert({ ...expense, amount_cents: 18600 });
  expect(rules(verifyRecorded(ledger, 'key-0001', expense, proposal, reported))).toEqual(['R8', 'R10']);
});

test('sabotage: the row went into a different month', () => {
  const { stores, ledger } = world();
  stores.expenses.insert({ ...expense, occurred_on: '2026-04-01' });
  const result = verifyRecorded(ledger, 'key-0001', expense, proposal, reported);
  expect(rules(result)).toEqual(['R8', 'R10']);
  expect(result.problems[0]!.text).toContain('occurred_on');
});

test('sabotage: a second row for the same expense, without the UNIQUE rule of the schema', () => {
  const { db, stores, ledger } = world();
  stores.expenses.insert(expense);
  db.exec('DROP INDEX IF EXISTS expenses_by_category_date');
  db.exec('CREATE TABLE copy AS SELECT * FROM expenses');
  db.exec('DROP TABLE expenses');
  db.exec('ALTER TABLE copy RENAME TO expenses'); // the copy has no UNIQUE constraint
  db.exec("INSERT INTO expenses SELECT 'exp_2', idempotency_key, occurred_on, amount_cents, currency, merchant_name, merchant_key, category_id, note, created_at FROM expenses");
  const result = verifyRecorded(ledger, 'key-0001', expense, proposal, reported);
  expect(result.problems[0]!.text).toContain('2 rows');
  expect(rules(result)).toContain('R10');
});

test('sabotage: the graph reports a wrong spent amount', () => {
  const { stores, ledger } = world();
  stores.expenses.insert(expense);
  expect(rules(verifyRecorded(ledger, 'key-0001', expense, proposal, { ...reported, spent_cents: 1 }))).toEqual(['R10']);
});

test('the verifier has no method that writes', () => {
  expect(Object.keys(world().ledger).sort()).toEqual(['amountsInMonth', 'rowsForKey']);
});
