// Money. An amount is an integer number of cents and a currency code.
// The program never uses a floating-point number for an amount: 0.1 + 0.2 is not 0.3 in binary.
// Text from a person ("185.00", "185,5", "R 1 250") becomes cents by string operations only.

export const CURRENCIES = ['ZAR'] as const;
export type Currency = (typeof CURRENCIES)[number];

export type Money = { cents: number; currency: Currency };

/** Rule R1: the largest amount of one expense. R1 000 000.00. */
export const MAX_CENTS = 100_000_000;

/** Text of a person to cents. Returns null if the text is not an amount. */
export function parseAmount(text: string): number | null {
  const clean = text.replace(/\s/g, '').replace(/^R/i, '');
  const m = /^(\d{1,9})(?:[.,](\d{1,2}))?$/.exec(clean);
  if (!m) return null;
  const whole = Number(m[1]);
  const fraction = Number((m[2] ?? '').padEnd(2, '0'));
  return whole * 100 + fraction;
}

/** Cents to text for a person: 125000 -> "R1 250.00". No Intl, thus the result is the same on each device. */
export function formatMoney(cents: number, currency: Currency = 'ZAR'): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const whole = String(Math.trunc(abs / 100)).replace(/\B(?=(\d{3})+$)/g, ' ');
  const fraction = String(abs % 100).padStart(2, '0');
  const symbol = currency === 'ZAR' ? 'R' : currency + ' ';
  return sign + symbol + whole + '.' + fraction;
}
