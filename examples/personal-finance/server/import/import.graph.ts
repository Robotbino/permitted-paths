// The orchestrator graph "import a statement". Level 3 handled one expense that a person types.
// A statement has many lines, and that needs things that level 3 does not have:
//   - fan-out: one sub-run for each merchant and for each line (line-worker.ts)
//   - several model calls at the same time, in a bounded pool (pool.ts)
//   - one budget of model calls for the whole import, owned by the orchestrator, not by the workers
//   - a wait for the person in the middle, with a stored checkpoint, and a resume
//   - one end for each line, and an independent check that no line was lost (reconciler.ts)
//
//   parse -> classify -> await_person  ...the person decides...  await_person -> apply -> reconcile -> respond
//     |
//   reject
//
// The orchestrator is code. It is not a model that plans. Each edge is a condition on the state.
import { createHash } from 'node:crypto';
import type { Problem } from '../../shared/contracts.ts';
import { DecideRequest, ImportRequest, type ImportProposal, type ImportResult, type LineEnd, type LineOutcome, type LineSuggestion, type StatementLine } from '../../shared/contracts.import.ts';
import type { Clock, IdGen } from '../clock.ts';
import { merchantKey } from '../domain/expense.ts';
import { AppError } from '../errors.ts';
import { runGraph, type Graph, type GraphNode } from '../graph/engine.ts';
import { collector, writeTrace, type TraceStore } from '../graph/trace.ts';
import type { LedgerReader } from '../graph/verifier.ts';
import type { ImportStore } from './line-worker.ts';
import { mapPool } from './pool.ts';
import { reconcile, type Reconciliation } from './reconciler.ts';
import { parseStatement } from './statement-parser.ts';

export const POOL_SIZE = 3;

/** The ports of the orchestrator. It gets functions, not stores: it can do only what these functions do. */
export type ImportDeps = {
  clock: Clock;
  ids: IdGen;
  trace?: TraceStore;
  batches: ImportStore;
  ledger: LedgerReader;
  /** Does the memory know this merchant? A cheap, local read. */
  knows(merchant_key: string): boolean;
  suggestLine(merchant_name: string, withModel: boolean, parent_run_id: string): Promise<{ suggestion: LineSuggestion; reason: string }>;
  recordLine(line: StatementLine, category_id: string, idempotency_key: string, suggest_run_id: string | null, parent_run_id: string): Promise<LineOutcome>;
  /** The largest number of model calls for one import. 0: the AI is off. */
  modelBudget: number;
};

export type ImportState = {
  run_id: string; batch_id: string; csv: string; decisions: DecideRequest['decisions'] | null; // input
  lines: StatementLine[] | null; // parse
  suggestions: Record<string, LineSuggestion>; budget: ImportProposal['budget'] | null; // classify (the key is the merchant key)
  decision_problems: Problem[]; // await_person
  outcomes: LineOutcome[] | null; // apply
  reconciliation: Reconciliation | null; // reconcile
  response: ImportProposal | ImportResult | null; // respond
  rejection: { problems: Problem[] } | null; // reject
};
type S = ImportState;
type Node = GraphNode<S, ImportDeps>;

/** The request key of a line: the same statement gives the same keys, thus a second import records nothing. */
export const lineKey = (batch_id: string, line_no: number) => batch_id + '-' + String(line_no).padStart(4, '0');
export const batchIdOf = (csv: string) => 'imp-' + createHash('sha256').update(csv.replace(/\r\n?/g, '\n').trim()).digest('hex').slice(0, 12);
const good = (lines: StatementLine[]) => lines.filter((l) => l.problem === null);

