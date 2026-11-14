// Rule BR4 (sizing) and rule BR5 (priority). How much can the person save, and which pot gets it.
// The amount must survive the worst cycle on record: an average hides the cycle that hurts.
// An incomplete cycle is excluded, because data that is not all there looks better than it was.
import { formatMoney } from '../money.ts';
import type { CycleHistory, Pot, PotSplit, Sizing } from './plan-types.ts';

/** The headroom that one earlier cycle really had. The buffer is not subtracted: the real costs are in the cycle already. */
export function historyHeadroom(h: CycleHistory): number {
  return h.income_cents - h.commitments_cents - h.variable_cents - h.unlisted_cents;
}

/** sustainable = the smallest headroom of this cycle and of each complete cycle, not below 0. chosen = min(requested, sustainable). */
export function sizeSavings(cycle_id: string, headroom_cents: number, requested_cents: number, history: CycleHistory[]): Sizing {
  const complete = history.filter((h) => h.complete);
  const excluded_cycles = history.filter((h) => !h.complete).map((h) => h.cycle_id);
  const requested = Math.max(0, requested_cents);

  // With complete history, the worst cycle can be this cycle. With no complete history, there is no worst cycle.
  let worst_cycle_id: string | null = complete.length > 0 ? cycle_id : null;
  let lowest = headroom_cents;
  for (const h of complete) {
    const value = historyHeadroom(h);
    if (value < lowest) {
      lowest = value;
      worst_cycle_id = h.cycle_id;
    }
  }
  const sustainable_cents = Math.max(0, lowest);
  const chosen_cents = Math.min(requested, sustainable_cents);

  let reason: string;
  if (complete.length === 0) {
    reason = requested <= sustainable_cents
      ? 'No complete cycle is on record, thus the limit is the headroom of this cycle, and the request of ' + formatMoney(requested) + ' fits.'
      : 'No complete cycle is on record, thus the limit is the headroom of this cycle: ' + formatMoney(sustainable_cents) + '.';
  } else if (requested <= sustainable_cents) {
    reason = 'The request of ' + formatMoney(requested) + ' fits in each complete cycle on record and in this cycle.';
  } else if (worst_cycle_id === cycle_id) {
    reason = 'The headroom of this cycle limits the amount to ' + formatMoney(sustainable_cents) + '.';
  } else {
    reason = 'The cycle ' + worst_cycle_id + ' had the lowest headroom on record, and it limits the amount to ' + formatMoney(sustainable_cents) + '.';
  }
  return { sustainable_cents, worst_cycle_id, excluded_cycles, requested_cents: requested, chosen_cents, reason };
}

/** Pots get money in priority order until the chosen amount is used. Equal priorities keep the order of the input. */
export function splitByPriority(pots: Pot[], chosen_cents: number): { split: PotSplit[]; sacrificed: string[]; unassigned_cents: number } {
  const ordered = pots.map((pot, position) => ({ pot, position })).sort((a, b) => a.pot.priority - b.pot.priority || a.position - b.position);
  let left = Math.max(0, chosen_cents);
  const split: PotSplit[] = [];
  for (const { pot } of ordered) {
    const target = Math.max(0, pot.target_cents);
    const funded = Math.min(target, left);
    left -= funded;
    split.push({ pot_id: pot.id, name: pot.name, target_cents: target, funded_cents: funded, shortfall_cents: target - funded });
  }
  const sacrificed = split.filter((s) => s.shortfall_cents > 0).map((s) => s.name).reverse();
  return { split, sacrificed, unassigned_cents: left };
}
