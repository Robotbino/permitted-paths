// Demonstration data. All of it is fictional. The slice does not include screens that
// make a category or a budget, thus the seed puts them into the store.
import type { Stores } from './ports.ts';

export const DEMO_CATEGORIES = [
  { id: 'groceries', name: 'Groceries', limit_cents: 450_000 },
  { id: 'transport', name: 'Transport', limit_cents: 180_000 },
  { id: 'eating-out', name: 'Eating out', limit_cents: 120_000 },
  { id: 'utilities', name: 'Utilities', limit_cents: 250_000 },
  { id: 'health', name: 'Health', limit_cents: 90_000 },
  { id: 'entertainment', name: 'Entertainment', limit_cents: null }, // a category with no budget
] as const;

/** Puts the categories into the store, and a budget for each category for the given month. Safe to run again. */
export function seed(stores: Stores, period: string): void {
  for (const c of DEMO_CATEGORIES) {
    stores.categories.upsert({ id: c.id, name: c.name, active: true });
    if (c.limit_cents !== null && !stores.budgets.find(c.id, period)) {
      stores.budgets.upsert({ id: 'bud_' + c.id + '_' + period, category_id: c.id, period, limit_cents: c.limit_cents, currency: 'ZAR' });
    }
  }
  // An old category that is no more in use. It shows rule R6: a category must be active.
  stores.categories.upsert({ id: 'gym', name: 'Gym (closed)', active: false });
}
