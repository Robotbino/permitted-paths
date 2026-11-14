// The contracts of planning. Two groups of types are here.
// 1. What is stored: the settings of the plan, the commitments, the savings pots and the income rows.
// 2. What is shown: the plan view of one pay cycle. No figure of the view is stored; the server
//    calculates each one from the stored rows when the view is asked for.
// All amounts are integer cents. All dates are local YYYY-MM-DD strings.
import type { Insight } from './planning/insights.ts';
import type { PayCycle, WeekBlock } from './planning/pay-cycle.ts';
import type { BufferItem, Pace, Plan, PlanInput, WeekState } from './planning/plan.ts';

/** The one row of settings. The payday is a day of the month from 1 to 28. */
export type PlanSettings = {
  payday: number;
  /** Planned essentials that are not dated: food, transport. */
  variable_living_cents: number;
  /** What the person asks to save in each cycle. */
  savings_request_cents: number;
  /** Commitments of this account need a transfer from the main account. null: there is no such account. */
  card_account: string | null;
  /** The buffer is a sum of named items. */
  buffer_items: BufferItem[];
};

/** A commitment as it is stored: it has a day of the month, not a date. The plan service gives it the date in a cycle. */
export type StoredCommitment = { id: string; name: string; amount_cents: number; due_day: number; account: string; pay_to_person: boolean; active: boolean };

export type SavingsPot = { id: string; name: string; priority: number; target_cents: number; active: boolean };

/** One income row. As an expense, it is added and never changed. */
export type Income = {
  id: string;
  idempotency_key: string;
  occurred_on: string;
  amount_cents: number;
  source: string;
  account: string;
  created_at: string; // UTC, for the audit
};

/** Where the income of the plan comes from: the rows of this cycle, the rows of the most recent earlier cycle, or nowhere. */
export const INCOME_SOURCES = ['this_cycle', 'previous_cycle', 'none'] as const;
export type IncomeSource = (typeof INCOME_SOURCES)[number];

/** One week block with its cap and what was spent. spent_cents and status are null for a block that has not started. */
export type WeekView = WeekBlock & { cap_cents: number; spent_cents: number | null; status: WeekState | null };

/** moved_cents is the sum of the rows of the cycle that have a category of the kind 'savings'. */
export type SavingsView = { planned_cents: number; moved_cents: number; held: boolean; text: string };

/** The answer of GET /api/weeks. Without a plan: no weeks, and savings is null. */
export type WeeksView = { cycle: PayCycle; weeks: WeekView[]; pace: Pace; savings: SavingsView | null };

/** The answer of GET /api/plan. */
export type PlanView = WeeksView & {
  today: string;
  income_cents: number;
  income_source: IncomeSource;
  /** What the plan was made from. The history and the unlisted amount come from the ledger. */
  input: PlanInput;
  /** An empty list is PASS. With a problem, plan is null. */
  input_problems: string[];
  plan: Plan | null;
  insights: Insight[];
  headline: string;
};
