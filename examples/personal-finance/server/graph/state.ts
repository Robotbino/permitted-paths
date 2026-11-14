// The typed state of the graph "record an expense", and the owner of each field.
// Read this file as a table: which node is permitted to write which field.
import type { BudgetStatus, Expense, Problem, RecordExpenseResult } from '../../shared/contracts.ts';
import type { ExpenseProposal } from '../domain/expense.ts';
import type { ExpenseFacts } from '../domain/expense-rules.ts';

export type RecordFacts = ExpenseFacts & { limit_cents: number | null; spent_before_cents: number };

export type RecordExpenseState = {
  // input: the engine gets these at the start. No node writes them.
  run_id: string;
  request: unknown;
  // gate1
  proposal: ExpenseProposal | null;
  idempotency_key: string | null;
  confirmed: boolean;
  suggest_run_id: string | null; // level 3: the suggest run that the person saw before this request
  gate1_problems: Problem[];
  // dedupe
  dedupe: 'NEW' | 'REPLAY' | 'CONFLICT' | 'UNAVAILABLE' | null;
  replay: { expense: Expense; budget: BudgetStatus } | null;
  // load_facts
  facts: RecordFacts | 'UNAVAILABLE' | null;
  // gate2
  gate2_problems: Problem[];
  // commit
  commit: 'SAVED' | 'TRANSIENT_ERROR' | null;
  expense: Expense | null;
  attempts: number;
  // backoff
  waited_ms: number;
  // project
  budget_after: BudgetStatus | null;
  // verify
  verification: { ok: boolean; problems: Problem[] } | null;
  // remember (level 3; the node is in the graph only when the application has a merchant memory)
  memory_update: 'REMEMBERED' | 'UNAVAILABLE' | null;
  // the three ends
  response: RecordExpenseResult | null;
  rejection: { code: 'SHAPE' | 'RULE' | 'NEEDS_CONFIRMATION' | 'KEY_CONFLICT'; problems: Problem[] } | null;
  escalation: { code: 'STORAGE_UNAVAILABLE' | 'VERIFICATION_FAILED'; reason: string; problems: Problem[] } | null;
};

export const RECORD_OWNERS: { [K in keyof RecordExpenseState]: string } = {
  run_id: 'input',
  request: 'input',
  proposal: 'gate1',
  idempotency_key: 'gate1',
  confirmed: 'gate1',
  suggest_run_id: 'gate1',
  gate1_problems: 'gate1',
  dedupe: 'dedupe',
  replay: 'dedupe',
  facts: 'load_facts',
  gate2_problems: 'gate2',
  commit: 'commit',
  expense: 'commit',
  attempts: 'commit',
  waited_ms: 'backoff',
  budget_after: 'project',
  verification: 'verify',
  memory_update: 'remember',
  response: 'respond',
  rejection: 'reject',
  escalation: 'escalate',
};

export function initialRecordState(run_id: string, request: unknown): RecordExpenseState {
  return {
    run_id, request,
    proposal: null, idempotency_key: null, confirmed: false, suggest_run_id: null, gate1_problems: [],
    dedupe: null, replay: null, facts: null, gate2_problems: [],
    commit: null, expense: null, attempts: 0, waited_ms: 0,
    budget_after: null, verification: null, memory_update: null,
    response: null, rejection: null, escalation: null,
  };
}
