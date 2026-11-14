// The execution graph "record an expense". Level 1 did the same work as one function with
// the steps in sequence. Here each step is a node, and each "what happens next" is an edge.
// The nodes call the same domain functions as level 1. Only the structure is new.
//
//   gate1 -> dedupe -> load_facts -> gate2 -> commit -> project -> verify -> respond
//     |        |           |           |        ^  |                  |
//   reject   reject     escalate     reject  backoff  escalate     escalate
import type { BudgetStatus } from '../../shared/contracts.ts';
import type { Clock, IdGen } from '../clock.ts';
import { budgetStatus } from '../domain/budget.ts';
import { periodOf, sameAsStored, toExpense } from '../domain/expense.ts';
import { onlyNeedsConfirmation } from '../domain/expense-rules.ts';
import { DuplicateKey, StorageUnavailable } from '../errors.ts';
import type { MerchantMemory } from '../intelligence/merchant-memory.ts';
import type { Stores } from '../repositories/ports.ts';
import type { Graph, GraphNode } from './engine.ts';
import { gate1, gate2 } from './gates.ts';
import { RECORD_OWNERS, type RecordExpenseState as S, type RecordFacts } from './state.ts';
import { verifyRecorded, type LedgerReader } from './verifier.ts';

export type RecordGraphDeps = { stores: Stores; clock: Clock; ids: IdGen; ledger: LedgerReader; sleep(ms: number): Promise<void>; memory?: MerchantMemory };
type Node = GraphNode<S, RecordGraphDeps>;

export const MAX_ATTEMPTS = 2;
export const BACKOFF_MS = 40;

/** Runs a read of the store. A store that is not available becomes a value, not an exception. */
function tryRead<T>(read: () => T): T | 'UNAVAILABLE' {
  try {
    return read();
  } catch (error) {
    if (error instanceof StorageUnavailable) return 'UNAVAILABLE';
    throw error; // not expected: a defect. The engine does not hide it.
  }
}

const budgetNow = (stores: Stores, category_id: string, period: string): BudgetStatus => {
  const budget = stores.budgets.find(category_id, period);
  return budgetStatus(category_id, period, budget ? budget.limit_cents : null, stores.expenses.sumForCategory(category_id, period));
};

