// Level 3. The contract of the assist path: a person writes a request in plain words.
// Four kinds of step stay four different things, in the code and in the data:
//   the model RECOMMENDS, the application VALIDATES, the person APPROVES, the application EXECUTES.
// An answer of the first request never says that a change was made: a change waits for a second
// request of the person (POST /api/assist/:id/decide).
import { z } from 'zod';
import type { Problem } from './contracts.ts';

/** The longest request text. A longer text is refused, not cut. */
export const MAX_ASSIST_TEXT = 500;

export const AssistRequest = z.strictObject({ text: z.string().trim().min(1).max(MAX_ASSIST_TEXT) });
export type AssistRequest = z.infer<typeof AssistRequest>;

export const AssistDecideRequest = z.strictObject({ approve: z.boolean() });
export type AssistDecideRequest = z.infer<typeof AssistDecideRequest>;

/** Each value is a normal result, not an error. */
export const ASSIST_STATUSES = ['AI_OFF', 'DAILY_CAP', 'MODEL_UNAVAILABLE', 'CLARIFY', 'DECLINED', 'REJECTED', 'DONE', 'FAILED', 'NEEDS_APPROVAL'] as const;
export type AssistStatus = (typeof ASSIST_STATUSES)[number];

/** The answer of POST /api/assist. request_id is the id of the audit record. */
export type AssistResponse = { request_id: string } & (
  // The model was not asked, or it gave no answer. The list says what the person can do without it.
  | { status: 'AI_OFF' | 'DAILY_CAP' | 'MODEL_UNAVAILABLE'; message: string; without_ai: string[] }
  // The text can mean more than one thing. Nothing is changed.
  | { status: 'CLARIFY'; question: string; options: string[] }
  // The text asks for something that this application does not do.
  | { status: 'DECLINED'; reason: string }
  // The action gate said no. capability is the name that the model gave, or null.
  | { status: 'REJECTED'; capability: string | null; reason: string; problems: Problem[] }
  // A capability that only reads: the application executed it, and this is what its own code calculated.
  | { status: 'DONE'; capability: string; output: object }
  // A capability that only reads, but the service of the application did not complete.
  | { status: 'FAILED'; capability: string; problems: Problem[] }
  // A capability that changes data: nothing is changed. The person decides with the proposal id.
  | { status: 'NEEDS_APPROVAL'; proposal_id: string; capability: string; description: string; consequences: object | null }
);

export const DECISION_STATUSES = ['DECLINED_BY_PERSON', 'EXECUTED', 'FAILED'] as const;
export type DecisionStatus = (typeof DECISION_STATUSES)[number];

/** The answer of POST /api/assist/:id/decide. A second request for the same proposal gets the same stored answer. */
export type AssistDecision = { proposal_id: string; capability: string; status: DecisionStatus; output: object | null; problems: Problem[]; decided_at: string };

/** A request that passed the gate and waits for the person. The input and the consequences are what the person saw. */
export type AssistProposal = {
  id: string;
  request_id: string;
  capability: string;
  input: object;
  consequences: object | null;
  description: string;
  created_at: string;
  status: 'PENDING' | DecisionStatus;
  /** null while the proposal waits. */
  outcome: AssistDecision | null;
};

/**
 * One record for each request of the assist path, also for a refused one.
 * It has no text of the person: input_summary is the short summary of the gate, or the length of the text.
 */
export type AssistAudit = {
  request_id: string;
  /** UTC. */
  at: string;
  capability: string | null;
  /** A status of the first request, a status of a decision, or SHAPE for a request with no valid text. */
  status: string;
  reason: string | null;
  input_summary: string;
  /** The name of the model that was asked. null: no model call was made for this request. */
  model: string | null;
};

/** What a change of the free spending amount does, in cents. The application calculates each figure; the model gave only the percentage. */
export type AllowanceConsequences = {
  cycle_id: string;
  change_percent: number;
  free_spending_before_cents: number;
  free_spending_after_cents: number;
  weekly_caps: Array<{ index: number; start: string; end: string; before_cents: number; after_cents: number }>;
  savings_before_cents: number;
  savings_after_cents: number;
  savings_request_before_cents: number;
  /** The one value that the application writes after the person approves. */
  savings_request_after_cents: number;
  text: string;
};

/** The answer of the capability analyse_spending: totals that the application calculated from its ledger. */
export type SpendingAnalysis = {
  period: 'this_cycle' | 'last_cycle';
  cycle: { id: string; start: string; end: string };
  category_id: string | null;
  total_cents: number;
  /** The largest total is first. */
  categories: Array<{ category_id: string; name: string; kind: string; class: string; total_cents: number; rows: number }>;
};