const NODES: Node[] = [
  {
    id: 'parse', type: 'code',
    act(state) {
      const lines = parseStatement(state.csv);
      if (!lines) return { writes: { lines: null }, result: 'FAIL', note: 'The text has no header "Date,Description,Amount".' };
      return { writes: { lines }, note: lines.length + ' lines read. ' + (lines.length - good(lines).length) + ' cannot become an expense.' };
    },
  },
  {
    id: 'classify', type: 'code',
    async act(state, deps) {
      // One suggestion for each different merchant, not for each line.
      const merchants = [...new Map(good(state.lines!).map((l) => [merchantKey(l.merchant_name!), l.merchant_name!])).entries()];
      const unknown = merchants.filter(([key]) => !deps.knows(key));
      // The budget is decided here, one time, before any worker starts. Workers that run at the same
      // time cannot count each other, thus a worker is told if it has a model call or not.
      const allowed = new Set(unknown.slice(0, deps.modelBudget).map(([key]) => key));
      const results = await mapPool(merchants, POOL_SIZE, ([key, name]) => deps.suggestLine(name, allowed.has(key), state.run_id));
      const suggestions: S['suggestions'] = {};
      merchants.forEach(([key], i) => { suggestions[key] = results[i]!.suggestion; });
      const made = results.filter((r) => ['FROM_MODEL', 'MODEL_UNAVAILABLE', 'NOT_PERMITTED', 'MODEL_DOES_NOT_KNOW'].includes(r.reason)).length;
      const budget = { unknown_merchants: unknown.length, model_calls_allowed: allowed.size, model_calls_made: made };
      return { writes: { suggestions, budget }, note: merchants.length + ' merchants. ' + (merchants.length - unknown.length) + ' from the memory, ' + made + ' model calls, ' + (unknown.length - allowed.size) + ' with no budget.' };
    },
  },
  {
    id: 'await_person', type: 'person',
    act(state) {
      // The first visit: no decisions. The run stops here and the state is stored.
      if (state.decisions === null) return { note: 'The proposal waits for the person. The state is stored as a checkpoint.' };
      // The second visit, after the resume: the decisions of the person are input. Check them.
      const known = new Set(state.lines!.map((l) => l.line_no));
      const strange = state.decisions.filter((d) => !known.has(d.line_no)).map((d) => d.line_no);
      const problems = strange.length ? [{ rule: 'R14', text: 'The decisions name lines that are not in the statement: ' + strange.join(', ') + '.' }] : [];
      return { writes: { decision_problems: problems }, result: problems.length ? 'FAIL' : 'PASS', note: problems.length ? 'The decisions are not for this statement.' : 'The person decided ' + state.decisions.filter((d) => d.category_id).length + ' lines.' };
    },
  },
  {
    id: 'apply', type: 'code',
    async act(state, deps) {
      const chosen = new Map(state.decisions!.map((d) => [d.line_no, d.category_id]));
      const outcomes: LineOutcome[] = [];
      // One line after the other: the ledger has one writer. Each line is its own run of the record graph.
      for (const line of state.lines!) {
        const category_id = chosen.get(line.line_no) ?? null;
        if (line.problem) outcomes.push({ line_no: line.line_no, end: 'REJECTED', expense_id: null, detail: line.problem.text });
        else if (!category_id) outcomes.push({ line_no: line.line_no, end: 'WAITING', expense_id: null, detail: 'The person selected no category.' });
        else {
          const suggestion = state.suggestions[merchantKey(line.merchant_name!)];
          outcomes.push(await deps.recordLine(line, category_id, lineKey(state.batch_id, line.line_no), suggestion?.category_id === category_id ? suggestion.run_id : null, state.run_id));
        }
      }
      const bad = outcomes.filter((o) => o.end === 'REJECTED' || o.end === 'WAITING').length;
      return { writes: { outcomes }, note: outcomes.length + ' lines have an end. ' + bad + ' are not in the ledger.' };
    },
  },
  {
    id: 'reconcile', type: 'code',
    act(state, deps) {
      const reconciliation = reconcile(state.lines!, state.outcomes!, (line_no) => lineKey(state.batch_id, line_no), deps.ledger);
      return { writes: { reconciliation }, result: reconciliation.ok ? 'PASS' : 'FAIL', note: reconciliation.ok ? 'Each line has exactly one end, and the ledger agrees.' : 'R14: ' + reconciliation.problems.length + ' problems.' };
    },
  },
  {
    id: 'respond', type: 'code',
    act(state) {
      if (!state.outcomes) {
        const lines = state.lines!.map((l) => ({ ...l, suggestion: l.problem ? null : (state.suggestions[merchantKey(l.merchant_name!)] ?? null) }));
        return { writes: { response: { batch_id: state.batch_id, run_id: state.run_id, lines, budget: state.budget! } }, note: 'Answer with the proposal.' };
      }
      const counts = { RECORDED: 0, DUPLICATE: 0, REJECTED: 0, WAITING: 0 } as Record<LineEnd, number>;
      for (const o of state.outcomes) counts[o.end] += 1;
      return { writes: { response: { batch_id: state.batch_id, run_id: state.run_id, outcomes: state.outcomes, counts, reconciliation: state.reconciliation! } }, note: 'Answer with the end of each line.' };
    },
  },
  {
    id: 'reject', type: 'code',
    act: (state) => ({ writes: { rejection: { problems: state.decision_problems.length ? state.decision_problems : [{ rule: 'R14', text: 'The text is not a statement: the first line must be "Date,Description,Amount".' }] } }, result: 'FAIL', note: 'Refused. Nothing is recorded.' }),
  },
];

