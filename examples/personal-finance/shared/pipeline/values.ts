// The readers of single values: a date, an amount, and the money of one row.
// The mapping check (profiles.ts) and the normalise stage (normalise.ts) use the same readers,
// thus a mapping that passes the dry run reads the rows in the same way later.
// An amount becomes cents by string operations only. No floating-point number touches it.
import type { Problem } from '../contracts.ts';
import { isRealDate } from '../dates.ts';
import { formatMoney, MAX_CENTS, parseAmount } from '../money.ts';
import type { MappingProfile } from './profiles.ts';

export const DATE_FORMATS = ['YYYY-MM-DD', 'YYYYMMDD', 'DD/MM/YYYY', 'MM/DD/YYYY'] as const;
export type DateFormat = (typeof DATE_FORMATS)[number];

export const DIRECTIONS = ['out', 'in'] as const;
export type Direction = (typeof DIRECTIONS)[number];

// The pattern of each format, and the group number of the year, the month and the day.
const DATE_PATTERNS: Record<DateFormat, { pattern: RegExp; y: number; m: number; d: number }> = {
  'YYYY-MM-DD': { pattern: /^(\d{4})-(\d{2})-(\d{2})$/, y: 1, m: 2, d: 3 },
  YYYYMMDD: { pattern: /^(\d{4})(\d{2})(\d{2})$/, y: 1, m: 2, d: 3 },
  'DD/MM/YYYY': { pattern: /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, y: 3, m: 2, d: 1 },
  'MM/DD/YYYY': { pattern: /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, y: 3, m: 1, d: 2 },
};

/** Text in the given format to a local date YYYY-MM-DD. null: the text has a different form, or the date does not exist. */
export function parseDate(text: string, format: DateFormat): string | null {
  const spec = DATE_PATTERNS[format];
  const match = spec.pattern.exec(text.trim());
  if (!match) return null;
  const iso = (match[spec.y] ?? '') + '-' + (match[spec.m] ?? '').padStart(2, '0') + '-' + (match[spec.d] ?? '').padStart(2, '0');
  return isRealDate(iso) ? iso : null;
}

/** The number of the day of a local date. Date.UTC only, thus no time zone and no clock change can move it. */
export function dayNumber(date: string): number {
  return Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10))) / 86_400_000;
}

/** The number of days from date a to date b. It is negative if b is before a. */
export function daysBetween(a: string, b: string): number {
  return dayNumber(b) - dayNumber(a);
}

/**
 * Amount text to cents and a sign. Only the decimal sign of the profile is permitted: the other sign makes the text ambiguous.
 * A space is permitted only between groups of three digits: "1 250,00". The text "12 50" is not clear, thus the result is null.
 */
export function parseCents(text: string, decimal: '.' | ','): { cents: number; negative: boolean } | null {
  let body = text.trim();
  let negative = false;
  if (body.startsWith('-')) {
    negative = true;
    body = body.slice(1);
  } else if (body.startsWith('+')) body = body.slice(1);
  body = body.trim().replace(/^R\s*/i, '');
  if (body.includes(decimal === ',' ? '.' : ',')) return null;
  if (/\s/.test(body) && !/^\d{1,3}(?:\s\d{3})+(?:[.,]\d{1,2})?$/.test(body)) return null;
  body = body.replace(/\s/g, '');
  if (decimal === ',') body = body.replace(',', '.');
  const cents = parseAmount(body);
  return cents === null ? null : { cents, negative };
}

export type RowMoney = {
  amount_cents: number | null; // positive
  direction: Direction | null;
  /** The text that the amount came from, and where the direction came from. For the provenance. */
  amount_text: string;
  direction_from: string;
  problems: Problem[];
};

/**
 * The money of one row. cell(name) gives the text of a column, or '' if the column is absent.
 * One signed column: the sign gives the direction. Two columns: the column that has text gives the direction.
 */
export function readMoney(profile: MappingProfile, cell: (name: string | undefined) => string): RowMoney {
  const columns = profile.columns;
  let text: string;
  let direction: Direction;
  let direction_from: string;
  const none = (amount_text: string, problem: Problem): RowMoney => ({ amount_cents: null, direction: null, amount_text, direction_from: '', problems: [problem] });

  if (columns.amount !== undefined) {
    text = cell(columns.amount).trim();
    const parsed = parseCents(text, profile.decimal);
    if (!parsed) return none(text, notAnAmount(text, profile.decimal));
    const negativeMeans = profile.negative_means ?? 'out';
    direction = parsed.negative ? negativeMeans : negativeMeans === 'out' ? 'in' : 'out';
    direction_from = parsed.negative ? 'a minus sign' : 'no minus sign';
    return finish(parsed.cents, direction, text, direction_from);
  }
  const debitText = cell(columns.debit).trim();
  const creditText = cell(columns.credit).trim();
  // Some banks write 0,00 in the column that is not used. A zero beside an amount is the same as an empty cell.
  const isZero = (value: string): boolean => parseCents(value, profile.decimal)?.cents === 0;
  const debit = creditText !== '' && isZero(debitText) ? '' : debitText;
  const credit = debit !== '' && isZero(creditText) ? '' : creditText;
  if (debit !== '' && credit !== '') {
    return none(debit + ' | ' + credit, { rule: 'ROW-BOTH', text: 'The money-out column and the money-in column both have an amount. One of them must be empty.' });
  }
  if (debit === '' && credit === '') {
    return none('', { rule: 'ROW-NONE', text: 'The money-out column and the money-in column are both empty.' });
  }
  text = debit !== '' ? debit : credit;
  direction = debit !== '' ? 'out' : 'in';
  const column = String(debit !== '' ? columns.debit : columns.credit);
  direction_from = 'the column "' + column + '"';
  const parsed = parseCents(text, profile.decimal);
  if (!parsed) return none(text, notAnAmount(text, profile.decimal));
  if (parsed.negative) {
    // The column gives the direction. A minus sign there can be a correction or the opposite direction: it is not clear.
    return none(text, { rule: 'ROW-SIGN', text: 'The column "' + column + '" has the amount "' + text + '" with a minus sign. The direction is not clear.' });
  }
  return finish(parsed.cents, direction, text, direction_from);
}

function finish(cents: number, direction: Direction, amount_text: string, direction_from: string): RowMoney {
  if (cents === 0) {
    return { amount_cents: null, direction: null, amount_text, direction_from: '', problems: [{ rule: 'ROW-ZERO', text: 'The amount is zero. A row must move money.' }] };
  }
  if (cents > MAX_CENTS) {
    const text = 'The amount "' + amount_text + '" is more than ' + formatMoney(MAX_CENTS) + ', the largest amount of one ledger entry (rule R1).';
    return { amount_cents: null, direction: null, amount_text, direction_from: '', problems: [{ rule: 'ROW-LARGE', text }] };
  }
  return { amount_cents: cents, direction, amount_text, direction_from, problems: [] };
}

function notAnAmount(text: string, decimal: string): Problem {
  return { rule: 'ROW-AMOUNT', text: 'The text "' + text + '" is not an amount with the decimal sign "' + decimal + '".' };
}
