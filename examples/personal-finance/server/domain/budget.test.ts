import { expect, test } from 'vitest';
import { budgetStatus, monthRange } from './budget.ts';

test('the four states of a budget', () => {
  expect(budgetStatus('c', '2026-03', null, 500).state).toBe('NO_BUDGET');
  expect(budgetStatus('c', '2026-03', 1000, 799).state).toBe('WITHIN');
  expect(budgetStatus('c', '2026-03', 1000, 800).state).toBe('NEAR'); // exactly 80%
  expect(budgetStatus('c', '2026-03', 1000, 1000).state).toBe('NEAR'); // exactly the limit is not over
  expect(budgetStatus('c', '2026-03', 1000, 1001).state).toBe('OVER');
});

test('the remaining amount can be negative', () => {
  expect(budgetStatus('c', '2026-03', 1000, 1250).remaining_cents).toBe(-250);
});

test('the range of a month, also at the end of the year', () => {
  expect(monthRange('2026-03')).toEqual({ from: '2026-03-01', before: '2026-04-01' });
  expect(monthRange('2026-12')).toEqual({ from: '2026-12-01', before: '2027-01-01' });
});
