// The types of the payday plan. They are in a file of their own, thus plan.ts and its parts
// (plan-sizing.ts, plan-moves.ts) can import them and no file imports in a circle.
// All amounts are integer cents.
import type { PayCycle, WeekBlock } from './pay-cycle.ts';

export const MOVE_KINDS = ['cover_debits', 'savings', 'pay_people', 'card_transfer'] as const;
export type MoveKind = (typeof MOVE_KINDS)[number];

export type Commitment = { id: string; name: string; amount_cents: number; due_on: string; account: string; pay_to_person?: boolean };
export type Pot = { id: string; name: string; priority: number; target_cents: number };
export type BufferItem = { name: string; amount_cents: number };

/** What one earlier cycle really was. An incomplete cycle has data that is not all there yet. */
export type CycleHistory = {
  cycle_id: string;
  complete: boolean;
  income_cents: number;
  commitments_cents: number;
  variable_cents: number;
  unlisted_cents: number;
};

export type PlanInput = {
  cycle: PayCycle;
  income_cents: number;
  commitments: Commitment[];
  /** Planned essentials that are not dated: food, transport. */
  variable_living_cents: number;
  /** Spending that fits neither list, estimated from history. */
  unlisted_cents: number;
  /** Priority 1 is funded first. */
  pots: Pot[];
  /** What the person asks to save this cycle. */
  savings_request_cents: number;
  history: CycleHistory[];
  /** The buffer is a sum of named items, never a percentage. */
  buffer_items: BufferItem[];
  /** Commitments of this account need a transfer from the main account. */
  card_account?: string;
};

/** One line of the arithmetic. amount_cents is the amount of the line; running_cents is what is left after it. */
export type ArithmeticLine = { label: string; amount_cents: number; running_cents: number };

export type Sizing = {
  sustainable_cents: number;
  worst_cycle_id: string | null;
  excluded_cycles: string[];
  requested_cents: number;
  chosen_cents: number;
  reason: string;
};

export type PotSplit = { pot_id: string; name: string; target_cents: number; funded_cents: number; shortfall_cents: number };

export type Move = { order: number; kind: MoveKind; label: string; amount_cents: number; on: string };

export type PlanWarning = { rule: string; text: string };

export type Plan = {
  arithmetic: ArithmeticLine[];
  headroom_cents: number;
  /** The headroom if the unlisted layer is ignored. */
  naive_headroom_cents: number;
  overstated_by_cents: number;
  sizing: Sizing;
  split: PotSplit[];
  /** The part of the chosen savings that no pot takes. It has a savings move of its own, thus it is in the plan. */
  unassigned_savings_cents: number;
  /** Names of the pots that got less than their target, lowest priority first. */
  sacrificed: string[];
  moves: Move[];
  discretionary_cents: number;
  daily_rate_cents: number;
  weeks: Array<WeekBlock & { cap_cents: number }>;
  /** What the caps do not use, because the daily rate is a whole number of cents. */
  remainder_cents: number;
  warnings: PlanWarning[];
};
