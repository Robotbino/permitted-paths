// Demonstration data. All of it is fictional. The slice does not include screens that
// make a category or a budget, thus the seed puts them into the store.
import type { Category } from '../../shared/contracts.ts';
import { example } from '../../shared/planning/plan-example.ts';
import type { Stores } from './ports.ts';

type DemoCategory = Pick<Category, 'id' | 'name' | 'kind' | 'class'> & { limit_cents: number | null };

// kind: what an entry is. class: a dated commitment (fixed), a planned essential (variable) or free spending.
export const DEMO_CATEGORIES: readonly DemoCategory[] = [
  { id: 'groceries', name: 'Groceries', kind: 'consumption', class: 'variable', limit_cents: 450_000 },
  { id: 'transport', name: 'Transport', kind: 'consumption', class: 'variable', limit_cents: 180_000 },
  { id: 'eating-out', name: 'Eating out', kind: 'consumption', class: 'free', limit_cents: 120_000 },
  { id: 'utilities', name: 'Utilities', kind: 'consumption', class: 'fixed', limit_cents: 250_000 },
  { id: 'health', name: 'Health', kind: 'consumption', class: 'variable', limit_cents: 90_000 },
  { id: 'entertainment', name: 'Entertainment', kind: 'consumption', class: 'free', limit_cents: null }, // a category with no budget
  { id: 'rent', name: 'Rent', kind: 'consumption', class: 'fixed', limit_cents: null },
  // Money that goes to a savings pot, and a move between two own accounts. They are not spending.
  { id: 'savings', name: 'Savings', kind: 'savings', class: 'free', limit_cents: null },
  { id: 'own-transfer', name: 'Transfer between own accounts', kind: 'transfer', class: 'free', limit_cents: null },
];

/** Puts the categories into the store, and a budget for each category for the given month. Safe to run again. */
export function seed(stores: Stores, period: string): void {
  for (const c of DEMO_CATEGORIES) {
    stores.categories.upsert({ id: c.id, name: c.name, active: true, kind: c.kind, class: c.class });
    if (c.limit_cents !== null && !stores.budgets.find(c.id, period)) {
      stores.budgets.upsert({ id: 'bud_' + c.id + '_' + period, category_id: c.id, period, limit_cents: c.limit_cents, currency: 'ZAR' });
    }
  }
  // An old category that is no more in use. It shows rule R6: a category must be active.
  stores.categories.upsert({ id: 'gym', name: 'Gym (closed)', active: false, kind: 'consumption', class: 'free' });
  seedPlan(stores);
}

/**
 * The plan of the fictional person Sam, who is paid on day 25. The numbers are those of the worked example
 * (shared/planning/plan-example.ts). It goes in only if no settings are on record, thus it never replaces
 * what a person entered. It adds no income and no expense: those are rows of the ledger.
 */
export function seedPlan(stores: Stores): void {
  if (stores.plan.getSettings() !== null) return;
  const sam = example();
  for (const c of sam.commitments) {
    stores.plan.upsertCommitment({ id: c.id, name: c.name, amount_cents: c.amount_cents, due_day: Number(c.due_on.slice(8, 10)), account: c.account, pay_to_person: c.pay_to_person === true, active: true });
  }
  for (const pot of sam.pots) stores.plan.upsertPot({ ...pot, active: true });
  stores.plan.setSettings({
    payday: Number(sam.cycle.start.slice(8, 10)),
    variable_living_cents: sam.variable_living_cents,
    savings_request_cents: sam.savings_request_cents,
    card_account: sam.card_account ?? null,
    buffer_items: sam.buffer_items,
  });
}
