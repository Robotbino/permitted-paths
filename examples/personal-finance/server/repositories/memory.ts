// The stores in memory. Tests use them: they are fast and each test gets a new, empty store.
// The same contract suite runs on these stores and on the SQLite stores.
import type { Budget, Category, Expense } from '../../shared/contracts.ts';
import { monthRange } from '../domain/budget.ts';
import { DuplicateKey } from '../errors.ts';
import type { Stores } from './ports.ts';

export function memoryStores(): Stores {
  const expenses: Expense[] = [];
  const categories = new Map<string, Category>();
  const budgets = new Map<string, Budget>();
  const inPeriod = (e: Expense, period: string) => {
    const { from, before } = monthRange(period);
    return e.occurred_on >= from && e.occurred_on < before;
  };
  return {
    expenses: {
      findByKey: (key) => expenses.find((e) => e.idempotency_key === key) ?? null,
      findSimilar: (occurred_on, amount_cents, merchant_key) =>
        expenses.filter((e) => e.occurred_on === occurred_on && e.amount_cents === amount_cents && e.merchant_key === merchant_key).map((e) => e.id),
      insert(expense) {
        if (expenses.some((e) => e.idempotency_key === expense.idempotency_key)) throw new DuplicateKey();
        expenses.push({ ...expense });
      },
      sumForCategory: (category_id, period) =>
        expenses.filter((e) => e.category_id === category_id && inPeriod(e, period)).reduce((sum, e) => sum + e.amount_cents, 0),
      listRecent: (period, limit) =>
        expenses
          .filter((e) => inPeriod(e, period))
          .sort((a, b) => (a.occurred_on === b.occurred_on ? b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id) : b.occurred_on.localeCompare(a.occurred_on)))
          .slice(0, limit)
          .map((e) => ({ ...e })),
    },
    categories: {
      get: (id) => categories.get(id) ?? null,
      list: () => [...categories.values()].sort((a, b) => a.name.localeCompare(b.name)),
      upsert: (category) => void categories.set(category.id, { ...category }),
    },
    budgets: {
      find: (category_id, period) => budgets.get(category_id + '|' + period) ?? null,
      upsert: (budget) => void budgets.set(budget.category_id + '|' + budget.period, { ...budget }),
    },
  };
}
