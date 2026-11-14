// The budget: pure functions. The spent amount is an input here; the store calculates it from the expenses.
import type { BudgetStatus } from '../../shared/contracts.ts';

/** NEAR starts at 80% of the limit. Integer arithmetic only. */
export const NEAR_PERCENT = 80;

export function budgetStatus(category_id: string, period: string, limit_cents: number | null, spent_cents: number): BudgetStatus {
  if (limit_cents === null) {
    return { category_id, period, state: 'NO_BUDGET', limit_cents: null, spent_cents, remaining_cents: null };
  }
  const state = spent_cents > limit_cents ? 'OVER' : spent_cents * 100 >= limit_cents * NEAR_PERCENT ? 'NEAR' : 'WITHIN';
  return { category_id, period, state, limit_cents, spent_cents, remaining_cents: limit_cents - spent_cents };
}

/** The first day of a month and the first day of the subsequent month: ["2026-12-01", "2027-01-01"). */
export function monthRange(period: string): { from: string; before: string } {
  const year = Number(period.slice(0, 4));
  const month = Number(period.slice(5, 7));
  const next = month === 12 ? year + 1 + '-01' : year + '-' + String(month + 1).padStart(2, '0');
  return { from: period + '-01', before: next + '-01' };
}

export function isPeriod(text: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(text);
}
