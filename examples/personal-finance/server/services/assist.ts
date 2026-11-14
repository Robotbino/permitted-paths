// Level 3. The application service of the assist path. Four kinds of step, four different things:
//   1 the model RECOMMENDS      interpreter.interpret: it gets the text, the capability names and the categories
//   2 the application VALIDATES  checkRequest with the real Checks (assist-checks.ts)
//   3 the person APPROVES        a second request: decide (assist-decide.ts)
//   4 the application EXECUTES   execute with the executors (assist-executors.ts)
// This file does steps 1 and 2. A capability that only reads is executed immediately. A capability
// that changes data becomes a stored proposal, and nothing is changed here.
// Each request writes one audit record. The record has no text of the person.
import { AssistRequest, MAX_ASSIST_TEXT, type AssistAudit, type AssistResponse } from '../../shared/contracts.assist.ts';
import type { IdGen } from '../clock.ts';
import { AppError } from '../errors.ts';
import { checkRequest, execute } from '../intelligence/permitted/action-gate.ts';
import { shortText, summariseShape } from '../intelligence/permitted/audit.ts';
import { capabilityList, findCapability } from '../intelligence/permitted/capabilities.ts';
import type { IntentInterpreter, InterpreterOutput } from '../intelligence/permitted/interpreter.ts';
import type { ModelBudget } from '../intelligence/model-budget.ts';
import type { AssistStore } from '../repositories/assist-store.ts';
import { assistChecks } from './assist-checks.ts';
import { assistExecutors, type ExecutorDeps } from './assist-executors.ts';

export { decide } from './assist-decide.ts';

export type AssistDeps = ExecutorDeps & {
  ids: IdGen;
  assist: AssistStore;
  /** Absent: the AI is off, and the application works. */
  interpreter?: IntentInterpreter;
  /** The model calls of the day: the same budget as the suggestions. A call is reserved before it is made. */
  budget: ModelBudget;
};

/** What the person can do with no model. Each item is a part of the application that has no model in it. */
export const WITHOUT_AI = [
  'Record an expense in the form.',
  'Import a statement and decide each line.',
  'See the plan of the pay cycle and the weekly caps.',
  'See the summary of the month.',
];

const MESSAGES = {
  AI_OFF: 'The AI is off. The application reads no request in plain words now.',
  DAILY_CAP: 'The limit of model calls for today is used. The application reads no more requests in plain words today.',
  MODEL_UNAVAILABLE: 'The model gave no answer that the application can use. Nothing is changed.',
};

/** The answer of the model as a value. An answer that has no form of the port, or a thrown error, is an ERROR. */
async function ask(deps: AssistDeps, interpreter: IntentInterpreter, text: string): Promise<InterpreterOutput> {
  try {
    const said: unknown = await interpreter.interpret({
      text,
      capabilities: capabilityList(),
      // The ids and the names of the active categories. No amount, no row, no history.
      categories: deps.stores.categories.list().filter((c) => c.active).map((c) => ({ id: c.id, name: c.name })),
    });
    if (typeof said !== 'object' || said === null || typeof (said as { status?: unknown }).status !== 'string') return { status: 'ERROR', detail: 'NOT_AN_ANSWER' };
    return said as InterpreterOutput;
  } catch {
    return { status: 'ERROR', detail: 'THREW' };
  }
}

/** The input of a request of the model, for the audit. A request that cannot be read gives no input. */
function inputOf(request: unknown): unknown {
  try {
    return typeof request === 'object' && request !== null && !Array.isArray(request) ? (request as { input?: unknown }).input : undefined;
  } catch {
    return undefined;
  }
}

const texts = (value: unknown, max: number, count: number): string[] =>
  (Array.isArray(value) ? value : []).filter((item): item is string => typeof item === 'string').slice(0, count).map((item) => shortText(item, max));

