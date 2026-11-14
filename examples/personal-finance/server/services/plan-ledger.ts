// What the plan service reads from the ledger: the expense rows with the kind and class of their
// category, the income of a cycle, and what each earlier cycle really was.
// These functions only read. They store nothing, thus the history can never be different from the rows.
import type { CategoryKind, Expense, SpendClass } from '../../shared/contracts.ts';
import type { IncomeSource } from '../../shared/contracts.plan.ts';
import { addDays, cycleContaining, previousCycle, type PayCycle } from '../../shared/planning/pay-cycle.ts';
import type { CycleHistory } from '../../shared/planning/plan.ts';
import type { Stores } from '../repositories/ports.ts';

/** A date before each row. Dates are compared as text. */
const FIRST_DAY = '0000-01-01';

/** An expense with the kind and the class of its category. */
export type LedgerRow = Expense & { kind: CategoryKind; class: SpendClass };

export const sumOf = (rows: Array<{ amount_cents: number }>): number => rows.reduce((sum, row) => sum + row.amount_cents, 0);

/** Money that was used. A row of the kind 'savings' or 'transfer' moved money; it is not spending. */
export const isConsumption = (row: LedgerRow): boolean => row.kind === 'consumption';
/** Free spending: the rows that the weekly cap is for. */
export const isFree = (row: LedgerRow): boolean => row.kind === 'consumption' && row.class === 'free';

/**
 * The pay cycle of a date, or null. The calendar of the application has the years 0100 to 9999: a date
 * in the first days of the year 0100 or the last days of the year 9999 is a real date, but its pay
 * cycle starts or ends outside the calendar. A row of the ledger can have such a date.
 */
export function cycleOf(date: string, payday: number): PayCycle | null {
  try {
    return cycleContaining(date, payday);
  } catch {
    return null;
  }
}

/** The pay cycle of a date and the cycle before it, or null if one of the two is outside the calendar. */
export function cycleAndPrevious(date: string, payday: number): { cycle: PayCycle; before: PayCycle } | null {
  try {
    const cycle = cycleContaining(date, payday);
    return { cycle, before: previousCycle(cycle, payday) };
  } catch {
    return null;
  }
}

/** All expense rows up to a date (included), the oldest first, each with the kind and class of its category. */
export function ledgerRowsUpTo(stores: Stores, toInclusive: string): LedgerRow[] {
  const categories = new Map(stores.categories.list().map((c) => [c.id, c]));
  return stores.expenses.listBetween(FIRST_DAY, toInclusive).map((row) => {
    const category = categories.get(row.category_id);
    // The store refuses a row with no category. If one is there, it counts as free spending.
    return { ...row, kind: category?.kind ?? 'consumption', class: category?.class ?? 'free' };
  });
}

/** The income of the cycle, or the income of the most recent earlier cycle that has income, or 0. */
export function incomeOf(stores: Stores, cycle: PayCycle, payday: number): { income_cents: number; income_source: IncomeSource } {
  const now = stores.income.listBetween(cycle.start, cycle.end);
  if (now.length > 0) return { income_cents: sumOf(now), income_source: 'this_cycle' };
  const last = stores.income.listBetween(FIRST_DAY, addDays(cycle.start, -1)).at(-1);
  if (!last) return { income_cents: 0, income_source: 'none' };
  // An income row with a date that has no pay cycle (see cycleOf) is not the income of a cycle.
  const earlier = cycleOf(last.occurred_on, payday);
  if (!earlier) return { income_cents: 0, income_source: 'none' };
  return { income_cents: stores.income.sumBetween(earlier.start, earlier.end), income_source: 'previous_cycle' };
}

/**
 * One entry for each earlier cycle that has an expense row, the oldest first.
 * fixed -> commitments, variable -> variable, free -> unlisted. Only consumption counts.
 * complete = the cycle has ended (by today) AND it has an income row. A cycle with no income row
 * has data that is not all there, and the plan does not use it.
 * A row with a date that has no pay cycle (see cycleOf) is in no entry: it must not stop the plan.
 */
export function historyOf(stores: Stores, earlierRows: LedgerRow[], payday: number, today: string): CycleHistory[] {
  const byCycle = new Map<string, LedgerRow[]>();
  for (const row of earlierRows) {
    const id = cycleOf(row.occurred_on, payday)?.id;
    if (id === undefined) continue;
    byCycle.set(id, [...(byCycle.get(id) ?? []), row]);
  }
  return [...byCycle.keys()].sort().map((cycle_id) => {
    const cycle = cycleContaining(cycle_id, payday);
    const spent = byCycle.get(cycle_id)!.filter(isConsumption);
    const income = stores.income.listBetween(cycle.start, cycle.end);
    return {
      cycle_id,
      complete: cycle.end < today && income.length > 0,
      income_cents: sumOf(income),
      commitments_cents: sumOf(spent.filter((row) => row.class === 'fixed')),
      variable_cents: sumOf(spent.filter((row) => row.class === 'variable')),
      unlisted_cents: sumOf(spent.filter((row) => row.class === 'free')),
    };
  });
}

/** The unlisted amount of the plan: the largest free total of a complete cycle. With no complete cycle it is 0. */
export function unlistedFrom(history: CycleHistory[]): number {
  return history.filter((h) => h.complete).reduce((largest, h) => Math.max(largest, h.unlisted_cents), 0);
}

/** The total of each category. The result has own keys only, also for an id as "constructor". */
export function totalsByCategory(rows: LedgerRow[]): Record<string, number> {
  const totals = new Map<string, number>();
  for (const row of rows) totals.set(row.category_id, (totals.get(row.category_id) ?? 0) + row.amount_cents);
  return Object.fromEntries(totals);
}
