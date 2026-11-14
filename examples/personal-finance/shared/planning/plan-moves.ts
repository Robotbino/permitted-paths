// Rule BR3 (payday order) and rule BR7 (weekly cap).
// The moves happen on the day after payday, in one fixed order: debits, savings, people, card.
// Savings move before any spending money, thus "save what is left" cannot happen.
import { addDays, weekBlocks, type PayCycle, type WeekBlock } from './pay-cycle.ts';
import type { Move, MoveKind, PlanInput, PotSplit } from './plan-types.ts';

/** The day of the moves: the day after payday. A cycle of 1 day has no day after payday, thus it uses the payday. */
export function moveDay(cycle: PayCycle): string {
  const next = addDays(cycle.start, 1);
  return next > cycle.end ? cycle.start : next;
}

/** The moves in order. A move of 0 cents is not listed. */
export function buildMoves(input: PlanInput, split: PotSplit[], buffer_cents: number, unassigned_cents = 0): Move[] {
  const on = moveDay(input.cycle);
  const moves: Move[] = [];
  const add = (kind: MoveKind, label: string, amount_cents: number): void => {
    if (amount_cents > 0) moves.push({ order: moves.length + 1, kind, label, amount_cents, on });
  };
  // A commitment of the card account goes into the card transfer, also if a person gets it.
  const onCard = (account: string): boolean => input.card_account !== undefined && account === input.card_account;
  const main = input.commitments.filter((c) => !onCard(c.account));

  const debits = main.filter((c) => !c.pay_to_person).reduce((sum, c) => sum + c.amount_cents, 0);
  add('cover_debits', 'Keep the money for the automatic debits in the main account', debits);

  for (const pot of split) add('savings', 'Move savings to the pot "' + pot.name + '"', pot.funded_cents);
  // Savings that no pot takes still leave the main account. Without this move the amount is in no move and in no cap.
  add('savings', 'Move the savings that have no pot', unassigned_cents);

  for (const c of main.filter((x) => x.pay_to_person)) add('pay_people', 'Pay ' + c.name, c.amount_cents);

  if (input.card_account !== undefined) {
    const card = input.commitments.filter((c) => onCard(c.account)).reduce((sum, c) => sum + c.amount_cents, 0);
    add('card_transfer', 'Transfer to ' + input.card_account + ': its commitments and the buffer', card + buffer_cents);
  }
  return moves;
}

export type WeeklyCaps = { daily_rate_cents: number; weeks: Array<WeekBlock & { cap_cents: number }>; remainder_cents: number };

/** cap = daily rate x days of the block. The remainder is stated: caps + remainder = discretionary. */
export function weeklyCaps(cycle: PayCycle, discretionary_cents: number): WeeklyCaps {
  const daily_rate_cents = cycle.days > 0 ? Math.floor(discretionary_cents / cycle.days) : 0;
  const weeks = weekBlocks(cycle).map((block) => ({ ...block, cap_cents: daily_rate_cents * block.days }));
  const remainder_cents = discretionary_cents - weeks.reduce((sum, w) => sum + w.cap_cents, 0);
  return { daily_rate_cents, weeks, remainder_cents };
}
