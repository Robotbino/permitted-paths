// Insights: what the data of a cycle shows, in three parts that stay separate.
// 1. The observation is a fact with numbers. 2. The interpretations are POSSIBLE causes, at least two,
// and one of them is not about the behaviour of the person. 3. The recommendation is an option.
// A detector returns nothing when the data does not support it. No text here judges the person.
import { formatMoney } from '../money.ts';
import { daysBetween, isDate } from './pay-cycle.ts';

export type Insight = { id: string; observation: string; interpretations: string[]; recommendation: string; evidence: Record<string, number | string> };

export type InsightInput = {
  weeks: Array<{ cap_cents: number; spent_cents: number | null }>;
  /** Cents for each day of the cycle. Index 0 is the payday. */
  spend_by_day: number[];
  /** Optional: the number of days of the cycle that have data. Without it, the days up to the last day with spending count. */
  days_observed?: number;
  rows: Array<{ cycle_id: string; merchant_key: string; amount_cents: number; category_id: string }>;
  by_category_now: Record<string, number>;
  by_category_before: Record<string, number>;
  planned_savings_cents: number;
  savings_rows_cents: number;
};

export const WEEKS_WINDOW = 4;
export const WEEKS_OVER_MIN = 3;
export const EARLY_DAYS = 5;
export const EARLY_SHARE_PERCENT = 50;
/** The shortest pay cycle. With fewer days of data the cycle is in progress, and a share of it is not a fact yet. */
export const EARLY_MIN_OBSERVED_DAYS = 28;
export const RECURRING_MIN_CYCLES = 3;
export const CATEGORY_GROWTH_PERCENT = 25;
export const CATEGORY_MIN_GROWTH_CENTS = 20_000;

