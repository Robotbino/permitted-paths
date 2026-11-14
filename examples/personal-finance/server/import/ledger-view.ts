// What an import reads from the ledger, as three small functions. The ledger is the expense store
// and the income store together. These functions only read: an import writes through its workers.
import type { LedgerEntry } from '../../shared/export/paste-rows.ts';
import type { OtherAccountRow } from '../../shared/pipeline/reconcile.ts';
import type { Stores } from '../repositories/ports.ts';

export type LedgerView = {
  inLedger(key: string): boolean;
  otherAccountRows(account: string, from: string, toInclusive: string): OtherAccountRow[];
  entryForKey(key: string): LedgerEntry | null;
};

export function ledgerView(stores: Stores): LedgerView {
  return {
    inLedger: (key) => stores.expenses.findByKey(key) !== null || stores.income.findByKey(key) !== null,

    // The other side of a possible transfer. The ledger does not store the fingerprint of a row,
    // thus the request key of the row stands for it.
    // Limit: the ledger does not store which row has a partner already. A row can pair again with a later file.
    otherAccountRows(account, from, toInclusive) {
      const out = stores.expenses.listBetween(from, toInclusive).map((e) => ({ account: e.account, occurred_on: e.occurred_on, amount_cents: e.amount_cents, direction: 'out' as const, fingerprint: e.idempotency_key }));
      const into = stores.income.listBetween(from, toInclusive).map((i) => ({ account: i.account, occurred_on: i.occurred_on, amount_cents: i.amount_cents, direction: 'in' as const, fingerprint: i.idempotency_key }));
      return [...out, ...into].filter((row) => row.account !== account);
    },

    // The kind of an expense is the kind of its category: money that is used, a move to savings, or a move between own accounts.
    entryForKey(key) {
      const expense = stores.expenses.findByKey(key);
      if (expense) {
        const category = stores.categories.get(expense.category_id);
        return { occurred_on: expense.occurred_on, description: expense.merchant_name, amount_cents: expense.amount_cents, category_name: category?.name ?? expense.category_id, note: expense.note ?? '', kind: category?.kind ?? 'consumption' };
      }
      const income = stores.income.findByKey(key);
      return income ? { occurred_on: income.occurred_on, description: income.source, amount_cents: income.amount_cents, category_name: '', note: '', kind: 'income' } : null;
    },
  };
}
