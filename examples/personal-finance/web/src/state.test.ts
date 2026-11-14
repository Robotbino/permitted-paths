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
