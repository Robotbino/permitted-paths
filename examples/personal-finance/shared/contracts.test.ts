import { expect, test } from 'vitest';
import { checkShape, isRealDate } from './contracts.ts';

const good = { idempotency_key: 'key-0001', amount_cents: 18500, currency: 'ZAR', occurred_on: '2026-03-14', merchant_name: 'Woolworths', category_id: 'groceries' };
const rulesOf = (input: unknown) => {
  const result = checkShape(input);
  return result.ok ? [] : result.problems.map((p) => p.rule);
};

test('a request that obeys the contract is PASS', () => {
  expect(checkShape(good).ok).toBe(true);
});

test('each rule of shape has a FAIL case', () => {
  expect(rulesOf({ ...good, amount_cents: 0 })).toEqual(['R1']);
  expect(rulesOf({ ...good, amount_cents: 185.5 })).toEqual(['R1']);
  expect(rulesOf({ ...good, amount_cents: '18500' })).toEqual(['R1']);
  expect(rulesOf({ ...good, currency: 'USD' })).toEqual(['R2']);
  expect(rulesOf({ ...good, occurred_on: '2026-02-30' })).toEqual(['R3']);
  expect(rulesOf({ ...good, occurred_on: '14/03/2026' })).toEqual(['R3']);
  expect(rulesOf({ ...good, merchant_name: '   ' })).toEqual(['R4']);
});

test('a field that is not in the contract is a problem', () => {
  expect(rulesOf({ ...good, spent_cents: 1 })).toEqual(['R4']);
});

test('all the problems come back, not only the first', () => {
  expect(rulesOf({ ...good, amount_cents: -1, currency: 'EUR' })).toEqual(['R1', 'R2']);
});

test('a real calendar date', () => {
  expect(isRealDate('2024-02-29')).toBe(true); // a leap year
  expect(isRealDate('2026-02-29')).toBe(false);
  expect(isRealDate('2026-13-01')).toBe(false);
});
