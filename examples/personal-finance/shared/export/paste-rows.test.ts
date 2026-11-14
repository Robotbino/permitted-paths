import { describe, expect, test } from 'vitest';
import { EXPORT_PROFILES, formatAmount, pasteRows, safeCell, type ExportProfile, type LedgerEntry } from './paste-rows.ts';

const DEFAULT = EXPORT_PROFILES[0]!;
const TRACKER = EXPORT_PROFILES[1]!;

const ENTRIES: LedgerEntry[] = [
  { occurred_on: '2026-02-25', description: 'Salary Acme Logistics', amount_cents: 2850000, category_name: 'Salary', note: '', kind: 'income' },
  { occurred_on: '2026-02-27', description: 'Savings pocket', amount_cents: 300000, category_name: 'Savings', note: 'monthly', kind: 'savings' },
  { occurred_on: '2026-03-01', description: 'Greenleaf Market', amount_cents: 84235, category_name: 'Groceries', note: 'week 1', kind: 'consumption' },
  { occurred_on: '2026-03-03', description: 'Transfer to Harbour Bank', amount_cents: 250000, category_name: '', note: '', kind: 'transfer' },
  { occurred_on: '2026-03-05', description: 'Corner Cafe', amount_cents: 6800, category_name: 'Eating out', note: '', kind: 'consumption' },
];

describe('pasteRows', () => {
  test('the default profile gives ISO dates, its own column order, and leaves savings out', () => {
    const result = pasteRows(ENTRIES, DEFAULT);
    expect(result.expenses_tsv).toBe('2026-03-01\tGreenleaf Market\tGroceries\t842.35\tweek 1\n2026-03-05\tCorner Cafe\tEating out\t68.00\t');
    expect(result.income_tsv).toBe('2026-02-25\tSalary Acme Logistics\t28500.00\t');
    expect(result.notes).toContain('Savings: 1 moves to savings are left out. This template has no place for them.');
  });

  test('the two-tab tracker gives MM-DD-YYYY dates and books the move to savings as an expense', () => {
    const result = pasteRows(ENTRIES, TRACKER);
    expect(result.expenses_tsv.split('\n')).toEqual([
      '02-27-2026\tSavings pocket\t3000.00\tSavings\tmonthly',
      '03-01-2026\tGreenleaf Market\t842.35\tGroceries\tweek 1',
      '03-05-2026\tCorner Cafe\t68.00\tEating out\t',
    ]);
    expect(result.income_tsv).toBe('02-25-2026\tSalary Acme Logistics\t28500.00\tSalary\t');
    expect(result.notes).toContain('Savings: 1 moves to savings are in the expenses rows, because this template books a move to savings as an expense.');
  });

  test('transfers are left out and a note says how many', () => {
    for (const profile of EXPORT_PROFILES) {
      const result = pasteRows(ENTRIES, profile);
      expect(result.expenses_tsv + result.income_tsv).not.toContain('Harbour');
      expect(result.notes).toContain('Transfers between your own accounts: 1 left out. A transfer is not an expense and not income.');
    }
  });

  test('the notes give the number of rows and the column order', () => {
    expect(pasteRows(ENTRIES, TRACKER).notes.slice(0, 2)).toEqual([
      'Expenses: 3 rows. Columns in order: Date, Store or source, Amount, Category, Notes.',
      'Income: 1 rows. Columns in order: Date, Store or source, Amount, Category, Notes.',
    ]);
  });

  test('no entries give empty text and notes with zero counts', () => {
    const result = pasteRows([], DEFAULT);
    expect(result.expenses_tsv).toBe('');
    expect(result.income_tsv).toBe('');
    expect(result.notes).toContain('Transfers between your own accounts: 0 left out. A transfer is not an expense and not income.');
  });

  test('a cell that looks like a formula gets an apostrophe in front', () => {
    const risky: LedgerEntry[] = [
      { occurred_on: '2026-03-01', description: '=HYPERLINK("http://example.test")', amount_cents: 100, category_name: '+plus', note: '@mention', kind: 'consumption' },
      { occurred_on: '2026-03-02', description: '-10 voucher', amount_cents: 100, category_name: 'Other', note: '  =1+1', kind: 'consumption' },
    ];
    expect(pasteRows(risky, DEFAULT).expenses_tsv.split('\n')).toEqual([
      "2026-03-01\t'=HYPERLINK(\"http://example.test\")\t'+plus\t1.00\t'@mention",
      "2026-03-02\t'-10 voucher\tOther\t1.00\t'=1+1",
    ]);
  });

  test('a tab or a line break inside a cell becomes a space, thus each row keeps its number of cells', () => {
    const entry: LedgerEntry = { occurred_on: '2026-03-01', description: 'Shop\tname', amount_cents: 500, category_name: 'A\r\nB', note: 'line 1\nline 2', kind: 'consumption' };
    const tsv = pasteRows([entry], DEFAULT).expenses_tsv;
    expect(tsv).toBe('2026-03-01\tShop name\tA B\t5.00\tline 1 line 2');
    expect(tsv.split('\t')).toHaveLength(5);
  });

  test('a decimal comma, the DD/MM/YYYY form and a column without data', () => {
    const profile: ExportProfile = { id: 'x', name: 'x', expenses_columns: ['Date', 'Paid by', 'Amount'], income_columns: ['Date', 'Amount'], date_format: 'DD/MM/YYYY', decimal: ',', savings_go_to: 'left_out' };
    const result = pasteRows(ENTRIES, profile);
    expect(result.expenses_tsv.split('\n')[0]).toBe('01/03/2026\t\t842,35');
    expect(result.income_tsv).toBe('25/02/2026\t28500,00');
    expect(result.notes).toContain('These columns have no data in this application and stay empty: Paid by.');
  });

  test('a date that is not an ISO date goes out as it is, made safe', () => {
    const entry: LedgerEntry = { ...ENTRIES[2]!, occurred_on: '=TODAY()' };
    expect(pasteRows([entry], TRACKER).expenses_tsv.startsWith("'=TODAY()\t")).toBe(true);
  });
});

