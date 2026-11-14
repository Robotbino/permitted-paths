// The top component. It owns the state of the screen and does the effects (the calls to the server).
// The truth about the money is on the server. After each record, the screen asks the server again;
// it does not calculate a budget itself.
import { useCallback, useEffect, useReducer, useState } from 'react';
import type { Category } from '../../shared/contracts.ts';
import { parseAmount } from '../../shared/money.ts';
import { getCategories, getSummary, postExpense, postSuggest } from './api.ts';
import { BudgetPanel } from './BudgetPanel.tsx';
import { ExpenseForm } from './ExpenseForm.tsx';
import { ImportReview } from './ImportReview.tsx';
import { initialState, reduce } from './state.ts';

const newKey = () => crypto.randomUUID();
const localToday = () => {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
};

export function App() {
  const [state, dispatch] = useReducer(reduce, null, () => initialState(localToday(), newKey()));
  const [categories, setCategories] = useState<Category[]>([]);
  const period = state.form.occurred_on.slice(0, 7);

  const loadSummary = useCallback(async (p: string) => {
    const result = await getSummary(p);
    if (result.ok) dispatch({ type: 'summary', summary: result.value });
  }, []);

  useEffect(() => {
    void getCategories().then((result) => result.ok && setCategories(result.value));
  }, []);
  useEffect(() => {
    if (/^\d{4}-\d{2}$/.test(period)) void loadSummary(period);
  }, [period, loadSummary]);

  // Level 3. Ask for a suggestion when the person leaves the merchant field. If the call fails,
  // or the answer has no suggestion, nothing happens: the form works as before.
  async function askSuggestion() {
    const merchant = state.form.merchant_name;
    if (merchant.trim() === '' || state.suggestion?.for_merchant === merchant) return;
    const result = await postSuggest(merchant);
    if (result.ok) dispatch({ type: 'suggestion', for_merchant: merchant, response: result.value });
  }

  async function submit(confirm_duplicate: boolean) {
    const cents = parseAmount(state.form.amount_text);
    if (cents === null) return;
    // A form that changed after an attempt is a different expense: it gets a new key.
    // Without this, the old key gives "key conflict" for each try until the page loads again.
    const key = state.edited_after_attempt ? newKey() : state.idempotency_key;
    dispatch({ type: 'submit', key });
    const result = await postExpense({
      idempotency_key: key,
      amount_cents: cents,
      currency: 'ZAR',
      occurred_on: state.form.occurred_on,
      merchant_name: state.form.merchant_name,
      category_id: state.form.category_id,
      ...(state.form.note ? { note: state.form.note } : {}),
      ...(confirm_duplicate ? { confirm_duplicate: true } : {}),
      ...(state.suggestion ? { suggest_run_id: state.suggestion.run_id } : {}),
    });
    if (result.ok) {
      dispatch({ type: 'saved', result: result.value, next_key: newKey() });
      void loadSummary(result.value.budget.period);
    } else if (result.code === 'NEEDS_CONFIRMATION') {
      dispatch({ type: 'needs_confirmation', problems: result.problems });
    } else {
      dispatch({ type: 'failed', problems: result.problems });
    }
  }

  return (
    <main>
      <h1>Personal finance</h1>
      <p className="muted">Studio example. Fictional data only.</p>
      <ExpenseForm state={state} categories={categories} dispatch={dispatch} onSubmit={submit} onMerchantDone={() => void askSuggestion()} />
      <BudgetPanel summary={state.summary} highlight={state.status === 'saved' && state.last ? state.last.expense.category_id : null} />
      {/* Level 3. After an import, the month is read again from the server. */}
      <ImportReview categories={categories} onRecorded={() => void loadSummary(period)} />
    </main>
  );
}