/** Steps 1 and 2 of the assist path. See the comment at the top of the file. */
export async function assist(deps: AssistDeps, input: unknown): Promise<AssistResponse> {
  const request_id = deps.ids('ast');
  const now = deps.clock.now();
  const record = (status: string, summary: string, more: Partial<Pick<AssistAudit, 'capability' | 'reason' | 'model'>> = {}): void =>
    deps.assist.addAudit({ request_id, at: now, capability: more.capability ?? null, status, reason: more.reason ?? null, input_summary: summary, model: more.model ?? null });

  const parsed = AssistRequest.safeParse(input);
  if (!parsed.success) {
    record('SHAPE', '(no valid text)');
    throw new AppError('SHAPE', [{ rule: 'ASSIST', text: 'The request must have one field "text" with 1 to ' + MAX_ASSIST_TEXT + ' characters.' }]);
  }
  const text = parsed.data.text;
  // The audit keeps the length of the text, not the text.
  const summary = 'text of ' + text.length + ' characters';
  const noModel = (status: 'AI_OFF' | 'DAILY_CAP' | 'MODEL_UNAVAILABLE', reason: string | null, model: string | null): AssistResponse => {
    record(status, summary, { reason, model });
    return { request_id, status, message: MESSAGES[status], without_ai: [...WITHOUT_AI] };
  };

  const interpreter = deps.interpreter;
  if (!interpreter) return noModel('AI_OFF', null, null);
  // The call is reserved before it is made. No call left: the model is not asked.
  if (deps.budget.reserve(1) < 1) return noModel('DAILY_CAP', null, null);
  const model = interpreter.model;

  // 1 the model recommends
  const said = await ask(deps, interpreter, text);
  if (said.status === 'CLARIFY') {
    // A question is one text and two to four answers. The port is not trusted: anything else is not an answer.
    const question = typeof said.question === 'string' ? shortText(said.question, 200).trim() : '';
    const options = texts(said.options, 80, 4).map((option) => option.trim()).filter((option) => option !== '');
    if (question === '' || options.length < 2) return noModel('MODEL_UNAVAILABLE', 'NOT_AN_ANSWER', model);
    record('CLARIFY', summary, { model });
    return { request_id, status: 'CLARIFY', question, options };
  }
  if (said.status === 'DECLINE' && typeof said.reason === 'string') {
    record('DECLINED', summary, { model });
    return { request_id, status: 'DECLINED', reason: shortText(said.reason, 300) };
  }
  if (said.status !== 'ACTION') {
    const reason = said.status === 'ERROR' && (said.detail === 'THREW' || said.detail === 'NOT_AN_ANSWER') ? said.detail : shortText(String(said.status), 40);
    return noModel('MODEL_UNAVAILABLE', reason, model);
  }

  // 2 the application validates. The stored audit record has the capability name and the shape of the input:
  // field names, numbers, and the length of each text. A text value can be text of the person, thus it is not kept.
  const gate = checkRequest(said.request, assistChecks(deps), { now, request_id });
  const seen = { capability: gate.audit.capability, model };
  const shape = summariseShape(gate.status === 'PROPOSED' ? gate.input : inputOf(said.request));
  if (gate.status === 'REJECTED') {
    record('REJECTED', shape, { ...seen, reason: gate.reason });
    return { request_id, status: 'REJECTED', capability: gate.audit.capability, reason: gate.reason, problems: gate.problems.map((p) => ({ ...p })) };
  }

  const capability = findCapability(gate.capability);
  if (capability && !gate.needs_approval && !capability.needs_approval && !capability.changes_data) {
    // 4 the application executes: this capability only reads, thus it does not wait for the person.
    const result = await execute({ result: gate, approved_by_person: false }, assistExecutors(deps, gate.consequences));
    if (result.status !== 'EXECUTED') {
      record('FAILED', shape, { ...seen, reason: result.status });
      return { request_id, status: 'FAILED', capability: gate.capability, problems: result.problems };
    }
    record('DONE', shape, seen);
    return { request_id, status: 'DONE', capability: gate.capability, output: result.output ?? {} };
  }

  // 3 the person approves, in a second request. Here the proposal is only stored: the input and the consequences that the person sees.
  const proposal_id = deps.ids('prop');
  const consequences = gate.consequences === null ? null : structuredClone(gate.consequences);
  const description = describe(gate.capability, gate.input, consequences);
  deps.assist.insertProposal({ id: proposal_id, request_id, capability: gate.capability, input: structuredClone(gate.input), consequences, description, created_at: now, status: 'PENDING', outcome: null });
  record('NEEDS_APPROVAL', shape, seen);
  return { request_id, status: 'NEEDS_APPROVAL', proposal_id, capability: gate.capability, description, consequences };
}

/** A plain sentence for the person: what the application does if the person approves. The application writes it, not the model. */
function describe(capability: string, input: object, consequences: object | null): string {
  if (capability === 'recommend_allowance') {
    const text = (consequences as { text?: unknown } | null)?.text;
    return (typeof text === 'string' ? text : 'The free spending amount of this pay cycle changes.') + ' Nothing changes before you approve.';
  }
  if (capability === 'propose_column_mapping') {
    const { batch_id, mapping } = input as { batch_id: string; mapping: Record<string, string | undefined> };
    const columns = ['date', 'description', 'amount', 'debit', 'credit'].flatMap((field) => (mapping[field] === undefined ? [] : [field + ' = "' + shortText(mapping[field], 60) + '"']));
    return 'The import ' + batch_id + ' is read with this mapping: ' + columns.join(', ') + ', dates as ' + mapping.date_format + ', decimal sign "' + mapping.decimal + '". No line is recorded before you decide each line.';
  }
  return 'The application does "' + capability + '" if you approve.';
}
