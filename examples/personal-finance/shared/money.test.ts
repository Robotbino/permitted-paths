import { expect, test } from 'vitest';
import { formatMoney, parseAmount } from './money.ts';

test('text of a person becomes an integer number of cents', () => {
  expect(parseAmount('185.00')).toBe(18500);
  expect(parseAmount('185,00')).toBe(18500);
  expect(parseAmount('185')).toBe(18500);
  expect(parseAmount('185.5')).toBe(18550);
  expect(parseAmount('R 1 250.05')).toBe(125005);
});

test('an amount that floating-point arithmetic gets wrong is exact', () => {
  // 0.1 + 0.2 is 0.30000000000000004 as a float. As cents it is 10 + 20 = 30.
  expect(parseAmount('0.1')! + parseAmount('0.2')!).toBe(30);
  expect(parseAmount('19.99')).toBe(1999); // 19.99 * 100 is 1998.9999999999998 as a float
});

test('text that is not an amount gives null', () => {
  for (const text of ['', 'abc', '-5', '1.234', '1e3', '12.3.4']) expect(parseAmount(text)).toBeNull();
});

test('cents become text for a person', () => {
  expect(formatMoney(18500)).toBe('R185.00');
  expect(formatMoney(125005)).toBe('R1 250.05');
  expect(formatMoney(5)).toBe('R0.05');
  expect(formatMoney(-18500)).toBe('-R185.00');
});
