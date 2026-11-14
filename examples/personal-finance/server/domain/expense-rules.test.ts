import { expect, test } from 'vitest';
import { merchantKey, toProposal } from './expense.ts';
import { checkRules, onlyNeedsConfirmation, type ExpenseFacts } from './expense-rules.ts';

const proposal = toProposal({ idempotency_key: 'key-0001', amount_cents: 18500, currency: 'ZAR', occurred_on: '2026-03-14', merchant_name: 'Woolworths', category_id: 'groceries' });
const facts: ExpenseFacts = { today: '2026-03-14', category: { id: 'groceries', name: 'Groceries', active: true, kind: 'consumption', class: 'variable' }, similar_ids: [] };
const rules = (f: Partial<ExpenseFacts>, confirmed = false) => checkRules(proposal, { ...facts, ...f }, confirmed).map((p) => p.rule);

test('a sensible proposal has no problem', () => {
  expect(rules({})).toEqual([]);
});

test('R5: the date is not after today', () => {
  expect(rules({ today: '2026-03-13' })).toEqual(['R5']);
  expect(rules({ today: '2026-03-15' })).toEqual([]);
});

test('R6: the category is an active category of the store', () => {
  expect(rules({ category: null })).toEqual(['R6']);
  expect(rules({ category: { id: 'gym', name: 'Gym', active: false, kind: 'consumption', class: 'free' } })).toEqual(['R6']);
});

test('R7: a similar expense needs a confirmation of the person', () => {
  expect(rules({ similar_ids: ['exp_0001'] })).toEqual(['R7']);
  expect(rules({ similar_ids: ['exp_0001'] }, true)).toEqual([]);
  expect(onlyNeedsConfirmation(checkRules(proposal, { ...facts, similar_ids: ['exp_0001'] }, false))).toBe(true);
});

test('all the problems come back, and R7 with a different problem is not only a question', () => {
  const problems = checkRules(proposal, { today: '2026-03-01', category: null, similar_ids: ['exp_0001'] }, false);
  expect(problems.map((p) => p.rule)).toEqual(['R5', 'R6', 'R7']);
  expect(onlyNeedsConfirmation(problems)).toBe(false);
});

test('the merchant key ignores case, spaces and punctuation', () => {
  expect(merchantKey('  Woolworths  Food ')).toBe('woolworths food');
  expect(merchantKey('PICK-N-PAY')).toBe('pick n pay');
});