/** A key from the data, for use in a sentence: no control or direction characters, and 60 characters at most. */
function shown(text: string): string {
  const clean = text.replace(/[\u0000-\u001f\u007f-\u009f\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, ' ');
  return clean.length > 60 ? clean.slice(0, 60) + '...' : clean;
}

function weeksOverCap(input: InsightInput): Insight[] {
  const last = input.weeks.filter((w) => w.spent_cents !== null).slice(-WEEKS_WINDOW);
  const over = last.filter((w) => (w.spent_cents ?? 0) > w.cap_cents).length;
  if (over < WEEKS_OVER_MIN) return [];
  return [{
    id: 'weeks_over_cap',
    observation: over + ' of the last ' + last.length + ' weeks with data were over the weekly cap.',
    interpretations: ['The cap is too low for the real costs of a week.', 'One or more weeks had an unusual cost.', 'Free spending was higher than the plan in these weeks.'],
    recommendation: 'Consider a higher cap with a smaller savings amount, or look at the largest rows of these weeks.',
    evidence: { weeks_over: over, weeks_with_data: last.length },
  }];
}

function earlyCycleShare(input: InsightInput): Insight[] {
  // A day with a refund that is larger than its spending counts as 0: a refund is not spending.
  const days = input.spend_by_day.map((c) => (Number.isSafeInteger(c) && c > 0 ? c : 0));
  // A day with 0 at the end can be a day in the future. The data cannot tell, thus such days do not count without days_observed.
  const observed = Math.min(days.length, input.days_observed ?? days.findLastIndex((c) => c > 0) + 1);
  // Even spending gives 5 of 9 days = 55% on day 9. Only a complete cycle supports the observation.
  if (!(observed >= EARLY_MIN_OBSERVED_DAYS)) return [];
  const total = days.slice(0, observed).reduce((sum, c) => sum + c, 0);
  const early = days.slice(0, EARLY_DAYS).reduce((sum, c) => sum + c, 0);
  if (total <= 0 || early * 100 <= total * EARLY_SHARE_PERCENT) return [];
  const percent = Math.floor((early * 100) / total);
  return [{
    id: 'early_cycle_share',
    observation: formatMoney(early) + ' of ' + formatMoney(total) + ' free spending (' + percent + '%) happened in the first ' + EARLY_DAYS + ' days of the cycle.',
    interpretations: ['Large planned purchases happen soon after payday.', 'A dated cost is in the free spending and not in the commitments.', 'Spending is higher when the balance is high.'],
    recommendation: 'Consider a separate amount for the first week. Is one of these rows a commitment?',
    evidence: { early_cents: early, total_cents: total, share_percent: percent, early_days: EARLY_DAYS },
  }];
}

/** The longest run of cycle ids where each cycle starts 28 to 31 days after the one before it. Of two equal runs, the later one. */
function longestRun(sortedCycleIds: string[]): { length: number; first: string; last: string } {
  let best = { length: 0, first: '', last: '' };
  let run = { length: 0, first: '', last: '' };
  for (const id of sortedCycleIds) {
    const gap = run.length === 0 ? Number.NaN : daysBetween(run.last, id);
    run = gap >= 28 && gap <= 31 ? { length: run.length + 1, first: run.first, last: id } : { length: 1, first: id, last: id };
    if (run.length >= best.length) best = run;
  }
  return best;
}

function recurringCharges(input: InsightInput): Insight[] {
  const groups = new Map<string, { merchant_key: string; amount_cents: number; cycles: Set<string> }>();
  for (const row of input.rows) {
    // A cycle id is the start date of the cycle. A row with a different id cannot be put in order.
    if (!isDate(row.cycle_id)) continue;
    // A refund (below 0) or a row of 0 is not a charge.
    if (!Number.isSafeInteger(row.amount_cents) || row.amount_cents <= 0) continue;
    const key = row.merchant_key + ':' + row.amount_cents;
    const group = groups.get(key) ?? { merchant_key: row.merchant_key, amount_cents: row.amount_cents, cycles: new Set<string>() };
    group.cycles.add(row.cycle_id);
    groups.set(key, group);
  }
  const insights: Insight[] = [];
  for (const [key, group] of groups) {
    const run = longestRun([...group.cycles].sort());
    if (run.length < RECURRING_MIN_CYCLES) continue;
    insights.push({
      id: 'recurring_charges:' + key,
      // The cycles are in the text: a run that ended long ago must not read as a charge of today.
      observation: 'The merchant "' + shown(group.merchant_key) + '" charged ' + formatMoney(group.amount_cents) + ' in ' + run.length + ' consecutive cycles (' + run.first + ' to ' + run.last + ').',
      interpretations: ['This is a subscription or a debit order.', 'This is a regular purchase that has the same price each time.', 'The merchant still charges for a plan that was cancelled.'],
      recommendation: 'Consider this charge as a commitment in the plan. Is it still in use?',
      evidence: { merchant_key: group.merchant_key, amount_cents: group.amount_cents, consecutive_cycles: run.length, first_cycle_id: run.first, last_cycle_id: run.last },
    });
  }
  return insights;
}

function categoryChange(input: InsightInput): Insight[] {
  const insights: Insight[] = [];
  for (const category_id of Object.keys(input.by_category_now).sort()) {
    // Only a key of the record itself counts. "constructor" and "toString" are on each object, and they are not amounts.
    const own = (record: Record<string, number>): number => {
      const value: unknown = Object.hasOwn(record, category_id) ? record[category_id] : 0;
      return typeof value === 'number' && Number.isSafeInteger(value) ? value : 0;
    };
    const now = own(input.by_category_now);
    const before = own(input.by_category_before);
    const growth = now - before;
    // With no amount in the previous cycle there is nothing to compare with.
    if (before <= 0 || growth < CATEGORY_MIN_GROWTH_CENTS || growth * 100 <= before * CATEGORY_GROWTH_PERCENT) continue;
    const percent = Math.floor((growth * 100) / before);
    insights.push({
      id: 'category_change:' + category_id,
      observation: 'The category "' + shown(category_id) + '" is ' + formatMoney(now) + ' in this cycle. It was ' + formatMoney(before) + ' in the previous cycle (' + percent + '% more).',
      interpretations: ['An unusual cost is in this category in this cycle.', 'Some rows have a wrong category.', 'Prices or the quantity went up.'],
      recommendation: 'Consider a look at the largest rows of this category. Is the change for one cycle only?',
      evidence: { category_id, now_cents: now, before_cents: before, growth_cents: growth, growth_percent: percent },
    });
  }
  return insights;
}

function savingsNotMoved(input: InsightInput): Insight[] {
  if (input.planned_savings_cents <= 0 || input.savings_rows_cents > 0) return [];
  // A sum below 0 is not "no row": rows exist, and more came out of savings than went in.
  const rows = input.savings_rows_cents < 0
    ? 'the savings rows of this cycle add up to ' + formatMoney(input.savings_rows_cents) + '.'
    : 'no savings row is on record in this cycle.';
  return [{
    id: 'savings_not_moved',
    observation: 'The plan has ' + formatMoney(input.planned_savings_cents) + ' for savings, and ' + rows,
    interpretations: ['The transfer has not happened yet.', 'The transfer happened and its row has a different category.', 'The savings account is not in the imported data.'],
    recommendation: 'Consider the transfer on the day after payday. Is a row of this cycle the savings transfer?',
    evidence: { planned_savings_cents: input.planned_savings_cents, savings_rows_cents: input.savings_rows_cents },
  }];
}

/** All detectors, in a fixed order. */
export function insightsFor(input: InsightInput): Insight[] {
  return [...weeksOverCap(input), ...earlyCycleShare(input), ...recurringCharges(input), ...categoryChange(input), ...savingsNotMoved(input)];
}
