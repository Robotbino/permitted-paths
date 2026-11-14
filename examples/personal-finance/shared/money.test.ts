import { expect, test } from 'vitest';
import { formatMoney, parseAmount, percentOf } from './money.ts';

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

test('a percentage of an amount is an integer number of cents, and half a cent goes away from 0', () => {
  expect(percentOf(245_100, 10)).toBe(24_510);
  expect(percentOf(245_095, 10)).toBe(24_510); // 24 509.5
  expect(percentOf(245_095, -10)).toBe(-24_510); // Math.round gives -24 509 here
  expect(percentOf(245_094, 10)).toBe(24_509); // 24 509.4
  expect(percentOf(-245_095, 10)).toBe(-24_510);
  expect(percentOf(105, 1)).toBe(1); // 1.05
  expect(percentOf(149, 1)).toBe(1); // 1.49
  expect(percentOf(150, 1)).toBe(2); // 1.5
  expect(percentOf(0, 50)).toBe(0);
  expect(percentOf(1, 0)).toBe(0);
  // 1.15 * 100 is 114.99999999999999 as a float. As integers, 15% of 115 cents is 17.25, thus 17.
  expect(percentOf(115, 15)).toBe(17);
  for (const cents of [1, 5, 35, 245_095, 99_999_995]) for (const percent of [1, 7, 10, 50]) expect(percentOf(cents, -percent)).toBe(-percentOf(cents, percent));
});

test('a percentage that is not a whole number, or an amount that is not, is refused', () => {
  expect(() => percentOf(100.5, 10)).toThrow(RangeError);
  expect(() => percentOf(100, 2.5)).toThrow(RangeError);
  expect(() => percentOf(Number.NaN, 10)).toThrow(RangeError);
  expect(() => percentOf(Number.MAX_SAFE_INTEGER, 50)).toThrow(RangeError);
});
