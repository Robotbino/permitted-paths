// The application service "record an expense". It is the use case, in sequence:
// check the shape, find a replay, read the facts, check the rules, save, calculate the budget.
// It knows the domain and the ports. It does not know HTTP and it does not know SQL.
import { checkShape, type RecordExpenseResult } from '../../shared/contracts.ts';
import type { Clock, IdGen } from '../clock.ts';
import { budgetStatus } from '../domain/budget.ts';
import { periodOf, sameAsStored, toExpense, toProposal } from '../domain/expense.ts';
import { checkRules, onlyNeedsConfirmation } from '../domain/expense-rules.ts';
import { AppError } from '../errors.ts';
import type { Stores } from '../repositories/ports.ts';

export type RecordExpenseDeps = { stores: Stores; clock: Clock; ids: IdGen };

export async function recordExpense(deps: RecordExpenseDeps, input: unknown): Promise<RecordExpenseResult> {
  const { stores, clock, ids } = deps;

  // 1. Shape. Only the request is read.
  const shape = checkShape(input);
  if (!shape.ok) throw new AppError('SHAPE', shape.problems);
  const request = shape.value;
  const proposal = toProposal(request);

  // 2. Replay. The same request key and the same body: answer with the stored expense, record nothing.
  const stored = stores.expenses.findByKey(request.idempotency_key);
  if (stored) {
    if (!sameAsStored(stored, proposal)) {
      throw new AppError('KEY_CONFLICT', [{ rule: 'R8', text: 'This request key already recorded a different expense.' }]);
    }
    return { expense: stored, budget: currentBudget(stores, stored.category_id, periodOf(stored.occurred_on)), replayed: true };
  }

  // 3. Facts and rules. The rules are a pure function of the proposal and the facts.
  const problems = checkRules(
    proposal,
    {
      today: clock.today(),
      category: stores.categories.get(proposal.category_id),
      similar_ids: stores.expenses.findSimilar(proposal.occurred_on, proposal.amount_cents, proposal.merchant_key),
    },
    request.confirm_duplicate === true,
  );
  if (problems.length > 0) throw new AppError(onlyNeedsConfirmation(problems) ? 'NEEDS_CONFIRMATION' : 'RULE', problems);

  // 4. Save. This is the only write.
  const expense = toExpense(proposal, ids('exp'), request.idempotency_key, clock.now());
  stores.expenses.insert(expense);

  // 5. The budget. "Over budget" is a result. It is not an error: the money is already spent.
  return { expense, budget: currentBudget(stores, expense.category_id, periodOf(expense.occurred_on)), replayed: false };
}

function currentBudget(stores: Stores, category_id: string, period: string) {
  const budget = stores.budgets.find(category_id, period);
  return budgetStatus(category_id, period, budget ? budget.limit_cents : null, stores.expenses.sumForCategory(category_id, period));
}
