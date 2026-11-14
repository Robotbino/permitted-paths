// The check of the input of the payday plan. buildPlan refuses an input that has a problem,
// because a plan from a wrong number looks as correct as a plan from a right number.
// A negative cost makes the headroom larger. NaN makes each comparison false and hides a cycle.
// An amount with a fraction or above the safe integer limit loses cents without a signal.
import { isDate } from './pay-cycle.ts';
import type { PlanInput } from './plan-types.ts';

/** The problems of the input, in plain sentences. An empty list is PASS. */
export function checkPlanInput(input: PlanInput): string[] {
  const problems: string[] = [];
  let total = 0;
  // A whole number of cents. The costs and the income cannot be below 0.
  const cents = (what: string, value: unknown, allowNegative = false): void => {
    if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
      problems.push(what + ' must be a whole number of cents.');
    } else if (value < 0 && !allowNegative) {
      problems.push(what + ' cannot be below 0.');
    } else {
      total += Math.abs(value);
    }
  };
  const date = (what: string, value: unknown): void => {
    if (typeof value !== 'string' || !isDate(value)) problems.push(what + ' must be a date in the form YYYY-MM-DD.');
  };

  date('The start of the cycle', input.cycle.start);
  date('The end of the cycle', input.cycle.end);
  if (!Number.isSafeInteger(input.cycle.days) || input.cycle.days < 0) problems.push('The days of the cycle must be a whole number, 0 or more.');

  cents('The income', input.income_cents);
  cents('The variable living amount', input.variable_living_cents);
  cents('The unlisted amount', input.unlisted_cents);
  // A request below 0 is not a problem: the plan treats it as 0.
  cents('The savings request', input.savings_request_cents, true);

  for (const c of input.commitments) {
    cents('The amount of the commitment "' + c.name + '"', c.amount_cents);
    date('The due date of the commitment "' + c.name + '"', c.due_on);
  }
  for (const b of input.buffer_items) cents('The amount of the buffer item "' + b.name + '"', b.amount_cents);
  for (const pot of input.pots) {
    cents('The target of the pot "' + pot.name + '"', pot.target_cents);
    if (typeof pot.priority !== 'number' || !Number.isFinite(pot.priority)) problems.push('The priority of the pot "' + pot.name + '" must be a number.');
  }
  // An incomplete cycle is not used, thus its numbers are not checked. A real cycle can have a net refund: below 0 is permitted.
  for (const h of input.history) {
    if (!h.complete) continue;
    const cycle = 'of the cycle ' + h.cycle_id;
    cents('The income ' + cycle, h.income_cents, true);
    cents('The commitments ' + cycle, h.commitments_cents, true);
    cents('The variable amount ' + cycle, h.variable_cents, true);
    cents('The unlisted amount ' + cycle, h.unlisted_cents, true);
  }
  // Each amount is exact, but a sum above the safe integer limit is not.
  if (total > Number.MAX_SAFE_INTEGER) problems.push('The amounts are too large: their sum is not exact.');
  return problems;
}

/** Stops the plan if the input has a problem. The message has each problem. */
export function assertPlanInput(input: PlanInput): void {
  const problems = checkPlanInput(input);
  if (problems.length > 0) throw new RangeError('The plan cannot be made. ' + problems.join(' '));
}
