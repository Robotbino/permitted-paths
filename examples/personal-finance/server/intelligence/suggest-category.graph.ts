// The execution graph "suggest a category". It runs on the same engine as the record graph.
// One node has the type "model". All the other nodes are code, and code decides each edge:
// if the model is called, what it gets, and what happens to its answer.
//
//   gate1 -> recall -> allow -> ask_model -> suggestion_gate -> respond
//     |        |         |          |               ^
//   reject     +---------|----------|---------------+   (a memory hit goes directly to the gate)
//                        +-> respond (AI off, daily cap)
//                                   +-> respond (the model failed)
//
// This graph has no node that writes the ledger or the memory. It gets no store that can.
import type { Category, Problem } from '../../shared/contracts.ts';
import { SuggestRequest, type SuggestReason, type SuggestResponse } from '../../shared/contracts.suggest.ts';
import type { Clock, IdGen } from '../clock.ts';
import { merchantKey } from '../domain/expense.ts';
import { AppError } from '../errors.ts';
import { runGraph, type Graph, type GraphNode } from '../graph/engine.ts';
import { collector, writeTrace, type TraceStore } from '../graph/trace.ts';
import type { MerchantMemory } from './merchant-memory.ts';
import { suggestionGate } from './suggestion-gate.ts';
import type { CategorySuggester, SuggesterOutput } from './suggester.ts';

export type SuggestDeps = {
  /** Read-only: the list of categories. The graph gets a function, not the store. */
  listCategories(): Category[];
  clock: Clock;
  ids: IdGen;
  memory?: MerchantMemory;
  /** Absent: the AI is off, and the application works. */
  suggester?: CategorySuggester;
  trace?: TraceStore;
  /** The largest number of model calls in one day. */
  dailyCap: number;
  /** Level 4: the run that started this run as a worker. */
  parent_run_id?: string;
};

export type SuggestState = {
  run_id: string; request: unknown; // input
  merchant: { name: string; key: string } | null; gate1_problems: Problem[]; // gate1
  recall: { status: 'HIT'; category_id: string; times_confirmed: number } | { status: 'MISS' } | { status: 'UNAVAILABLE' } | null; // recall
  allowance: { allowed: boolean; reason: 'OK' | 'AI_OFF' | 'DAILY_CAP'; calls_today: number } | null; // allow
  model_output: (SuggesterOutput & { model: string }) | null; // ask_model
  verdict: { accepted: Category | null; problems: Problem[] } | null; // suggestion_gate
  response: SuggestResponse | null; // respond
  rejection: { problems: Problem[] } | null; // reject
};
type S = SuggestState;
type Node = GraphNode<S, SuggestDeps>;

