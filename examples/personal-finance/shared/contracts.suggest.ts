// Level 3. The contract of "suggest a category". It is a different operation from "record an expense":
// it gets only the merchant name, it gives a suggestion or nothing, and it never changes the ledger.
import { z } from 'zod';

export const SuggestRequest = z.strictObject({
  merchant_name: z.string().trim().min(1).max(80),
});
export type SuggestRequest = z.infer<typeof SuggestRequest>;

/** Why the answer has, or does not have, a suggestion. Each value is a normal result, not an error. */
export const SUGGEST_REASONS = ['FROM_MEMORY', 'FROM_MODEL', 'AI_OFF', 'DAILY_CAP', 'MODEL_UNAVAILABLE', 'NOT_PERMITTED', 'MODEL_DOES_NOT_KNOW'] as const;
export type SuggestReason = (typeof SUGGEST_REASONS)[number];

export type SuggestResponse = {
  /** null: the form stays as it is, and the person selects the category. */
  suggestion: { category_id: string; category_name: string; source: 'memory' | 'model' } | null;
  reason: SuggestReason;
  /** The run of the suggest graph. The record request sends it back, thus the two runs are connected in the trace. */
  run_id: string;
};