export const importGraph: Graph<S, ImportDeps> = {
  name: 'import-statement',
  start: 'parse',
  nodes: NODES,
  maxSteps: 12,
  owners: { run_id: 'input', batch_id: 'input', csv: 'input', decisions: 'input', lines: 'parse', suggestions: 'classify', budget: 'classify', decision_problems: 'await_person', outcomes: 'apply', reconciliation: 'reconcile', response: 'respond', rejection: 'reject' },
  edges: [
    { from: 'parse', to: 'reject', label: 'not a statement', when: (s) => s.lines === null },
    { from: 'parse', to: 'classify' },
    { from: 'classify', to: 'await_person' },
    { from: 'await_person', to: 'respond', label: 'wait for the person', when: (s) => s.decisions === null },
    { from: 'await_person', to: 'reject', label: 'decisions FAIL', when: (s) => s.decision_problems.length > 0 },
    { from: 'await_person', to: 'apply', label: 'decisions PASS' },
    { from: 'apply', to: 'reconcile' },
    { from: 'reconcile', to: 'respond' },
  ],
};

const emptyState = (run_id: string, batch_id: string, csv: string): S => ({ run_id, batch_id, csv, decisions: null, lines: null, suggestions: {}, budget: null, decision_problems: [], outcomes: null, reconciliation: null, response: null, rejection: null });

async function run(deps: ImportDeps, state: S, startAt: string, parent_run_id: string | null): Promise<S> {
  const started_at = deps.clock.now();
  const checkpoints = collector<S>();
  const result = await runGraph(importGraph, state, deps, { onStep: checkpoints.onStep, startAt });
  writeTrace(deps.trace, { id: state.run_id, graph: importGraph.name, started_at, ended_at: deps.clock.now(), result: result.state.response ? 'PASS' : 'FAIL', subject_id: state.batch_id, parent_run_id }, result, checkpoints.events);
  if (result.state.rejection) throw new AppError('SHAPE', result.state.rejection.problems, state.run_id);
  return result.state;
}

/** Step 1: read the statement and propose. Nothing is recorded. The state is stored for step 2. */
export async function startImport(deps: ImportDeps, input: unknown): Promise<ImportProposal> {
  const request = ImportRequest.safeParse(input);
  if (!request.success) throw new AppError('SHAPE', [{ rule: 'R14', text: 'The request must have one field "csv" with 1 to 9000 characters.' }]);
  const run_id = deps.ids('run');
  const state = await run(deps, emptyState(run_id, batchIdOf(request.data.csv), request.data.csv), 'parse', null);
  // The checkpoint: the state at the node await_person, without the answer of this step.
  deps.batches.save({ id: state.batch_id, created_at: deps.clock.now(), status: 'WAITING_FOR_PERSON', run_id, checkpoint: { ...state, response: null } });
  return state.response as ImportProposal;
}

/** Step 2: start again from the checkpoint, at the node await_person, with the decisions of the person as input. */
export async function decideImport(deps: ImportDeps, batch_id: string, input: unknown): Promise<ImportResult> {
  const batch = deps.batches.get(batch_id);
  if (!batch) throw new AppError('NOT_FOUND');
  const request = DecideRequest.safeParse(input);
  if (!request.success) throw new AppError('SHAPE', [{ rule: 'R14', text: 'The request must have a list "decisions" of { line_no, category_id }.' }]);
  const checkpoint = batch.checkpoint as S;
  const state = await run(deps, { ...checkpoint, run_id: deps.ids('run'), decisions: request.data.decisions }, 'await_person', batch.run_id);
  deps.batches.save({ ...batch, status: 'DONE' });
  return state.response as ImportResult;
}
