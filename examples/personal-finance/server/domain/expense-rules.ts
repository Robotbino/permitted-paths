// The business rules of an expense. These are rules of sense: the shape is already correct,
// and the question is "is this request sensible against the facts that the store has now?".
// The function is pure. The caller reads the facts and gives them to it.
import type { Category, Problem } from '../../shared/contracts.ts';
import type { ExpenseProposal } from './expense.ts';

/** The facts that the rules read. Nothing else is permitted to influence the result. */
export type ExpenseFacts = {
  today: string;
  category: Category | null;
  /** The ids of stored expenses with the same date, amount and merchant. */
  similar_ids: string[];
};

export function checkRules(proposal: ExpenseProposal, facts: ExpenseFacts, confirmed_duplicate: boolean): Problem[] {
  const problems: Problem[] = [];
  // Dates are YYYY-MM-DD, thus a string comparison is a date comparison.
  if (proposal.occurred_on > facts.today) {
    problems.push({ rule: 'R5', text: 'The date ' + proposal.occurred_on + ' is after today (' + facts.today + ').' });
  }
  if (!facts.category) {
    problems.push({ rule: 'R6', text: 'The category "' + proposal.category_id + '" is not in the store.' });
  } else if (!facts.category.active) {
    problems.push({ rule: 'R6', text: 'The category "' + facts.category.name + '" is not active.' });
  }
  if (facts.similar_ids.length > 0 && !confirmed_duplicate) {
    problems.push({ rule: 'R7', text: 'An expense with the same date, amount and merchant is already recorded. Confirm to record a second one.' });
  }
  return problems;
}

/** Rule R7 alone is not an error of the person. It is a question to the person. */
export function onlyNeedsConfirmation(problems: Problem[]): boolean {
  return problems.length > 0 && problems.every((p) => p.rule === 'R7');
}
