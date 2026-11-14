// The payday plan. On payday the person wants to know what to move, how much and when.
// buildPlan is one pure function: the same input gives the same plan, and each number in the plan
// comes from a line that the person can read. The parts are in plan-sizing.ts, plan-moves.ts and pace.ts.
// Rules: BR1 pay cycle, BR2 headroom order, BR3 payday order, BR4 sizing, BR5 priority,
// BR6 buffer from named items, BR7 weekly cap, BR8 no carry-over.
import { formatMoney } from '../money.ts';
import { assertPlanInput } from './plan-check.ts';
import { buildMoves, moveDay, weeklyCaps } from './plan-moves.ts';
import { sizeSavings, splitByPriority } from './plan-sizing.ts';
import type { ArithmeticLine, Plan, PlanInput, PlanWarning } from './plan-types.ts';

export type * from './plan-types.ts';
export { MOVE_KINDS } from './plan-types.ts';
export { checkPlanInput } from './plan-check.ts';
export { WEEK_STATES, paceOf, savingsHeld, weekStatus, type Pace, type WeekState } from './pace.ts';

/** The plan of one pay cycle. An input with a problem (see checkPlanInput) is refused with a RangeError. */
export function buildPlan(input: PlanInput): Plan {
  assertPlanInput(input);
  const commitments_cents = input.commitments.reduce((sum, c) => sum + c.amount_cents, 0);
  const buffer_cents = input.buffer_items.reduce((sum, b) => sum + b.amount_cents, 0);

  // Rule BR2: the order of the subtractions is fixed, and each one is a line.
  const arithmetic: ArithmeticLine[] = [];
  let running = input.income_cents;
  arithmetic.push({ label: 'Income', amount_cents: input.income_cents, running_cents: running });
  const minus = (label: string, amount_cents: number): void => {
    running -= amount_cents;
    arithmetic.push({ label, amount_cents, running_cents: running });
  };
  minus('Minus commitments', commitments_cents);
  minus('Minus variable living', input.variable_living_cents);
  minus('Minus unlisted spending', input.unlisted_cents);
  minus('Minus buffer = headroom', buffer_cents);

  const headroom_cents = running;
  const naive_headroom_cents = headroom_cents + input.unlisted_cents;

  const sizing = sizeSavings(input.cycle.id, headroom_cents, input.savings_request_cents, input.history);
  const { split, sacrificed, unassigned_cents } = splitByPriority(input.pots, sizing.chosen_cents);
  const moves = buildMoves(input, split, buffer_cents, unassigned_cents);

  const discretionary_cents = Math.max(0, headroom_cents - sizing.chosen_cents);
  const caps = weeklyCaps(input.cycle, discretionary_cents);

  const plan: Plan = {
    arithmetic,
    headroom_cents,
    naive_headroom_cents,
    overstated_by_cents: naive_headroom_cents - headroom_cents,
    sizing,
    split,
    unassigned_savings_cents: unassigned_cents,
    sacrificed,
    moves,
    discretionary_cents,
    ...caps,
    warnings: [],
  };
  plan.warnings = warningsOf(input, plan, buffer_cents, unassigned_cents);
  return plan;
}

function warningsOf(input: PlanInput, plan: Plan, buffer_cents: number, unassigned_cents: number): PlanWarning[] {
  const { sizing } = plan;
  const warnings: PlanWarning[] = [];
  const warn = (rule: string, text: string): void => {
    warnings.push({ rule, text });
  };
  const on = moveDay(input.cycle);
  for (const c of input.commitments) {
    if (c.due_on < input.cycle.start || c.due_on > input.cycle.end) {
      warn('BR1', 'The commitment "' + c.name + '" is due on ' + c.due_on + '. That date is not in this pay cycle (' + input.cycle.start + ' to ' + input.cycle.end + ').');
    } else if (c.due_on < on && c.amount_cents > 0 && (c.pay_to_person === true || c.account === input.card_account)) {
      // An automatic debit needs no move. A payment to a person or to the card account does.
      warn('BR3', 'The commitment "' + c.name + '" is due on ' + c.due_on + '. The moves of the plan are on ' + on + ', after that date.');
    }
  }
  if (plan.headroom_cents < 0) {
    warn('BR2', 'The headroom is ' + formatMoney(plan.headroom_cents) + '. The listed costs and the buffer are more than the income of this cycle.');
  }
  if (sizing.worst_cycle_id === null) {
    warn('BR4', 'No complete cycle is on record. The limit comes from this cycle only.');
  }
  if (sizing.excluded_cycles.length > 0) {
    warn('BR4', 'The history has incomplete cycles. They are not used: ' + sizing.excluded_cycles.join(', ') + '.');
  }
  if (sizing.requested_cents > sizing.sustainable_cents) {
    warn('BR4', 'The request of ' + formatMoney(sizing.requested_cents) + ' is above the sustainable amount of ' + formatMoney(sizing.sustainable_cents) + '. The plan uses ' + formatMoney(sizing.chosen_cents) + '.');
  }
  for (const pot of plan.split) {
    if (pot.target_cents > 0 && pot.funded_cents === 0) {
      warn('BR5', 'The pot "' + pot.name + '" gets no funding in this cycle. Pots with a higher priority use the amount.');
    }
  }
  if (unassigned_cents > 0) {
    warn('BR5', formatMoney(unassigned_cents) + ' of the savings has no pot. The targets of the pots are smaller than the chosen amount.');
  }
  if (input.buffer_items.length === 0) {
    warn('BR6', 'The buffer has no named item, thus the buffer is ' + formatMoney(buffer_cents) + '.');
  }
  if (plan.discretionary_cents === 0) {
    warn('BR7', 'No amount is left for free spending. Each weekly cap is ' + formatMoney(0) + '.');
  } else if (plan.daily_rate_cents === 0) {
    warn('BR7', formatMoney(plan.discretionary_cents) + ' is left for free spending. That is less than 1 cent for each day, thus each weekly cap is ' + formatMoney(0) + '.');
  }
  return warnings;
}
