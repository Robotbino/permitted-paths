// The state of the screen, and the one function that changes it.
// The reducer is pure: (state, action) -> new state. It does not call the server and it makes no
// random value. The components send actions; the effects are in App.tsx.
import type { MonthSummary, Problem, RecordExpenseResult } from '../../shared/contracts.ts';

export type Form = { amount_text: string; merchant_name: string; category_id: string; occurred_on: string; note: string };

export type ScreenState = {
  form: Form;
  /** The request key of the expense in the form. It stays the same for each try of the same expense. */
  idempotency_key: string;
  status: 'idle' | 'saving' | 'saved' | 'failed' | 'confirm';
  problems: Problem[];
  last: RecordExpenseResult | null;
  summary: MonthSummary | null;
};

export type Action =
  | { type: 'field'; name: keyof Form; value: string }
  | { type: 'submit' }
  | { type: 'saved'; result: RecordExpenseResult; next_key: string }
  | { type: 'needs_confirmation'; problems: Problem[] }
  | { type: 'failed'; problems: Problem[] }
  | { type: 'summary'; summary: MonthSummary };

export function initialState(today: string, key: string): ScreenState {
  return {
    form: { amount_text: '', merchant_name: '', category_id: '', occurred_on: today, note: '' },
    idempotency_key: key,
    status: 'idle',
    problems: [],
    last: null,
    summary: null,
  };
}

export function reduce(state: ScreenState, action: Action): ScreenState {
  switch (action.type) {
    case 'field':
      // A change of the form after a question "record a second one?" removes the question.
      return { ...state, form: { ...state.form, [action.name]: action.value }, status: state.status === 'saving' ? 'saving' : 'idle', problems: [] };
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
        form: { ...state.form, amount_text: '', merchant_name: '', note: '' },
      };
    case 'needs_confirmation':
      return { ...state, status: 'confirm', problems: action.problems };
    case 'failed':
      return { ...state, status: 'failed', problems: action.problems };
    case 'summary':
      return { ...state, summary: action.summary };
  }
}
