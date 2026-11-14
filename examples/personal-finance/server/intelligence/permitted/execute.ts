// The last step: only the application executes (R18), and a change waits for the person (R17).
// The model is not here: only a result of the gate, the answer of the person, and the services
// of the application, which the caller gives. This file imports no store and no SDK.
// execute does not trust the result that it gets. It asks the allowlist again, it checks the
// shape of the input again, and it executes one result one time. It does not ask the facts of the
// application again: a caller that kept a request for a long time gives it to checkRequest again.
import type { Problem } from '../../../shared/contracts.ts';
import type { GateResult } from './action-gate.ts';
import { shortText } from './audit.ts';
import { findCapability } from './capabilities.ts';

export const EXECUTE_STATUSES = ['EXECUTED', 'NOT_APPROVED', 'NOT_PROPOSED', 'NO_EXECUTOR', 'FAILED'] as const;
export type ExecuteResult = { status: (typeof EXECUTE_STATUSES)[number]; output: object | null; problems: Problem[] };

/** The services of the application, by capability name. The caller gives them. */
export type Executors = Record<string, (input: object) => Promise<object>>;

// The results that an executor got. The same result (the same object) is not executed two times.
// A copy of a result is a different object: the service of the application has its own protection
// against a second run (an idempotency key), as each write of this application has.
const executed = new WeakSet<object>();

const stop = (status: ExecuteResult['status'], rule: string, text: string): ExecuteResult => ({ status, output: null, problems: [{ rule, text }] });

/**
 * Executes a PROPOSED result. It does not throw: each stop is a value.
 * A REJECTED result can never be executed. An executor that throws gives FAILED, and the result
 * can be given again.
 */
export async function execute(approved: { result: GateResult; approved_by_person: boolean }, executors: Executors): Promise<ExecuteResult> {
  const result: unknown = typeof approved === 'object' && approved !== null ? approved.result : null;
  if (typeof result !== 'object' || result === null) return stop('NOT_PROPOSED', 'R18', 'There is no result of the gate. Nothing is executed.');
  const { status, capability: name, input, needs_approval } = result as { status?: unknown; capability?: unknown; input?: unknown; needs_approval?: unknown };
  if (status !== 'PROPOSED') return stop('NOT_PROPOSED', 'R18', 'The gate rejected this request. A rejected request is never executed.');
  // The allowlist is asked again: a result that did not come from the gate gets nothing here.
  const capability = typeof name === 'string' ? findCapability(name) : null;
  if (!capability) return stop('NOT_PROPOSED', 'R15', 'The capability "' + shortText(String(name), 40) + '" is not permitted.');
  if ((capability.needs_approval || needs_approval !== false) && approved.approved_by_person !== true) {
    return stop('NOT_APPROVED', 'R17', 'The action "' + capability.name + '" waits for the approval of the person.');
  }
  // The shape is checked again: a result that was made or changed outside the gate cannot bring a different input.
  const parsed = capability.input.safeParse(input);
  if (!parsed.success) return stop('NOT_PROPOSED', 'R16', 'The input of "' + capability.name + '" is not an input that the gate accepts. Nothing is executed.');
  const executor = typeof executors === 'object' && executors !== null && Object.hasOwn(executors, capability.name) ? executors[capability.name] : undefined;
  if (typeof executor !== 'function') return stop('NO_EXECUTOR', 'R18', 'The application has no service for "' + capability.name + '".');
  if (executed.has(result)) return stop('NOT_PROPOSED', 'R18', 'This proposal was executed before. A proposal is executed one time.');
  executed.add(result);
  try {
    const output: unknown = await executor(parsed.data);
    return { status: 'EXECUTED', output: typeof output === 'object' && output !== null ? output : null, problems: [] };
  } catch {
    executed.delete(result);
    return stop('FAILED', 'R18', 'The service for "' + capability.name + '" did not complete. Try again, or do the step by hand.');
  }
}
