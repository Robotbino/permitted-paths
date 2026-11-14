// Check 4 of the action gate: the application verifies the input against its own facts (R16).
// The gate asks through Checks; it does not read a store itself.
// An answer of a check is also not trusted without a look: only the exact value true is a yes.
// A promise, a text, an absent value or a thrown error is "the application cannot verify", and
// that is a FAIL. A value that the application cannot verify is rejected, not trusted.
import type { Problem } from '../../../shared/contracts.ts';
import { shortText } from './audit.ts';
import type { CapabilityName, ColumnMapping } from './capabilities.ts';

/** The facts of the application. Each answer comes now, not later: a check does not return a promise. */
export type Checks = {
  categoryExists(id: string): boolean;
  batchExists(id: string): boolean;
  /** Tries the mapping on the lines of the batch. An empty list is PASS. */
  mappingDryRun(batch_id: string, mapping: ColumnMapping): Problem[];
  /** The application calculates what the change does, in cents. The model gives only the percentage. */
  allowanceConsequences(change_percent: number): { ok: boolean; problems: Problem[]; consequences: object };
};

export type Verified = { problems: Problem[]; consequences: object | null };

/** The largest number of problems of one check that the gate gives on, and the longest text of one. */
export const MAX_PROBLEMS = 10;
export const MAX_PROBLEM_TEXT = 300;

const CANNOT_VERIFY: Problem = { rule: 'R16', text: 'The application could not verify the request. It is not accepted.' };
const fail = (text?: string): Verified => ({ problems: [text === undefined ? CANNOT_VERIFY : { rule: 'R16', text }], consequences: null });
const PASS: Verified = { problems: [], consequences: null };

/** A promise that fails later must not stop the program: nobody waits for it. */
function seen<T>(answer: T): T {
  if (typeof answer === 'object' && answer !== null && typeof (answer as { then?: unknown }).then === 'function') Promise.resolve(answer).catch(() => undefined);
  return answer;
}

/** A list of problems from a check, cleaned and limited. null: the answer is not a list of problems. */
function problemList(answer: unknown): Problem[] | null {
  if (!Array.isArray(answer)) return null;
  const problems: Problem[] = [];
  for (const item of answer.slice(0, MAX_PROBLEMS)) {
    if (typeof item !== 'object' || item === null || typeof item.rule !== 'string' || typeof item.text !== 'string') return null;
    problems.push({ rule: shortText(item.rule, 40), text: shortText(item.text, MAX_PROBLEM_TEXT) });
  }
  if (answer.length > MAX_PROBLEMS) problems.push({ rule: 'R16', text: 'And ' + (answer.length - MAX_PROBLEMS) + ' more problems.' });
  return problems;
}

/** true gives PASS, false gives the text, and each other answer is "cannot verify". */
function yesOrNo(answer: unknown, textOfNo: string): Verified {
  return answer === true ? PASS : answer === false ? fail(textOfNo) : fail();
}

function verifyNow(capability: CapabilityName, input: any, checks: Checks): Verified {
  if (capability === 'analyse_spending') {
    if (input.category_id === undefined) return PASS;
    return yesOrNo(seen(checks.categoryExists(input.category_id)), 'The category "' + shortText(input.category_id, 40) + '" is not a category of the store.');
  }
  if (capability === 'propose_column_mapping') {
    const batch = yesOrNo(seen(checks.batchExists(input.batch_id)), 'The import batch "' + shortText(input.batch_id, 64) + '" is not in the store.');
    if (batch.problems.length > 0) return batch;
    const problems = problemList(seen(checks.mappingDryRun(input.batch_id, input.mapping)));
    return problems === null ? fail() : { problems, consequences: null };
  }
  if (capability === 'recommend_allowance') {
    const answer: unknown = seen(checks.allowanceConsequences(input.change_percent));
    if (typeof answer !== 'object' || answer === null) return fail();
    const { ok, problems: given, consequences } = answer as { ok?: unknown; problems?: unknown; consequences?: unknown };
    const problems = problemList(given);
    if (problems === null || typeof ok !== 'boolean') return fail();
    if (problems.length > 0) return { problems, consequences: null };
    if (!ok) return fail('The application cannot calculate the consequences of this change.');
    if (typeof consequences !== 'object' || consequences === null || Array.isArray(consequences)) return fail();
    // A copy: a later change of the object of the application does not change what the person saw.
    return { problems: [], consequences: structuredClone(consequences) };
  }
  // suggest_category has no fact to verify here: the suggest graph has its own gate (R12).
  return capability === 'suggest_category' ? PASS : fail();
}

/** Check 4. It does not throw: a check that throws, or that is absent, gives a FAIL. */
export function verify(capability: CapabilityName, input: object, checks: Checks): Verified {
  try {
    return verifyNow(capability, input, checks);
  } catch {
    return fail();
  }
}
