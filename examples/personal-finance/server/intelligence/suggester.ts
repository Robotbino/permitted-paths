// The port of the model. The application knows a "category suggester"; it does not know Claude.
// Two implementations: claude-suggester.ts (the real model) and fake-suggester.ts (tests, recordings).
// The port gives the model very little: the merchant text and the list of permitted categories.
// It does not give the amount, the date, the ledger, or any way to write.

export type SuggesterInput = {
  merchant_name: string;
  categories: Array<{ id: string; name: string }>;
};

/** The words that the model used. The answer is not trusted yet: the suggestion gate checks it. */
export type SuggesterOutput =
  | { status: 'OK'; category_id: string; input_tokens: number; output_tokens: number }
  | { status: 'TIMEOUT' | 'ERROR' | 'REFUSED'; detail: string };

export interface CategorySuggester {
  /** The name of the model, for the trace. */
  readonly model: string;
  /** Must not throw. Each failure of the model is a value. */
  suggest(input: SuggesterInput): Promise<SuggesterOutput>;
}

/** The answer of the model when it has no good category. */
export const UNKNOWN = 'UNKNOWN';
