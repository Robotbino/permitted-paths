// The application service "show one month". It only reads.
import type { MonthSummary } from '../../shared/contracts.ts';
import { budgetStatus, isPeriod } from '../domain/budget.ts';
import { AppError } from '../errors.ts';
import type { Stores } from '../repositories/ports.ts';

export function monthSummary(stores: Stores, period: string): MonthSummary {
  if (!isPeriod(period)) throw new AppError('BAD_REQUEST', [{ rule: 'R3', text: 'The month must have the form YYYY-MM.' }]);
  const categories = stores.categories
    .list()
    .filter((c) => c.active)
    .map((category) => {
      const budget = stores.budgets.find(category.id, period);
      const spent = stores.expenses.sumForCategory(category.id, period);
      return { category, budget: budgetStatus(category.id, period, budget ? budget.limit_cents : null, spent) };
    });
  return {
    period,
    total_spent_cents: categories.reduce((sum, c) => sum + c.budget.spent_cents, 0),
    categories,
    recent: stores.expenses.listRecent(period, 10),
  };
}