describe('formatAmount and safeCell', () => {
  test('cents become a positive decimal by string operations', () => {
    expect(formatAmount(5, '.')).toBe('0.05');
    expect(formatAmount(50, '.')).toBe('0.50');
    expect(formatAmount(100, ',')).toBe('1,00');
    expect(formatAmount(-84235, '.')).toBe('842.35'); // always positive
    expect(formatAmount(100_000_000, '.')).toBe('1000000.00');
  });

  test('ordinary text stays as it is', () => {
    expect(safeCell('Greenleaf Market')).toBe('Greenleaf Market');
    expect(safeCell('a - b = c')).toBe('a - b = c');
    expect(safeCell('')).toBe('');
  });

  test('a value that is not a number of cents gives no text', () => {
    expect(formatAmount(Number.NaN, '.')).toBe('');
    expect(formatAmount(Number.POSITIVE_INFINITY, '.')).toBe('');
  });

  test('a quote mark at the start gets an apostrophe, thus a sheet does not remove it and run the formula', () => {
    expect(safeCell('"=1+1"')).toBe('\'"=1+1"');
    expect(safeCell('"A B')).toBe('\'"A B');
    expect(safeCell('Kite "Express" Couriers')).toBe('Kite "Express" Couriers');
  });

  test('a hidden character or a control character before a formula sign does not hide it', () => {
    expect(safeCell('​=1+1')).toBe("'=1+1");
    expect(safeCell('\u0000=1')).toBe("'=1");
    expect(safeCell('﻿‮@SUM(A1)')).toBe("'@SUM(A1)");
    expect(safeCell('a\u0007b')).toBe('a b');
  });
});

describe('pasteRows: entries that a sheet row cannot show', () => {
  const entry = (amount_cents: number, kind: string): LedgerEntry =>
    ({ occurred_on: '2026-03-01', description: 'Greenleaf Market', amount_cents, category_name: 'Groceries', note: '', kind }) as LedgerEntry;

  test('a negative amount is left out with a count: it does not become a positive expense', () => {
    const result = pasteRows([entry(-500, 'consumption'), entry(0, 'income'), entry(10.5, 'consumption'), entry(1200, 'consumption')], DEFAULT);
    expect(result.expenses_tsv).toBe('2026-03-01\tGreenleaf Market\tGroceries\t12.00\t');
    expect(result.income_tsv).toBe('');
    expect(result.notes[0]).toBe('Expenses: 1 rows. Columns in order: Date, Description, Category, Amount, Note.');
    expect(result.notes).toContain('Left out: 3 entries with an amount that is zero, negative or not a whole number of cents. A sheet row has a positive amount only. Add them by hand.');
  });

  test('an entry with a kind that is not known is left out with a count', () => {
    const result = pasteRows([entry(1200, 'gift'), entry(1200, 'consumption')], DEFAULT);
    expect(result.expenses_tsv.split('\n')).toHaveLength(1);
    expect(result.notes).toContain('Left out: 1 entries with a kind that this export does not know.');
  });

  test('entries that are all correct give no "Left out" note', () => {
    expect(pasteRows(ENTRIES, DEFAULT).notes.some((note) => note.startsWith('Left out'))).toBe(false);
  });
});
