// The two deterministic gates. They are not new logic: level 1 already had the check of shape
// (shared/contracts.ts) and the business rules (domain/expense-rules.ts). This file gives them
// their names from the course, and makes one difference visible in the function signatures:
//   Gate 1 gets only the request.                  "Is the shape correct?"
//   Gate 2 gets the proposal and the current facts. "Is it sensible now?"
// An empty list of problems is PASS.
import { checkShape, type Problem } from '../../shared/contracts.ts';
import { isRule } from '../../shared/ontology.ts';
import { toProposal, type ExpenseProposal } from '../domain/expense.ts';
import { checkRules, type ExpenseFacts } from '../domain/expense-rules.ts';

export type Gate1Result = { problems: Problem[]; proposal: ExpenseProposal | null; idempotency_key: string | null; confirmed: boolean; suggest_run_id: string | null };

/** Gate 1: shape. It cannot read the store, because it does not get one. */
export function gate1(request: unknown): Gate1Result {
  const shape = checkShape(request);
  if (!shape.ok) return { problems: named(shape.problems), proposal: null, idempotency_key: null, confirmed: false, suggest_run_id: null };
  return { problems: [], proposal: toProposal(shape.value), idempotency_key: shape.value.idempotency_key, confirmed: shape.value.confirm_duplicate === true, suggest_run_id: shape.value.suggest_run_id ?? null };
}

/** Gate 2: sense. The facts are an argument, thus the same facts always give the same answer. */
export function gate2(proposal: ExpenseProposal, facts: ExpenseFacts, confirmed: boolean): Problem[] {
  return named(checkRules(proposal, facts, confirmed));
}

/** Each problem must name a rule of the ontology. A problem with an unknown rule is a defect of the program. */
function named(problems: Problem[]): Problem[] {
  for (const p of problems) if (!isRule(p.rule)) throw new Error('The problem names the rule "' + p.rule + '", which is not in the ontology.');
  return problems;
}
