// The workers of an import, and the store of its checkpoints.
// A worker does the work for one item and gives back a value. It does not decide what happens next;
// the orchestrator (import.graph.ts) does. Two workers run an existing graph as a sub-run:
//   suggestWorker -> the suggest graph of level 3 (memory, model, suggestion gate)
//   recordWorker  -> the record graph of level 2 (gates, commit, verifier, memory)
// Thus an imported expense passes each gate that an expense from the form passes.
//   incomeWorker  -> one income row. Income has no category and no budget, thus it needs no graph.
import type { DatabaseSync } from 'node:sqlite';
import type { LineOutcome, LineSuggestion } from '../../shared/contracts.import.ts';
import { MAX_CENTS } from '../../shared/money.ts';
import type { ReconciledRow } from '../../shared/pipeline/reconcile.ts';
import type { Clock, IdGen } from '../clock.ts';
import { AppError, DuplicateKey, StorageUnavailable } from '../errors.ts';
import { suggestCategory, type SuggestDeps } from '../intelligence/suggest-category.graph.ts';
import type { IncomeStore } from '../repositories/ports.ts';
import { recordExpense, type RecordExpenseDeps } from '../services/record-expense.ts';
import type { ImportBatch, ImportStore } from './import-state.ts';

export type { ImportBatch, ImportStore } from './import-state.ts';

const end = (row: ReconciledRow, e: LineOutcome['end'], detail: string, ids: { expense_id?: string; income_id?: string } = {}): LineOutcome => ({ line_no: row.line_no, end: e, expense_id: ids.expense_id ?? null, income_id: ids.income_id ?? null, detail });
const LATER = 'The store did not answer. Import the statement again later; a line is never recorded two times.';

/** One suggest sub-run for one merchant. `withModel: false`: the orchestrator gave this merchant no model call. */
export async function suggestWorker(deps: SuggestDeps, merchant_name: string, withModel: boolean, parent_run_id: string): Promise<{ suggestion: LineSuggestion; reason: string }> {
  try {
    const response = await suggestCategory({ ...deps, suggester: withModel ? deps.suggester : undefined, preapproved: withModel, parent_run_id }, { merchant_name });
    return { suggestion: response.suggestion ? { ...response.suggestion, run_id: response.run_id } : null, reason: response.reason };
  } catch {
    return { suggestion: null, reason: 'WORKER_FAILED' }; // a failed worker is "no suggestion" for its merchant only
  }
}

/**
 * One record sub-run for one row with money out. Each expected error (a rule that fails, a store that
 * does not answer) becomes the end of this line; the other lines continue. A defect is thrown again.
 * `fileConfirms`: the file has this row more than one time (two equal purchases on one day), and each
 * earlier copy of it is in the ledger from this file. Only then the file is the confirmation for this copy.
 */
export async function recordWorker(deps: RecordExpenseDeps, row: ReconciledRow, category_id: string, idempotency_key: string, suggest_run_id: string | null, parent_run_id: string, fileConfirms = false): Promise<LineOutcome> {
  try {
    const result = await recordExpense(
      { ...deps, parent_run_id },
      {
        idempotency_key, amount_cents: row.amount_cents, currency: 'ZAR', occurred_on: row.occurred_on, merchant_name: row.description_clean, category_id, account: row.account,
        // Without fileConfirms, rule R7 decides: a similar expense in the ledger makes this line wait.
        ...(fileConfirms ? { confirm_duplicate: true } : {}),
        ...(suggest_run_id ? { suggest_run_id } : {}),
      },
    );
    return result.replayed ? end(row, 'DUPLICATE', 'This line was imported before.', { expense_id: result.expense.id }) : end(row, 'RECORDED', 'Recorded in ' + category_id + '. Budget: ' + result.budget.state + '.', { expense_id: result.expense.id });
  } catch (error) {
    if (error instanceof AppError && error.code === 'NEEDS_CONFIRMATION') return end(row, 'WAITING', 'An expense with the same date, amount and merchant is already recorded. Record this line in the form if it is a second one.');
    if (error instanceof AppError && error.code === 'VERIFICATION_FAILED') return end(row, 'WAITING', 'Saved, but the check of the ledger failed (run ' + error.run_id + '). A person must look.');
    if (error instanceof AppError) return end(row, 'REJECTED', error.problems.map((p) => p.rule + ': ' + p.text).join(' '));
    if (error instanceof StorageUnavailable) return end(row, 'WAITING', LATER);
    throw error; // a defect
  }
}

/** One income row for one row with money in. The same checks of value as an expense: a real amount (R1), a date that is not after today (R5). */
export function incomeWorker(deps: { income: IncomeStore; clock: Clock; ids: IdGen }, row: ReconciledRow, idempotency_key: string): LineOutcome {
  const { amount_cents, occurred_on } = row;
  const source = row.description_clean.trim();
  if (amount_cents === null || !Number.isInteger(amount_cents) || amount_cents < 1 || amount_cents > MAX_CENTS) return end(row, 'REJECTED', 'R1: The amount must be an integer number of cents, more than 0 and not more than ' + MAX_CENTS + '.');
  if (occurred_on === null || occurred_on > deps.clock.today()) return end(row, 'REJECTED', 'R5: The date of an income row is not after today.');
  if (source === '' || source.length > 80) return end(row, 'REJECTED', 'R4: The description must have 1 to 80 characters.');
  try {
    const id = deps.ids('inc');
    deps.income.insert({ id, idempotency_key, occurred_on, amount_cents, source, account: row.account, created_at: deps.clock.now() });
    return end(row, 'RECORDED', 'Recorded as income.', { income_id: id });
  } catch (error) {
    if (error instanceof DuplicateKey) return end(row, 'DUPLICATE', 'This line was imported before.', { income_id: deps.income.findByKey(idempotency_key)?.id });
    if (error instanceof StorageUnavailable) return end(row, 'WAITING', LATER);
    throw error; // a defect
  }
}

export function memoryImportStore(): ImportStore {
  const batches = new Map<string, ImportBatch>();
  return { save: (b) => void batches.set(b.id, structuredClone(b)), get: (id) => batches.get(id) ?? null };
}

export function sqliteImportStore(db: DatabaseSync): ImportStore {
  return {
    save: (b) =>
      void db.prepare('INSERT INTO import_batches (id, created_at, status, run_id, checkpoint) VALUES (?, ?, ?, ?, ?) ON CONFLICT (id) DO UPDATE SET status = excluded.status, run_id = excluded.run_id, checkpoint = excluded.checkpoint')
        .run(b.id, b.created_at, b.status, b.run_id, JSON.stringify(b.checkpoint)),
    get(id) {
      const row = db.prepare('SELECT * FROM import_batches WHERE id = ?').get(id);
      return row ? ({ ...row, checkpoint: JSON.parse(String(row.checkpoint)) } as ImportBatch) : null;
    },
  };
}
