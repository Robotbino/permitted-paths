// The pace of a cycle: how the spending of each week compares with its cap, and if the savings really left.
// Rule BR8: nothing carries over. A quiet week does not make the next cap larger, and a heavy week
// does not make it smaller. The cumulative number is information only.
import { formatMoney } from '../money.ts';

export const WEEK_STATES = ['OK', 'NEAR', 'OVER'] as const;
export type WeekState = (typeof WEEK_STATES)[number];

/** OVER when spent > cap. NEAR when less than nearPercent of the cap is left. Integer arithmetic only. */
export function weekStatus(cap_cents: number, spent_cents: number, nearPercent = 20): WeekState {
  if (spent_cents > cap_cents) return 'OVER';
  return (cap_cents - spent_cents) * 100 < cap_cents * nearPercent ? 'NEAR' : 'OK';
}

export type Pace = { per_week: Array<{ variance_cents: number | null }>; cumulative_cents: number };

/**
 * variance = cap - spent: a positive number is under the cap, a negative number is over it.
 * A week with no data has a variance of null. It counts as 0 in the sum and it is not a judgement.
 */
export function paceOf(weeks: Array<{ cap_cents: number; spent_cents: number | null }>): Pace {
  const per_week = weeks.map((w) => ({ variance_cents: w.spent_cents === null ? null : w.cap_cents - w.spent_cents }));
  const cumulative_cents = per_week.reduce((sum, w) => sum + (w.variance_cents ?? 0), 0);
  return { per_week, cumulative_cents };
}

/**
 * The plan held only if the savings really left the main account.
 * Spending under the caps while the savings never moved is not "under budget": the money is only still there.
 */
export function savingsHeld(planned_cents: number, savings_rows_cents: number): { held: boolean; text: string } {
  if (planned_cents <= 0) return { held: true, text: 'The plan had no savings for this cycle.' };
  if (savings_rows_cents >= planned_cents) {
    return { held: true, text: formatMoney(savings_rows_cents) + ' moved to savings. The plan was ' + formatMoney(planned_cents) + '.' };
  }
  if (savings_rows_cents < 0) {
    // A sum below 0 is not "no row": rows exist, and more money came out of savings than went in.
    return {
      held: false,
      text: 'The plan was ' + formatMoney(planned_cents) + '. The savings rows of this cycle add up to ' + formatMoney(savings_rows_cents) + ': more came out of savings than went in.',
    };
  }
  if (savings_rows_cents === 0) {
    return {
      held: false,
      text: 'The plan was ' + formatMoney(planned_cents) + ' and no savings row is on record. Money that is under the caps is not saved until it moves.',
    };
  }
  return {
    held: false,
    text: formatMoney(savings_rows_cents) + ' of the planned ' + formatMoney(planned_cents) + ' moved to savings. '
      + formatMoney(planned_cents - savings_rows_cents) + ' has not moved yet.',
  };
}
