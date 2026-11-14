// The form. It shows the state and sends actions. It has no rule of its own:
// the only check here is "is the amount text a number?", because the server wants cents.
import type { Category } from '../../shared/contracts.ts';
import { formatMoney, parseAmount } from '../../shared/money.ts';
import type { Action, ScreenState } from './state.ts';

type Props = {
  state: ScreenState;
  categories: Category[];
  dispatch: (action: Action) => void;
  onSubmit: (confirm_duplicate: boolean) => void;
};

export function ExpenseForm({ state, categories, dispatch, onSubmit }: Props) {
  const { form, status, problems, last } = state;
  const cents = parseAmount(form.amount_text);
  const ready = cents !== null && cents > 0 && form.merchant_name.trim() !== '' && form.category_id !== '' && status !== 'saving';
  const field = (name: keyof typeof form) => (event: { target: { value: string } }) => dispatch({ type: 'field', name, value: event.target.value });

  return (
    <form
      className="card"
      onSubmit={(event) => {
        event.preventDefault();
        if (ready) onSubmit(false);
      }}
    >
      <h2>Record an expense</h2>
      <label>
        Amount (rand)
        <input inputMode="decimal" placeholder="185.00" value={form.amount_text} onChange={field('amount_text')} aria-invalid={form.amount_text !== '' && cents === null} />
      </label>
      <label>
        Merchant
        <input placeholder="Woolworths" maxLength={80} value={form.merchant_name} onChange={field('merchant_name')} />
      </label>
      <label>
        Category
        <select value={form.category_id} onChange={field('category_id')}>
          <option value="">Select a category</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Date
        <input type="date" value={form.occurred_on} onChange={field('occurred_on')} />
      </label>

      <button type="submit" disabled={!ready}>
        {status === 'saving' ? 'Saving…' : 'Record'}
      </button>

      <div aria-live="polite">
        {problems.length > 0 && (
          <ul className={status === 'confirm' ? 'problems ask' : 'problems'}>
            {problems.map((p) => (
              <li key={p.rule + p.text}>
                <strong>{p.rule}</strong> {p.text}
              </li>
            ))}
          </ul>
        )}
        {status === 'confirm' && (
          <button type="button" className="secondary" onClick={() => onSubmit(true)}>
            Yes, record a second one
          </button>
        )}
        {status === 'saved' && last && (
          <p className="ok">
            Recorded {formatMoney(last.expense.amount_cents)} at {last.expense.merchant_name}.{last.replayed ? ' (It was already recorded.)' : ''}
          </p>
        )}
      </div>
    </form>
  );
}