const NODES: Node[] = [
  {
    id: 'gate1', type: 'code',
    act(state) {
      const g = gate1(state.request);
      return { writes: { proposal: g.proposal, idempotency_key: g.idempotency_key, confirmed: g.confirmed, suggest_run_id: g.suggest_run_id, gate1_problems: g.problems }, result: g.problems.length ? 'FAIL' : 'PASS', note: g.problems.length ? 'Shape: ' + g.problems.map((p) => p.rule).join(', ') + '.' : 'The shape is correct.' };
    },
  },
  {
    id: 'dedupe', type: 'code',
    act(state, { stores }) {
      const found = tryRead(() => {
        const stored = stores.expenses.findByKey(state.idempotency_key!);
        return stored ? { stored, budget: budgetNow(stores, stored.category_id, periodOf(stored.occurred_on)) } : null;
      });
      if (found === 'UNAVAILABLE') return { writes: { dedupe: 'UNAVAILABLE' }, result: 'FAIL', note: 'The store did not answer.' };
      if (!found) return { writes: { dedupe: 'NEW' }, note: 'This request key is new.' };
      if (!sameAsStored(found.stored, state.proposal!)) return { writes: { dedupe: 'CONFLICT' }, result: 'FAIL', note: 'R8: this key already recorded a different expense.' };
      return { writes: { dedupe: 'REPLAY', replay: { expense: found.stored, budget: found.budget } }, note: 'This request already recorded its expense. Nothing more is saved.' };
    },
  },
  {
    id: 'load_facts', type: 'code',
    act(state, { stores, clock }) {
      const p = state.proposal!;
      const facts = tryRead((): RecordFacts => {
        const budget = stores.budgets.find(p.category_id, periodOf(p.occurred_on));
        return {
          today: clock.today(),
          category: stores.categories.get(p.category_id),
          similar_ids: stores.expenses.findSimilar(p.occurred_on, p.amount_cents, p.merchant_key),
          limit_cents: budget ? budget.limit_cents : null,
          spent_before_cents: stores.expenses.sumForCategory(p.category_id, periodOf(p.occurred_on)),
        };
      });
      return facts === 'UNAVAILABLE' ? { writes: { facts }, result: 'FAIL', note: 'The store did not answer.' } : { writes: { facts }, note: 'Facts read: today, the category, similar expenses, the budget, the spent amount.' };
    },
  },
  {
    id: 'gate2', type: 'code',
    act(state) {
      const problems = gate2(state.proposal!, state.facts as RecordFacts, state.confirmed);
      return { writes: { gate2_problems: problems }, result: problems.length ? 'FAIL' : 'PASS', note: problems.length ? 'Sense: ' + problems.map((p) => p.rule).join(', ') + '.' : 'The proposal is sensible against the facts.' };
    },
  },
  {
    id: 'commit', type: 'code',
    act(state, { stores, clock, ids }) {
      // The only node with a side effect on the ledger.
      const attempts = state.attempts + 1;
      const expense = toExpense(state.proposal!, ids('exp'), state.idempotency_key!, clock.now());
      try {
        stores.expenses.insert(expense);
        return { writes: { commit: 'SAVED', expense, attempts }, note: 'Saved as ' + expense.id + '.' };
      } catch (error) {
        if (error instanceof DuplicateKey) {
          // An earlier attempt saved the row and then failed. The key makes the second attempt safe.
          const stored = tryRead(() => stores.expenses.findByKey(state.idempotency_key!));
          if (stored && stored !== 'UNAVAILABLE') return { writes: { commit: 'SAVED', expense: stored, attempts }, note: 'The row was already saved by an earlier attempt.' };
        } else if (!(error instanceof StorageUnavailable)) throw error;
        return { writes: { commit: 'TRANSIENT_ERROR', attempts }, result: 'FAIL', note: 'The store did not save. Attempt ' + attempts + ' of ' + MAX_ATTEMPTS + '.' };
      }
    },
  },
  {
    id: 'backoff', type: 'code',
    async act(state, { sleep }) {
      const ms = BACKOFF_MS * state.attempts;
      await sleep(ms);
      return { writes: { waited_ms: state.waited_ms + ms }, note: 'Waited ' + ms + ' ms before the next attempt.' };
    },
  },
  {
    id: 'project', type: 'code',
    act(state) {
      // A pure calculation: the spent amount before, plus this expense. It does not read the store.
      const facts = state.facts as RecordFacts;
      const e = state.expense!;
      const after = budgetStatus(e.category_id, periodOf(e.occurred_on), facts.limit_cents, facts.spent_before_cents + e.amount_cents);
      return { writes: { budget_after: after }, note: 'Budget after: ' + after.state + ' (' + after.spent_cents + ' cents spent).' };
    },
  },
  {
    id: 'verify', type: 'code',
    act(state, { ledger }) {
      const verification = tryRead(() => verifyRecorded(ledger, state.idempotency_key!, state.expense!, state.proposal!, state.budget_after!));
      if (verification === 'UNAVAILABLE') return { writes: { verification: { ok: false, problems: [{ rule: 'R10', text: 'The verifier cannot read the ledger.' }] } }, result: 'FAIL', note: 'The verifier cannot read the ledger.' };
      return { writes: { verification }, result: verification.ok ? 'PASS' : 'FAIL', note: verification.ok ? 'The ledger agrees with the graph.' : 'The ledger does not agree: ' + verification.problems.map((p) => p.rule).join(', ') + '.' };
    },
  },
  {
    id: 'respond', type: 'code',
    act(state) {
      const response = state.replay ? { expense: state.replay.expense, budget: state.replay.budget, replayed: true, run_id: state.run_id } : { expense: state.expense!, budget: state.budget_after!, replayed: false, run_id: state.run_id };
      return { writes: { response }, note: state.replay ? 'Answer with the stored expense.' : 'Answer with the expense and the budget.' };
    },
  },
  {
    id: 'reject', type: 'code',
    act(state) {
      const rejection: NonNullable<S['rejection']> =
        state.gate1_problems.length > 0 ? { code: 'SHAPE', problems: state.gate1_problems }
        : state.dedupe === 'CONFLICT' ? { code: 'KEY_CONFLICT', problems: [{ rule: 'R8', text: 'This request key already recorded a different expense.' }] }
        : { code: onlyNeedsConfirmation(state.gate2_problems) ? 'NEEDS_CONFIRMATION' : 'RULE', problems: state.gate2_problems };
      return { writes: { rejection }, result: 'FAIL', note: 'Refused: ' + rejection.code + '. Nothing is saved.' };
    },
  },
  {
    id: 'escalate', type: 'code',
    act(state) {
      const failedCheck = state.verification !== null && !state.verification.ok;
      const escalation: NonNullable<S['escalation']> = failedCheck
        ? { code: 'VERIFICATION_FAILED', reason: 'The expense ' + state.expense!.id + ' is saved, but the ledger does not agree with the graph. A person must look.', problems: state.verification!.problems }
        : { code: 'STORAGE_UNAVAILABLE', reason: state.commit === 'TRANSIENT_ERROR' ? 'The store did not save after ' + state.attempts + ' attempts.' : 'The store did not answer.', problems: [] };
      return { writes: { escalation }, result: 'FAIL', note: escalation.reason };
    },
  },
];

