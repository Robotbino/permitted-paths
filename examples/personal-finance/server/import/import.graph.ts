// The orchestrator graph "import a statement". The record graph handles one expense that a person types.
// A statement has many rows, in a layout that the bank decides, and that needs more:
//   - the import pipeline of shared/pipeline: inspect, map, validate, normalise, reconcile (import-nodes.read.ts)
//   - a wait for a mapping when the layout is not known, and a mapping gate for each mapping
//   - fan-out: one sub-run for each merchant and for each expense (line-worker.ts), in a bounded pool (pool.ts)
//   - one budget of model calls for the whole import, owned by the orchestrator, not by the workers
//   - a wait for the person, with a stored checkpoint, and a resume
//   - one end for each line, an independent check that no line was lost (reconciler.ts), and text for a budget sheet
//
//   inspect -> map -> [await_mapping] -> stage -> classify -> await_person   ...the person decides...
//   await_person -> apply -> reconcile -> export -> respond ; reject
//
// The orchestrator is code. It is not a model that plans. Each edge is a condition on the state.
import { DecideRequest, ImportRequest, MappingRequest, type ImportProposal, type ImportResult, type MappingNeeded } from '../../shared/contracts.import.ts';
import { AppError } from '../errors.ts';
import { runGraph, type Graph } from '../graph/engine.ts';
import { collector, writeTrace } from '../graph/trace.ts';
import { READ_NODES } from './import-nodes.read.ts';
import { WRITE_NODES } from './import-nodes.write.ts';
import { emptyState, IMPORT_OWNERS, type ImportBatch, type ImportDeps, type ImportState } from './import-state.ts';

export { batchIdOf, POOL_SIZE, rowKey, type ImportDeps, type ImportState } from './import-state.ts';

type S = ImportState;

export const importGraph: Graph<S, ImportDeps> = {
  name: 'import-statement',
  start: 'inspect',
  nodes: [...READ_NODES, ...WRITE_NODES],
  maxSteps: 16,
  owners: IMPORT_OWNERS,
  edges: [
    { from: 'inspect', to: 'reject', label: 'not a table, or too long', when: (s) => s.file!.refusal.length > 0 },
    { from: 'inspect', to: 'map' },
    { from: 'map', to: 'reject', label: 'mapping FAIL', when: (s) => s.map!.source === 'given' && s.map!.problems.length > 0 },
    { from: 'map', to: 'await_mapping', label: 'no known profile', when: (s) => s.map!.source === 'none' },
    { from: 'map', to: 'stage', label: 'a known profile, or mapping PASS' },
    { from: 'await_mapping', to: 'respond', label: 'wait for a mapping', when: (s) => s.mapping === null },
    { from: 'await_mapping', to: 'reject', label: 'mapping FAIL', when: (s) => s.mapping_problems.length > 0 },
    { from: 'await_mapping', to: 'stage', label: 'mapping PASS' },
    { from: 'stage', to: 'classify' },
    { from: 'classify', to: 'await_person' },
    { from: 'await_person', to: 'respond', label: 'wait for the person', when: (s) => s.decisions === null },
    { from: 'await_person', to: 'reject', label: 'decisions FAIL', when: (s) => s.decision_problems.length > 0 },
    { from: 'await_person', to: 'apply', label: 'decisions PASS' },
    { from: 'apply', to: 'reconcile' },
    { from: 'reconcile', to: 'export' },
    { from: 'export', to: 'respond' },
  ],
};

async function run(deps: ImportDeps, state: S, startAt: string, parent_run_id: string | null): Promise<S> {
  const started_at = deps.clock.now();
  const checkpoints = collector<S>();
  const result = await runGraph(importGraph, state, deps, { onStep: checkpoints.onStep, startAt });
  writeTrace(deps.trace, { id: state.run_id, graph: importGraph.name, started_at, ended_at: deps.clock.now(), result: result.state.response ? 'PASS' : 'FAIL', subject_id: result.state.batch_id || null, parent_run_id }, result, checkpoints.events);
  if (result.state.rejection) throw new AppError('SHAPE', result.state.rejection.problems, state.run_id);
  return result.state;
}

/** Stores the state at the node where the run waits, without the answer of this step. */
function wait(deps: ImportDeps, state: S, created_at: string): ImportProposal | MappingNeeded {
  deps.batches.save({ id: state.batch_id, created_at, status: state.staged ? 'WAITING_FOR_PERSON' : 'WAITING_FOR_MAPPING', run_id: state.run_id, checkpoint: { ...state, response: null } });
  return state.response as ImportProposal | MappingNeeded;
}

function batchOf(deps: ImportDeps, batch_id: string): ImportBatch {
  const batch = deps.batches.get(batch_id);
  if (!batch) throw new AppError('NOT_FOUND');
  return batch;
}

/** Step 1: read the file and propose, or ask for a mapping. Nothing is recorded. The state is stored for the next step. */
export async function startImport(deps: ImportDeps, input: unknown): Promise<ImportProposal | MappingNeeded> {
  const request = ImportRequest.safeParse(input);
  if (!request.success) throw new AppError('SHAPE', [{ rule: 'R14', text: 'The request must have "csv" with 1 to 9000 characters and "account" with 1 to 40 characters. A "mapping" is optional.' }]);
  const { csv, account, mapping } = request.data;
  return wait(deps, await run(deps, emptyState(deps.ids('run'), csv, account, mapping), 'inspect', null), deps.clock.now());
}

/** The mapping step: start again from the checkpoint, at the node await_mapping, with the mapping as input. */
export async function mapImport(deps: ImportDeps, batch_id: string, input: unknown): Promise<ImportProposal | MappingNeeded> {
  const batch = batchOf(deps, batch_id);
  const request = MappingRequest.safeParse(input);
  if (!request.success || request.data.mapping == null) throw new AppError('SHAPE', [{ rule: 'R14', text: 'The request must have one field "mapping".' }]);
  if (batch.status !== 'WAITING_FOR_MAPPING') throw new AppError('RULE', [{ rule: 'R14', text: 'This import does not wait for a mapping.' }]);
  // A mapping that fails the gate ends the run with an error. The batch still waits, thus the person can send a corrected mapping.
  const state = await run(deps, { ...(batch.checkpoint as S), run_id: deps.ids('run'), mapping: request.data.mapping }, 'await_mapping', batch.run_id);
  return wait(deps, state, batch.created_at);
}

/** The last step: start again from the checkpoint, at the node await_person, with the decisions of the person as input. */
export async function decideImport(deps: ImportDeps, batch_id: string, input: unknown): Promise<ImportResult> {
  const batch = batchOf(deps, batch_id);
  const request = DecideRequest.safeParse(input);
  if (!request.success) throw new AppError('SHAPE', [{ rule: 'R14', text: 'The request must have a list "decisions" of { line_no, category_id }. An "export_profile" is optional.' }]);
  if (batch.status === 'WAITING_FOR_MAPPING') throw new AppError('RULE', [{ rule: 'R14', text: 'This import waits for a mapping. It has no lines to decide yet.' }]);
  const checkpoint = batch.checkpoint as S;
  // The decisions of a batch are applied one time. A second request (the first answer was lost)
  // gets the stored result. To decide the lines that still wait, import the statement again.
  if (batch.status === 'DONE') return checkpoint.response as ImportResult;
  const state = await run(deps, { ...checkpoint, run_id: deps.ids('run'), decisions: request.data.decisions, export_profile: request.data.export_profile ?? null }, 'await_person', batch.run_id);
  deps.batches.save({ ...batch, status: 'DONE', checkpoint: state });
  return state.response as ImportResult;
}
