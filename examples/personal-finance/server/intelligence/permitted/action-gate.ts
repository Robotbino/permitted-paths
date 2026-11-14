// The action gate: the application checks each request of a model, and only the application executes.
// The request is not trusted. It passes four checks in order, and the first FAIL stops it:
//   1 it is an object with a capability name and an input, and nothing more
//   2 the capability is in the allowlist                              (R15)
//   3 the input has the shape that the capability permits             (R16)
//   4 the application can verify the input against its own facts      (R16, verify.ts)
// A request that passes is only PROPOSED. A change waits for the person (R17), and the caller
// gives the services that execute (R18, execute.ts). This file imports no store and no SDK.
// Each text that came with the request is cleaned and cut before it goes into a problem or the audit.
import type { Problem } from '../../../shared/contracts.ts';
import { auditRecord, nameList, shortText, type AuditRecord } from './audit.ts';
import { CAPABILITY_NAMES, findCapability } from './capabilities.ts';
import { MAX_PROBLEMS, verify, type Checks } from './verify.ts';

export type { AuditRecord } from './audit.ts';
export type { Checks } from './verify.ts';
export { EXECUTE_STATUSES, execute, type ExecuteResult, type Executors } from './execute.ts';

export const GATE_RULES = {
  R15: 'A model can request only a capability of the allowlist',
  R16: 'The application checks each request against its own facts',
  R17: 'A change needs the approval of the person',
  R18: 'Only the application executes',
} as const;

/** What the interpreter gave. It is not trusted. */
export type ModelRequest = unknown;

export const REJECT_REASONS = ['NOT_AN_OBJECT', 'UNKNOWN_CAPABILITY', 'INVALID_INPUT', 'NOT_VERIFIABLE'] as const;
export type RejectReason = (typeof REJECT_REASONS)[number];

/** A result of the gate is frozen: nothing can change the input after the person saw it. */
export type GateResult =
  | Readonly<{ status: 'REJECTED'; reason: RejectReason; problems: Problem[]; audit: AuditRecord }>
  | Readonly<{ status: 'PROPOSED'; capability: string; input: object; needs_approval: boolean; consequences: object | null; audit: AuditRecord }>;

export type GateContext = { now: string; request_id: string };

/** The longest capability name that goes into a problem text or the audit. */
const MAX_NAME = 40;

function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const part of Object.values(value)) deepFreeze(part);
  }
  return value;
}

/** Check 3 found problems. The text names a field; it never repeats a value of the request. */
function shapeProblems(capability: string, issues: ReadonlyArray<{ code?: string; path: PropertyKey[]; message: string; keys?: string[] }>): Problem[] {
  const problems: Problem[] = [];
  for (const issue of issues) {
    const field = shortText(issue.path.map(String).join('.'), 60);
    const text =
      issue.code === 'unrecognized_keys' && issue.keys
        ? 'The input has a field that "' + capability + '" does not permit: ' + nameList(issue.keys) + '.'
        : issue.code === 'custom' && field // the message of a custom issue is a text of inputs.ts
          ? 'The field "' + field + '" of the input is not correct. ' + issue.message
          : field
            ? 'The field "' + field + '" of the input is absent or not correct.'
            : 'The input of "' + capability + '" does not have the correct shape.';
    if (problems.length < MAX_PROBLEMS && !problems.some((p) => p.text === text)) problems.push({ rule: 'R16', text });
  }
  return problems;
}

function check(request: ModelRequest, checks: Checks, ctx: GateContext): GateResult {
  const reject = (reason: RejectReason, problems: Problem[], capability: string | null, input: unknown): GateResult => ({
    status: 'REJECTED',
    reason,
    problems,
    audit: auditRecord(ctx, capability, 'REJECTED', reason, input),
  });

  // 1 the shape of the request itself. A name that was given stays in the audit, also here.
  if (typeof request !== 'object' || request === null || Array.isArray(request)) {
    return reject('NOT_AN_OBJECT', [{ rule: 'R15', text: 'The request is not an object.' }], null, undefined);
  }
  const { capability: name, input } = request as { capability?: unknown; input?: unknown };
  const asked = typeof name === 'string' ? shortText(name, MAX_NAME) : null;
  if (typeof name !== 'string' || !('input' in request)) {
    return reject('NOT_AN_OBJECT', [{ rule: 'R15', text: 'The request must have a capability name and an input.' }], asked, input);
  }
  const extra = Object.keys(request).filter((key) => key !== 'capability' && key !== 'input');
  if (extra.length > 0) {
    const text = 'The request has a field that is not permitted: ' + nameList(extra) + '. A request has only a capability and an input.';
    return reject('NOT_AN_OBJECT', [{ rule: 'R15', text }], asked, input);
  }

  // 2 the allowlist. An unknown name is rejected by name.
  const capability = findCapability(name);
  if (!capability) {
    const text = 'The capability "' + asked + '" is not permitted. The permitted capabilities are: ' + CAPABILITY_NAMES.join(', ') + '.';
    return reject('UNKNOWN_CAPABILITY', [{ rule: 'R15', text }], asked, input);
  }

  // 3 the shape of the input
  const parsed = capability.input.safeParse(input);
  if (!parsed.success) return reject('INVALID_INPUT', shapeProblems(capability.name, parsed.error.issues), capability.name, input);

  // 4 the facts of the application. A check that cannot answer is a FAIL: the value is not trusted.
  const verified = verify(capability.name, parsed.data, checks);
  if (verified.problems.length > 0) return reject('NOT_VERIFIABLE', verified.problems, capability.name, parsed.data);

  return {
    status: 'PROPOSED',
    capability: capability.name,
    input: parsed.data,
    needs_approval: capability.needs_approval,
    consequences: verified.consequences,
    audit: auditRecord(ctx, capability.name, 'PROPOSED', null, parsed.data),
  };
}

/** The four checks. It does not throw: a request that cannot be read is REJECTED. The result is frozen. */
export function checkRequest(request: ModelRequest, checks: Checks, ctx: GateContext): GateResult {
  try {
    return deepFreeze(check(request, checks, ctx));
  } catch {
    const problems: Problem[] = [{ rule: 'R15', text: 'The request could not be read. It is not accepted.' }];
    return deepFreeze({ status: 'REJECTED', reason: 'NOT_AN_OBJECT', problems, audit: auditRecord(ctx, null, 'REJECTED', 'NOT_AN_OBJECT', undefined) });
  }
}
