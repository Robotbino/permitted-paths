// The state of the screen, and the one function that changes it.
// The reducer is pure: (state, action) -> new state. It does not call the server and it makes no
// random value. The components send actions; the effects are in App.tsx.
import type { MonthSummary, Problem, RecordExpenseResult } from '../../shared/contracts.ts';
import type { SuggestResponse } from '../../shared/contracts.suggest.ts';

export type Form = { amount_text: string; merchant_name: string; category_id: string; occurred_on: string; note: string };

export type ScreenState = {
  form: Form;
  /** The request key of the expense in the form. It stays the same for each try of the same expense. */
  idempotency_key: string;
  status: 'idle' | 'saving' | 'saved' | 'failed' | 'confirm';
  problems: Problem[];
  last: RecordExpenseResult | null;
  summary: MonthSummary | null;
  /** Level 3. A suggestion that waits for the person. It is never put into the form by the program. */
  suggestion: { category_id: string; category_name: string; source: 'memory' | 'model'; run_id: string; for_merchant: string } | null;
};

export type Action =
  | { type: 'field'; name: keyof Form; value: string }
  | { type: 'submit' }
  | { type: 'saved'; result: RecordExpenseResult; next_key: string }
  | { type: 'needs_confirmation'; problems: Problem[] }
  | { type: 'failed'; problems: Problem[] }
  | { type: 'summary'; summary: MonthSummary }
  | { type: 'suggestion'; for_merchant: string; response: SuggestResponse }
  | { type: 'accept_suggestion' };

export function initialState(today: string, key: string): ScreenState {
  return {
    form: { amount_text: '', merchant_name: '', category_id: '', occurred_on: today, note: '' },
    idempotency_key: key,
    status: 'idle',
    problems: [],
    last: null,
    summary: null,
    suggestion: null,
  };
}

export function reduce(state: ScreenState, action: Action): ScreenState {
  switch (action.type) {
    case 'field':
      // A change of the form after a question "record a second one?" removes the question.
      return {
        ...state,
        form: { ...state.form, [action.name]: action.value },
        status: state.status === 'saving' ? 'saving' : 'idle',
        problems: [],
        // A suggestion is for one merchant text. A different merchant text removes it.
        suggestion: action.name === 'merchant_name' ? null : state.suggestion,
      };
    case 'submit':
      return { ...state, status: 'saving', problems: [] };
    case 'saved':
      // Only a success gives a new key. A failure keeps the key, thus a second try cannot record a second expense.
      return {
        ...state,
        status: 'saved',
        last: action.result,
        problems: [],
        idempotency_key: action.next_key,
        suggestion: null,
        form: { ...state.form, amount_text: '', merchant_name: '', note: '' },
      };
    case 'needs_confirmation':
      return { ...state, status: 'confirm', problems: action.problems };
    case 'failed':
      return { ...state, status: 'failed', problems: action.problems };
    case 'summary':
      return { ...state, summary: action.summary };
    case 'suggestion': {
      // An answer that arrives late, for a merchant text that is not in the form now, is ignored.
      const s = action.response.suggestion;
      if (!s || action.for_merchant !== state.form.merchant_name) return state;
      return { ...state, suggestion: { ...s, run_id: action.response.run_id, for_merchant: action.for_merchant } };
    }
    case 'accept_suggestion':
      // Only the person accepts. This is the one location where a suggestion becomes the category of the form.
      return state.suggestion ? { ...state, form: { ...state.form, category_id: state.suggestion.category_id } } : state;
  }
}