// Level 3. After a verified save, the application remembers the category that the person selected
// for this merchant. The node is after `verify`: only an expense that is in the ledger teaches the memory.
// A failure of the memory does not change the result of the expense.
const REMEMBER: Node = {
  id: 'remember', type: 'code',
  act(state, { memory, clock }) {
    try {
      memory!.remember(state.expense!.merchant_key, state.expense!.category_id, clock.today(), state.run_id);
      return { writes: { memory_update: 'REMEMBERED' }, note: 'Remembered: "' + state.expense!.merchant_key + '" is in "' + state.expense!.category_id + '".' };
    } catch {
      return { writes: { memory_update: 'UNAVAILABLE' }, result: 'FAIL', note: 'The memory did not save. The expense is recorded.' };
    }
  },
};

export const recordExpenseGraph: Graph<S, RecordGraphDeps> = {
  name: 'record-expense',
  start: 'gate1',
  nodes: NODES,
  owners: RECORD_OWNERS,
  maxSteps: 16,
  // The engine takes the first edge whose condition is true. An edge with no condition is the usual path.
  edges: [
    { from: 'gate1', to: 'reject', label: 'shape FAIL', when: (s) => s.gate1_problems.length > 0 },
    { from: 'gate1', to: 'dedupe', label: 'shape PASS' },
    { from: 'dedupe', to: 'respond', label: 'replay', when: (s) => s.dedupe === 'REPLAY' },
    { from: 'dedupe', to: 'reject', label: 'key conflict', when: (s) => s.dedupe === 'CONFLICT' },
    { from: 'dedupe', to: 'escalate', label: 'store unavailable', when: (s) => s.dedupe === 'UNAVAILABLE' },
    { from: 'dedupe', to: 'load_facts', label: 'new' },
    { from: 'load_facts', to: 'escalate', label: 'store unavailable', when: (s) => s.facts === 'UNAVAILABLE' },
    { from: 'load_facts', to: 'gate2' },
    { from: 'gate2', to: 'reject', label: 'sense FAIL', when: (s) => s.gate2_problems.length > 0 },
    { from: 'gate2', to: 'commit', label: 'sense PASS' },
    { from: 'commit', to: 'project', label: 'saved', when: (s) => s.commit === 'SAVED' },
    { from: 'commit', to: 'backoff', label: 'try again', when: (s) => s.attempts < MAX_ATTEMPTS },
    { from: 'commit', to: 'escalate', label: 'attempts used' },
    { from: 'backoff', to: 'commit' },
    { from: 'project', to: 'verify' },
    { from: 'verify', to: 'respond', label: 'ledger agrees', when: (s) => s.verification?.ok === true },
    { from: 'verify', to: 'escalate', label: 'ledger does not agree' },
  ],
};

/** Level 3: the same graph with one more node, `remember`, between `verify` and `respond`. */
export const recordExpenseGraphWithMemory: Graph<S, RecordGraphDeps> = {
  ...recordExpenseGraph,
  nodes: [...NODES, REMEMBER],
  edges: recordExpenseGraph.edges.flatMap((e) =>
    e.from === 'verify' && e.to === 'respond' ? [{ ...e, to: 'remember' }, { from: 'remember', to: 'respond' }] : [e],
  ),
};
