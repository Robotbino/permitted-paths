// The application service "show the plan of one pay cycle". It only reads.
// It puts together what the person told the application (settings, commitments, pots) and what the
// ledger shows (income, expenses), and it gives them to the pure functions of shared/planning.
// Each figure of the view is calculated here from stored rows. Nothing of the view is stored.
import type { Problem } from '../../shared/contracts.ts';
import type { PlanView, SavingsView, WeeksView, WeekView } from '../../shared/contracts.plan.ts';
import { formatMoney } from '../../shared/money.ts';
import { insightsFor } from '../../shared/planning/insights.ts';
import { daysBetween, isDate, type PayCycle } from '../../shared/planning/pay-cycle.ts';
import { buildPlan, checkPlanInput, paceOf, savingsHeld, weekStatus, type Plan, type PlanInput } from '../../shared/planning/plan.ts';
import type { Clock } from '../clock.ts';
import { AppError } from '../errors.ts';
import type { Stores } from '../repositories/ports.ts';
import { cycleAndPrevious, cycleOf, historyOf, incomeOf, isConsumption, isFree, ledgerRowsUpTo, sumOf, totalsByCategory, unlistedFrom, type LedgerRow } from './plan-ledger.ts';

export type PlanCycleDeps = { stores: Stores; clock: Clock };

const refuse = (code: 'BAD_REQUEST' | 'NOT_FOUND' | 'RULE', rule: string, text: string): never => {
  throw new AppError(code, [{ rule, text } satisfies Problem]);
};

/** The date in the cycle that has this day of the month. A day from the payday on is in the first month of the cycle. */
function dueOn(cycle: PayCycle, due_day: number, payday: number): string {
  const year = Number(cycle.start.slice(0, 4));
  const month = Number(cycle.start.slice(5, 7)) + (due_day >= payday ? 0 : 1);
  const [y, m] = month > 12 ? [year + 1, 1] : [year, month];
  return String(y).padStart(4, '0') + '-' + String(m).padStart(2, '0') + '-' + String(due_day).padStart(2, '0');
}

