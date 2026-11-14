// The ports of the persistence layer. A service knows only these interfaces.
// It does not know if the data is in memory (tests) or in SQLite (the application).
// The methods are synchronous, because the two implementations are local.
// A store on a network makes them asynchronous: that is a reason to design this file again.
import type { Budget, Category, Expense } from '../../shared/contracts.ts';

export interface ExpenseStore {
  findByKey(idempotency_key: string): Expense | null;
  /** Ids of expenses with the same date, amount and merchant (rule R7). */
  findSimilar(occurred_on: string, amount_cents: number, merchant_key: string): string[];
  /** Adds one expense. Throws DuplicateKey if the request key is already in the store. Expenses are never changed. */
  insert(expense: Expense): void;
  /** The sum of the expenses of one category in one month. This is the only source of "spent". */
  sumForCategory(category_id: string, period: string): number;
  listRecent(period: string, limit: number): Expense[];
}

export interface CategoryStore {
  get(id: string): Category | null;
  list(): Category[];
  upsert(category: Category): void;
}

export interface BudgetStore {
  find(category_id: string, period: string): Budget | null;
  upsert(budget: Budget): void;
}

export type Stores = {
  expenses: ExpenseStore;
  categories: CategoryStore;
  budgets: BudgetStore;
};
