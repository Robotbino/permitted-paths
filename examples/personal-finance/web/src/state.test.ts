import { expect, test } from 'vitest';
import type { RecordExpenseResult } from '../../shared/contracts.ts';
import { initialState, reduce } from './state.ts';

const result = { expense: { category_id: 'groceries' }, budget: { period: '2026-03' }, replayed: false } as RecordExpenseResult;
const filled = reduce(reduce(initialState('2026-03-14', 'key-A'), { type: 'field', name: 'amount_text', value: '185.00' }), { type: 'field', name: 'merchant_name', value: 'Woolworths' });

test('a failure keeps the request key, thus a second try cannot record a second expense', () => {
  const failed = reduce(reduce(filled, { type: 'submit' }), { type: 'failed', problems: [{ rule: 'NET', text: 'no answer' }] });
  expect(failed.status).toBe('failed');
  expect(failed.idempotency_key).toBe('key-A');
  expect(failed.form.amount_text).toBe('185.00'); // the form is not lost
});

test('a success gives a new key and an empty form, and keeps the date and the category', () => {
  const saved = reduce(reduce(filled, { type: 'submit' }), { type: 'saved', result, next_key: 'key-B' });
  expect(saved.idempotency_key).toBe('key-B');
  expect(saved.form).toMatchObject({ amount_text: '', merchant_name: '', occurred_on: '2026-03-14' });
  expect(saved.last).toBe(result);
});

test('a question "record a second one?" keeps the key and goes away when the form changes', () => {
  const asked = reduce(reduce(filled, { type: 'submit' }), { type: 'needs_confirmation', problems: [{ rule: 'R7', text: 'similar' }] });
  expect([asked.status, asked.idempotency_key]).toEqual(['confirm', 'key-A']);
  const changed = reduce(asked, { type: 'field', name: 'amount_text', value: '190.00' });
  expect([changed.status, changed.problems]).toEqual(['idle', []]);
});

test('the reducer does not change the state that it gets', () => {
  const before = JSON.stringify(filled);
  reduce(filled, { type: 'submit' });
  expect(JSON.stringify(filled)).toBe(before);
});

// Level 3: the suggestion.
const suggestion = { suggestion: { category_id: 'groceries', category_name: 'Groceries', source: 'model' as const }, reason: 'FROM_MODEL' as const, run_id: 'run_0001' };

test('a suggestion does not change the form; only the person accepts it', () => {
  const offered = reduce(filled, { type: 'suggestion', for_merchant: 'Woolworths', response: suggestion });
  expect(offered.form.category_id).toBe('');
  expect(offered.suggestion).toMatchObject({ category_id: 'groceries', run_id: 'run_0001' });
  expect(reduce(offered, { type: 'accept_suggestion' }).form.category_id).toBe('groceries');
});

test('a late suggestion for a different merchant text is ignored, and a new merchant text removes the suggestion', () => {
  expect(reduce(filled, { type: 'suggestion', for_merchant: 'Woolw', response: suggestion }).suggestion).toBeNull();
  const offered = reduce(filled, { type: 'suggestion', for_merchant: 'Woolworths', response: suggestion });
  expect(reduce(offered, { type: 'field', name: 'merchant_name', value: 'Engen' }).suggestion).toBeNull();
  expect(reduce(offered, { type: 'field', name: 'amount_text', value: '190' }).suggestion).not.toBeNull();
});

test('an answer with no suggestion changes nothing', () => {
  expect(reduce(filled, { type: 'suggestion', for_merchant: 'Woolworths', response: { suggestion: null, reason: 'AI_OFF', run_id: 'run_0002' } })).toBe(filled);
});