/** The plan view of the cycle that contains the date. Without a date: the cycle of today. */
export function planCycle(deps: PlanCycleDeps, date?: string): PlanView {
  const { stores } = deps;
  const today = deps.clock.today();
  if (date !== undefined && !isDate(date)) refuse('BAD_REQUEST', 'R3', 'The date must be a real calendar date in the form YYYY-MM-DD.');
  const settings = stores.plan.getSettings() ?? refuse('NOT_FOUND', 'BR1', 'No plan settings are on record.');
  const payday = settings.payday;
  if (!Number.isInteger(payday) || payday < 1 || payday > 28) refuse('RULE', 'BR1', 'The payday must be a day of the month from 1 to 28.');
  // A real date can have a pay cycle that starts or ends outside the calendar (years 0100 to 9999): an answer, not a defect.
  const { cycle, before } = cycleAndPrevious(date ?? today, payday) ?? refuse('BAD_REQUEST', 'R3', 'The pay cycle of this date is outside the calendar of the application (the years 0100 to 9999).');

  const rows = ledgerRowsUpTo(stores, cycle.end);
  const earlier = rows.filter((row) => row.occurred_on < cycle.start);
  const current = rows.filter((row) => row.occurred_on >= cycle.start);
  const history = historyOf(stores, earlier, payday, today);
  const { income_cents, income_source } = incomeOf(stores, cycle, payday);

  const input: PlanInput = {
    cycle,
    income_cents,
    commitments: stores.plan.listCommitments().filter((c) => c.active).map((c) => ({
      id: c.id, name: c.name, amount_cents: c.amount_cents, due_on: dueOn(cycle, c.due_day, payday), account: c.account, ...(c.pay_to_person ? { pay_to_person: true } : {}),
    })),
    variable_living_cents: settings.variable_living_cents,
    unlisted_cents: unlistedFrom(history),
    pots: stores.plan.listPots().filter((p) => p.active).map((p) => ({ id: p.id, name: p.name, priority: p.priority, target_cents: p.target_cents })),
    savings_request_cents: settings.savings_request_cents,
    history,
    buffer_items: settings.buffer_items,
    ...(settings.card_account !== null ? { card_account: settings.card_account } : {}),
  };
  const base = { today, cycle, income_cents, income_source, input };

  const input_problems = checkPlanInput(input);
  if (input_problems.length > 0) {
    const n = input_problems.length;
    const headline = 'The plan of the cycle ' + cycle.start + ' to ' + cycle.end + ' cannot be made: the input has ' + n + (n === 1 ? ' problem.' : ' problems.');
    return { ...base, input_problems, plan: null, weeks: [], pace: paceOf([]), savings: null, insights: [], headline };
  }
  const plan = buildPlan(input);

  // A block that has not started (by today) has no data: null, not 0.
  const free = current.filter(isFree);
  const weeks: WeekView[] = plan.weeks.map((block) => {
    const spent_cents = block.start > today ? null : sumOf(free.filter((row) => row.occurred_on >= block.start && row.occurred_on <= block.end));
    return { ...block, spent_cents, status: spent_cents === null ? null : weekStatus(block.cap_cents, spent_cents) };
  });
  const moved_cents = sumOf(current.filter((row) => row.kind === 'savings'));
  const savings: SavingsView = { planned_cents: plan.sizing.chosen_cents, moved_cents, ...savingsHeld(plan.sizing.chosen_cents, moved_cents) };

  const spend_by_day = new Array<number>(cycle.days).fill(0);
  for (const row of free) spend_by_day[daysBetween(cycle.start, row.occurred_on)]! += row.amount_cents;
  const insights = insightsFor({
    weeks,
    spend_by_day,
    // The days of the cycle that are not in the future.
    days_observed: Math.max(0, Math.min(cycle.days, daysBetween(cycle.start, today) + 1)),
    // A row with a date that has no pay cycle is not in the comparison of cycles.
    rows: rows.filter(isConsumption).flatMap((row) => {
      const cycle_id = cycleOf(row.occurred_on, payday)?.id;
      return cycle_id === undefined ? [] : [{ cycle_id, merchant_key: row.merchant_key, amount_cents: row.amount_cents, category_id: row.category_id }];
    }),
    by_category_now: totalsByCategory(current.filter(isConsumption)),
    by_category_before: totalsByCategory(earlier.filter((row) => isConsumption(row) && row.occurred_on >= before.start)),
    planned_savings_cents: savings.planned_cents,
    savings_rows_cents: moved_cents,
  });
  return { ...base, input_problems, plan, weeks, pace: paceOf(weeks), savings, insights, headline: headlineOf(cycle, plan, weeks, savings) };
}

/**
 * One factual sentence or two. Spending under the caps is not enough for "on track": the money is
 * only still in the account. The headline says "on track" only if the savings really moved (savings.held).
 */
function headlineOf(cycle: PayCycle, plan: Plan, weeks: WeekView[], savings: SavingsView): string {
  const spent = weeks.reduce((sum, w) => sum + (w.spent_cents ?? 0), 0);
  const fact = 'Cycle ' + cycle.start + ' to ' + cycle.end + ': free spending is ' + formatMoney(spent) + ' of ' + formatMoney(plan.discretionary_cents) + '.';
  if (!savings.held) return fact + ' ' + savings.text;
  const over = weeks.filter((w) => w.status === 'OVER').length;
  if (over > 0) return fact + ' ' + over + (over === 1 ? ' week is' : ' weeks are') + ' over the weekly cap.';
  if (savings.planned_cents <= 0) return fact + ' ' + savings.text;
  return fact + ' The savings moved and no week is over its cap: the cycle is on track.';
}

/** Only the weeks, the pace and the savings of the plan view. */
export function weeksOfCycle(deps: PlanCycleDeps, date?: string): WeeksView {
  const { cycle, weeks, pace, savings } = planCycle(deps, date);
  return { cycle, weeks, pace, savings };
}
