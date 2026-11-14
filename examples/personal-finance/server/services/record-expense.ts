// The application service "record an expense".
// Level 1: this file contained the steps in sequence. Level 2: the steps are the nodes of
// graph/record-expense.graph.ts, and this file is a thin facade. It starts the graph, writes the
// trace, and changes the end of the graph into the same result or the same error as before.
// The callers (the handler, and the tests of level 1) did not change.
import type { RecordExpenseResult } from '../../shared/contracts.ts';
import type { Clock, IdGen } from '../clock.ts';
import { AppError, StorageUnavailable } from '../errors.ts';
import { runGraph } from '../graph/engine.ts';
import { recordExpenseGraph, recordExpenseGraphWithMemory } from '../graph/record-expense.graph.ts';
import { initialRecordState, type RecordExpenseState } from '../graph/state.ts';
import { collector, writeTrace, type TraceStore } from '../graph/trace.ts';
import { ledgerReaderFromStores, type LedgerReader } from '../graph/verifier.ts';
import type { MerchantMemory } from '../intelligence/merchant-memory.ts';
import type { Stores } from '../repositories/ports.ts';

export type RecordExpenseDeps = {
  stores: Stores;
  clock: Clock;
  ids: IdGen;
  /** Optional parts. Without them the service still works: no trace, a weaker verifier, a real wait. */
  trace?: TraceStore;
  ledger?: LedgerReader;
  sleep?: (ms: number) => Promise<void>;
  /** Level 3. With a memory, the graph has one more node: remember. */
  memory?: MerchantMemory;
  /** Level 3: the run that started this run as a worker. */
  parent_run_id?: string;
};

// One run at a time. Two runs that interleave would make the verifier see the expense of the other run
// and report a mismatch that is not real. One process and one writer is enough for one person.
let queue: Promise<unknown> = Promise.resolve();

export function recordExpense(deps: RecordExpenseDeps, input: unknown): Promise<RecordExpenseResult> {
  const next = queue.then(() => runOnce(deps, input));
  queue = next.catch(() => undefined);
  return next;
}

async function runOnce(deps: RecordExpenseDeps, input: unknown): Promise<RecordExpenseResult> {
  const run_id = deps.ids('run');
  const started_at = deps.clock.now();
  const checkpoints = collector<RecordExpenseState>();
  const graph = deps.memory ? recordExpenseGraphWithMemory : recordExpenseGraph;
  const run = await runGraph(
    graph,
    initialRecordState(run_id, input),
    { stores: deps.stores, clock: deps.clock, ids: deps.ids, ledger: deps.ledger ?? ledgerReaderFromStores(deps.stores), sleep: deps.sleep ?? ((ms) => new Promise((done) => setTimeout(done, ms))), memory: deps.memory },
    { onStep: checkpoints.onStep },
  );
  const { response, rejection, escalation, expense } = run.state;
  writeTrace(
    deps.trace,
    { id: run_id, graph: graph.name, started_at, ended_at: deps.clock.now(), result: response ? 'PASS' : rejection ? 'FAIL' : 'ESCALATED', subject_id: (response?.expense ?? expense)?.id ?? null, parent_run_id: run.state.suggest_run_id ?? deps.parent_run_id ?? null },
    run,
    checkpoints.events,
  );

  // Each run ends at exactly one of the three end nodes.
  if (response) return response;
  if (rejection) throw new AppError(rejection.code, rejection.problems, run_id);
  if (escalation?.code === 'VERIFICATION_FAILED') throw new AppError('VERIFICATION_FAILED', escalation.problems, run_id);
  throw new StorageUnavailable(escalation?.reason ?? 'The run stopped with no end.', run_id);
}
