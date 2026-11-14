// The independent verifier. After the save, it reads the ledger again, through its own port
// and with its own queries, and compares what is stored with what the graph says.
// "Independent" has a technical sense here: it shares no code with the path that it checks.
// It does not call sumForCategory and it does not call monthRange. It reads the raw rows and adds them.
import type { DatabaseSync } from 'node:sqlite';
import type { BudgetStatus, Expense, Problem } from '../../shared/contracts.ts';
import type { Income } from '../../shared/contracts.plan.ts';
import type { ExpenseProposal } from '../domain/expense.ts';
import { StorageUnavailable } from '../errors.ts';
import type { Stores } from '../repositories/ports.ts';

/** A read-only view of the ledger. It has no method that writes. */
export interface LedgerReader {
  rowsForKey(idempotency_key: string): Expense[];
  amountsInMonth(category_id: string, period: string): number[];
  /** The income rows of one request key. The reconciler of an import uses it. */
  incomeRowsForKey(idempotency_key: string): Income[];
}

/** The last day of a month, by the calendar: day 0 of the subsequent month. */
function lastDay(period: string): string {
  const days = new Date(Date.UTC(Number(period.slice(0, 4)), Number(period.slice(5, 7)), 0)).getUTCDate();
  return period + '-' + String(days).padStart(2, '0');
}

export function sqliteLedgerReader(db: DatabaseSync): LedgerReader {
  const guard = <T>(read: () => T): T => {
    try {
      return read();
    } catch (error) {
      throw new StorageUnavailable(error instanceof Error ? error.message : String(error));
    }
  };
  return {
    rowsForKey: (key) => guard(() => db.prepare('SELECT * FROM expenses WHERE idempotency_key = ?').all(key).map((row) => ({ ...row }) as Expense)),
    amountsInMonth: (category_id, period) =>
      guard(() =>
        db.prepare('SELECT amount_cents FROM expenses WHERE category_id = ? AND occurred_on BETWEEN ? AND ?').all(category_id, period + '-01', lastDay(period)).map((row) => Number(row.amount_cents)),
      ),
    incomeRowsForKey: (key) => guard(() => db.prepare('SELECT * FROM income WHERE idempotency_key = ?').all(key).map((row) => ({ ...row }) as Income)),
  };
}

/** For the stores in memory (tests). It can only see what the store interface shows, thus it is a weaker check. */
export function ledgerReaderFromStores(stores: Stores): LedgerReader {
  return {
    rowsForKey(key) {
      const row = stores.expenses.findByKey(key);
      return row ? [row] : [];
    },
    amountsInMonth: (category_id, period) => stores.expenses.listRecent(period, 100_000).filter((e) => e.category_id === category_id).map((e) => e.amount_cents),
    incomeRowsForKey(key) {
      const row = stores.income.findByKey(key);
      return row ? [row] : [];
    },
  };
}

export type Verification = { ok: boolean; problems: Problem[] };

export function verifyRecorded(ledger: LedgerReader, idempotency_key: string, expense: Expense, proposal: ExpenseProposal, budget_after: BudgetStatus): Verification {
  const problems: Problem[] = [];
  const rows = ledger.rowsForKey(idempotency_key);
  if (rows.length !== 1) {
    problems.push({ rule: 'R8', text: 'The ledger has ' + rows.length + ' rows for this request key. It must have exactly 1.' });
  }
  const row = rows[0];
  if (row) {
    const differences: string[] = (['occurred_on', 'amount_cents', 'currency', 'merchant_key', 'category_id'] as const).filter((field) => row[field] !== proposal[field]);
    if (row.id !== expense.id) differences.push('id');
    if (differences.length > 0) problems.push({ rule: 'R8', text: 'The stored row is not the proposal. Different fields: ' + differences.join(', ') + '.' });
  }
  const sum = ledger.amountsInMonth(budget_after.category_id, budget_after.period).reduce((total, cents) => total + cents, 0);
  if (sum !== budget_after.spent_cents) {
    problems.push({ rule: 'R10', text: 'The graph reports ' + budget_after.spent_cents + ' cents spent. The ledger adds up to ' + sum + ' cents.' });
  }
  return { ok: problems.length === 0, problems };
}