const NODES: Node[] = [
  {
    id: 'gate1', type: 'code',
    act(state) {
      const parsed = SuggestRequest.safeParse(state.request);
      if (!parsed.success) {
        const problems = [{ rule: 'R4', text: 'The merchant name must have 1 to 80 characters, and the request has no other field.' }];
        return { writes: { gate1_problems: problems }, result: 'FAIL', note: 'Shape: R4.' };
      }
      return { writes: { merchant: { name: parsed.data.merchant_name, key: merchantKey(parsed.data.merchant_name) }, gate1_problems: [] }, note: 'The shape is correct.' };
    },
  },
  {
    id: 'recall', type: 'code',
    act(state, { memory }) {
      if (!memory) return { writes: { recall: { status: 'MISS' } }, note: 'The application has no memory.' };
      try {
        const hit = memory.recall(state.merchant!.key);
        return hit
          ? { writes: { recall: { status: 'HIT', category_id: hit.category_id, times_confirmed: hit.times_confirmed } }, note: 'The person confirmed "' + hit.category_id + '" for this merchant ' + hit.times_confirmed + ' time(s). The model is not necessary.' }
          : { writes: { recall: { status: 'MISS' } }, note: 'The memory does not know this merchant.' };
      } catch {
        return { writes: { recall: { status: 'UNAVAILABLE' } }, result: 'FAIL', note: 'The memory did not answer. Continue without it.' };
      }
    },
  },
  {
    id: 'allow', type: 'code',
    act(_state, { suggester, trace, clock, dailyCap }) {
      if (!suggester) return { writes: { allowance: { allowed: false, reason: 'AI_OFF', calls_today: 0 } }, note: 'The AI is off.' };
      // The cost control. The count comes from the trace. If the count cannot be read, the answer is "no".
      let calls = dailyCap;
      try {
        calls = trace ? trace.countSteps('ask_model', clock.now().slice(0, 10)) : dailyCap;
      } catch {
        calls = dailyCap;
      }
      const allowed = calls < dailyCap;
      return { writes: { allowance: { allowed, reason: allowed ? 'OK' : 'DAILY_CAP', calls_today: calls } }, result: allowed ? 'PASS' : 'FAIL', note: allowed ? 'Model call ' + (calls + 1) + ' of ' + dailyCap + ' today.' : 'The daily limit of ' + dailyCap + ' model calls is used.' };
    },
  },
  {
    id: 'ask_model', type: 'model',
    async act(state, { suggester, listCategories }) {
      const categories = listCategories().filter((c) => c.active).map((c) => ({ id: c.id, name: c.name }));
      let output: SuggesterOutput;
      try {
        output = await suggester!.suggest({ merchant_name: state.merchant!.name, categories });
      } catch {
        output = { status: 'ERROR', detail: 'The suggester failed.' }; // a suggester must not throw; if it does, it is still only "no suggestion"
      }
      return { writes: { model_output: { ...output, model: suggester!.model } }, result: output.status === 'OK' ? 'PASS' : 'FAIL', note: output.status === 'OK' ? 'The model answered "' + output.category_id.slice(0, 40) + '".' : 'The model gave no answer: ' + output.status + '.' };
    },
  },
  {
    id: 'suggestion_gate', type: 'code',
    act(state, { listCategories }) {
      const proposed = state.recall?.status === 'HIT' ? state.recall.category_id : (state.model_output as { category_id: string }).category_id;
      const verdict = suggestionGate(proposed, listCategories());
      return { writes: { verdict }, result: verdict.problems.length ? 'FAIL' : 'PASS', note: verdict.problems.length ? 'R12: the suggestion is not permitted. It is not shown.' : verdict.accepted ? 'The suggestion "' + verdict.accepted.id + '" is a permitted category.' : 'The model does not know. No suggestion.' };
    },
  },
  {
    id: 'respond', type: 'code',
    act(state) {
      const fromMemory = state.recall?.status === 'HIT';
      const accepted = state.verdict?.accepted ?? null;
      const reason: SuggestReason = accepted ? (fromMemory ? 'FROM_MEMORY' : 'FROM_MODEL')
        : state.verdict?.problems.length ? 'NOT_PERMITTED'
        : state.verdict ? 'MODEL_DOES_NOT_KNOW'
        : state.model_output ? 'MODEL_UNAVAILABLE'
        : state.allowance!.reason === 'AI_OFF' ? 'AI_OFF' : 'DAILY_CAP';
      const response: SuggestResponse = { suggestion: accepted ? { category_id: accepted.id, category_name: accepted.name, source: fromMemory ? 'memory' : 'model' } : null, reason, run_id: state.run_id };
      return { writes: { response }, note: accepted ? 'Suggest "' + accepted.name + '" to the person.' : 'No suggestion (' + reason + '). The person selects the category.' };
    },
  },
  { id: 'reject', type: 'code', act: (state) => ({ writes: { rejection: { problems: state.gate1_problems } }, result: 'FAIL', note: 'Refused: SHAPE.' }) },
];

export const suggestCategoryGraph: Graph<S, SuggestDeps> = {
  name: 'suggest-category',
  start: 'gate1',
  nodes: NODES,
  maxSteps: 10,
  owners: { run_id: 'input', request: 'input', merchant: 'gate1', gate1_problems: 'gate1', recall: 'recall', allowance: 'allow', model_output: 'ask_model', verdict: 'suggestion_gate', response: 'respond', rejection: 'reject' },
  edges: [
    { from: 'gate1', to: 'reject', label: 'shape FAIL', when: (s) => s.gate1_problems.length > 0 },
    { from: 'gate1', to: 'recall', label: 'shape PASS' },
    { from: 'recall', to: 'suggestion_gate', label: 'memory hit', when: (s) => s.recall?.status === 'HIT' },
    { from: 'recall', to: 'allow', label: 'not in memory' },
    { from: 'allow', to: 'respond', label: 'AI off or limit used', when: (s) => !s.allowance?.allowed },
    { from: 'allow', to: 'ask_model', label: 'allowed' },
    { from: 'ask_model', to: 'respond', label: 'no answer', when: (s) => s.model_output?.status !== 'OK' },
    { from: 'ask_model', to: 'suggestion_gate', label: 'answer' },
    { from: 'suggestion_gate', to: 'respond' },
  ],
};

export const initialSuggestState = (run_id: string, request: unknown): S => ({ run_id, request, merchant: null, gate1_problems: [], recall: null, allowance: null, model_output: null, verdict: null, response: null, rejection: null });

/** The application service "suggest a category": runs the graph and writes the trace. */
export async function suggestCategory(deps: SuggestDeps, input: unknown): Promise<SuggestResponse> {
  const run_id = deps.ids('run');
  const started_at = deps.clock.now();
  const checkpoints = collector<S>();
  const run = await runGraph(suggestCategoryGraph, initialSuggestState(run_id, input), deps, { onStep: checkpoints.onStep });
  writeTrace(deps.trace, { id: run_id, graph: suggestCategoryGraph.name, started_at, ended_at: deps.clock.now(), result: run.state.response ? 'PASS' : 'FAIL', subject_id: null, parent_run_id: deps.parent_run_id ?? null }, run, checkpoints.events);
  if (run.state.response) return run.state.response;
  throw new AppError('SHAPE', run.state.rejection?.problems ?? [], run_id);
}
