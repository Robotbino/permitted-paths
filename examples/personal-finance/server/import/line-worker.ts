// The workers of an import, and the store of its checkpoints.
// A worker does the work for one item and gives back a value. It does not decide what happens next;
// the orchestrator (import.graph.ts) does. Each worker runs an existing graph as a sub-run:
//   suggestWorker -> the suggest graph of level 3 (memory, model, suggestion gate)
//   recordWorker  -> the record graph of level 2 (gates, commit, verifier, memory)
// Thus an imported line passes each gate that a line from the form passes.
import type { DatabaseSync } from 'node:sqlite';
import type { LineOutcome, LineSuggestion, StatementLine } from '../../shared/contracts.import.ts';
import { AppError, StorageUnavailable } from '../errors.ts';
import { suggestCategory, type SuggestDeps } from '../intelligence/suggest-category.graph.ts';
import { recordExpense, type RecordExpenseDeps } from '../services/record-expense.ts';

/** One suggest sub-run for one merchant. `withModel: false`: the orchestrator gave this merchant no model call. */
export async function suggestWorker(deps: SuggestDeps, merchant_name: string, withModel: boolean, parent_run_id: string): Promise<{ suggestion: LineSuggestion; reason: string }> {
  try {
    const response = await suggestCategory({ ...deps, suggester: withModel ? deps.suggester : undefined, preapproved: withModel, parent_run_id }, { merchant_name });
    return { suggestion: response.suggestion ? { ...response.suggestion, run_id: response.run_id } : null, reason: response.reason };
  } catch {
    return { suggestion: null, reason: 'WORKER_FAILED' }; // a failed worker is "no suggestion" for its merchant only
  }
}

/** One record sub-run for one line. Each error becomes the end of this line; the other lines continue. */
export async function recordWorker(deps: RecordExpenseDeps, line: StatementLine, category_id: string, idempotency_key: string, suggest_run_id: string | null, parent_run_id: string): Promise<LineOutcome> {
  const end = (e: LineOutcome['end'], detail: string, expense_id: string | null = null): LineOutcome => ({ line_no: line.line_no, end: e, expense_id, detail });
  try {
    const result = await recordExpense(
      { ...deps, parent_run_id },
      { idempotency_key, amount_cents: line.amount_cents, currency: 'ZAR', occurred_on: line.occurred_on, merchant_name: line.merchant_name, category_id, ...(suggest_run_id ? { suggest_run_id } : {}) },
    );
    return result.replayed ? end('DUPLICATE', 'This line was imported before.', result.expense.id) : end('RECORDED', 'Recorded in ' + category_id + '. Budget: ' + result.budget.state + '.', result.expense.id);
  } catch (error) {
    if (error instanceof AppError && error.code === 'NEEDS_CONFIRMATION') return end('WAITING', 'An expense with the same date, amount and merchant is already recorded. Record this line in the form if it is a second one.');
    if (error instanceof AppError && error.code === 'VERIFICATION_FAILED') return end('WAITING', 'Saved, but the check of the ledger failed (run ' + error.run_id + '). A person must look.');
    if (error instanceof AppError) return end('REJECTED', error.problems.map((p) => p.rule + ': ' + p.text).join(' '));
    if (error instanceof StorageUnavailable) return end('WAITING', 'The store did not answer. Import the statement again later; a line is never recorded two times.');
    throw error; // a defect
  }
}

/** `checkpoint`: while the batch waits, the state at the node await_person. When it is DONE, the final state with the result. */
export type ImportBatch = { id: string; created_at: string; status: 'WAITING_FOR_PERSON' | 'DONE'; run_id: string; checkpoint: unknown };

export interface ImportStore {
  save(batch: ImportBatch): void;
  get(id: string): ImportBatch | null;
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
