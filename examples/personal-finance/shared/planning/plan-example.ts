// The worked example of the payday plan: one synthetic pay cycle that the tests share.
// The person, the banks and the merchants are fictional. The amounts are South African rand.
// It is a file of its own, thus two test files can use the same numbers.
import { parseAmount } from '../money.ts';
import { cycleContaining } from './pay-cycle.ts';
import type { PlanInput } from './plan-types.ts';

/** Text to cents, with the same function that the application uses. */
export function rand(text: string): number {
  const cents = parseAmount(text);
  if (cents === null) throw new Error('not an amount: ' + text);
  return cents;
}

export const MAIN = 'Northbank current account';
export const CARD = 'Harbour Bank card';

// Paid on day 25. The cycle 2026-01-25 to 2026-02-24 has 31 days.
export function example(): PlanInput {
  return {
    cycle: cycleContaining('2026-02-03', 25),
    income_cents: rand('R 32 000'),
    commitments: [
      { id: 'rent', name: 'Rent to the landlord', amount_cents: rand('9500'), due_on: '2026-02-01', account: MAIN, pay_to_person: true },
      { id: 'medical', name: 'Medical aid', amount_cents: rand('2100'), due_on: '2026-02-01', account: MAIN },
      { id: 'phone', name: 'Phone contract', amount_cents: rand('450'), due_on: '2026-01-28', account: MAIN },
      { id: 'insurance', name: 'Car insurance', amount_cents: rand('850'), due_on: '2026-02-02', account: MAIN },
      { id: 'stream', name: 'Streamhouse', amount_cents: rand('199'), due_on: '2026-02-05', account: CARD },
      { id: 'gym', name: 'Ironworks Gym', amount_cents: rand('550'), due_on: '2026-02-10', account: CARD },
    ],
    variable_living_cents: rand('6500'),
    unlisted_cents: rand('1800'),
    pots: [
      { id: 'laptop', name: 'New laptop', priority: 3, target_cents: rand('2000') },
      { id: 'emergency', name: 'Emergency fund', priority: 1, target_cents: rand('3000') },
      { id: 'holiday', name: 'Holiday', priority: 2, target_cents: rand('2000') },
    ],
    savings_request_cents: rand('7000'),
    history: [
      { cycle_id: '2025-10-25', complete: true, income_cents: rand('32000'), commitments_cents: rand('13649'), variable_cents: rand('7000'), unlisted_cents: rand('2500') },
      { cycle_id: '2025-11-25', complete: true, income_cents: rand('32000'), commitments_cents: rand('13649'), variable_cents: rand('8200'), unlisted_cents: rand('4151') },
      { cycle_id: '2025-12-25', complete: false, income_cents: rand('32000'), commitments_cents: rand('13649'), variable_cents: rand('900'), unlisted_cents: 0 },
    ],
    buffer_items: [{ name: 'Car service', amount_cents: rand('1200') }, { name: 'School trip', amount_cents: rand('400') }],
    card_account: CARD,
  };
}
