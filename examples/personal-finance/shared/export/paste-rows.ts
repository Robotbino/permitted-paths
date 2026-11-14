// The export: ledger entries become tab-separated rows that a person pastes into a budget sheet.
// The application does not connect to a sheet. The person copies the text, thus the person stays in control.
// An export profile gives the column order, the date form and the decimal sign of one kind of template.
// The notes say plainly what was left out and how savings are mapped, thus the sheet has no silent difference.
// A cell is made safe before it goes out: a spreadsheet must not run pasted text as a formula.

export const ENTRY_KINDS = ['consumption', 'savings', 'income', 'transfer'] as const;
export type EntryKind = (typeof ENTRY_KINDS)[number];

export type LedgerEntry = { occurred_on: string; description: string; amount_cents: number; category_name: string; note: string; kind: EntryKind };

export type ExportProfile = {
  id: string;
  name: string;
  /** The columns of the template, in order. Known names: Date, Description, Store or source, Amount, Category, Note, Notes. */
  expenses_columns: string[];
  income_columns: string[];
  date_format: 'YYYY-MM-DD' | 'MM-DD-YYYY' | 'DD/MM/YYYY';
  decimal: '.' | ',';
  savings_go_to: 'expenses' | 'left_out';
};

export const EXPORT_PROFILES: ExportProfile[] = [
  {
    id: 'default',
    name: 'The simple template of this application',
    expenses_columns: ['Date', 'Description', 'Category', 'Amount', 'Note'],
    income_columns: ['Date', 'Description', 'Amount', 'Note'],
    date_format: 'YYYY-MM-DD',
    decimal: '.',
    savings_go_to: 'left_out',
  },
  {
    id: 'two-tab-tracker',
    name: 'A budget template with an Expenses tab and an Income tab',
    expenses_columns: ['Date', 'Store or source', 'Amount', 'Category', 'Notes'],
    income_columns: ['Date', 'Store or source', 'Amount', 'Category', 'Notes'],
    date_format: 'MM-DD-YYYY',
    decimal: '.',
    savings_go_to: 'expenses',
  },
];

type Field = 'date' | 'description' | 'amount' | 'category' | 'note';

// The field that each known column name shows.
const FIELD_OF_COLUMN: Record<string, Field> = {
  date: 'date',
  description: 'description',
  'store or source': 'description',
  amount: 'amount',
  category: 'category',
  note: 'note',
  notes: 'note',
};

function fieldOf(column: string): Field | undefined {
  return FIELD_OF_COLUMN[column.trim().toLowerCase()];
}

/** Cents to a positive decimal, by string operations: 125050 -> "1250.50". No thousands sign: a sheet reads it as text. */
export function formatAmount(cents: number, decimal: '.' | ','): string {
  if (!Number.isSafeInteger(Math.trunc(cents))) return ''; // not a number of cents: no text is better than incorrect text
  const digits = String(Math.abs(Math.trunc(cents))).padStart(3, '0');
  return digits.slice(0, -2) + decimal + digits.slice(-2);
}

function formatDate(date: string, format: ExportProfile['date_format']): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return date;
  if (format === 'MM-DD-YYYY') return m[2] + '-' + m[3] + '-' + m[1];
  if (format === 'DD/MM/YYYY') return m[3] + '/' + m[2] + '/' + m[1];
  return date;
}

/**
 * Text that is safe in one cell. A tab, a line break or a different control character becomes a space,
 * and a hidden format character (for example a zero-width space) goes: it can hide the first sign of a formula.
 * Text that starts with =, +, - or @ gets an apostrophe in front, thus the spreadsheet shows it and does not run it.
 * Text that starts with a quote mark gets one too: a spreadsheet can read a pasted quote mark as the start
 * of a quoted cell, remove it, and join the cells after it.
 */
export function safeCell(text: string): string {
  const oneLine = String(text ?? '')
    .replace(/[\u0000-\u001f\u007f-\u009f]+/g, ' ')
    .replace(/[\u200b-\u200f\u202a-\u202e\u2060-\u2064\ufeff]/g, '')
    .trim();
  return /^[=+\-@"]/.test(oneLine) ? "'" + oneLine : oneLine;
}

/** true: the amount is a whole number of cents and more than zero. Only such an entry goes into a sheet. */
function hasAmount(entry: LedgerEntry): boolean {
  return Number.isSafeInteger(entry.amount_cents) && entry.amount_cents > 0;
}

function line(entry: LedgerEntry, columns: string[], profile: ExportProfile): string {
  return columns
    .map((column) => {
      const field = fieldOf(column);
      if (field === 'date') return safeCell(formatDate(entry.occurred_on, profile.date_format));
      if (field === 'description') return safeCell(entry.description);
      if (field === 'amount') return formatAmount(entry.amount_cents, profile.decimal);
      if (field === 'category') return safeCell(entry.category_name);
      if (field === 'note') return safeCell(entry.note);
      return '';
    })
    .join('\t');
}

/** Ledger entries to two blocks of rows without a header line: one for the Expenses tab and one for the Income tab. */
export function pasteRows(entries: LedgerEntry[], profile: ExportProfile): { expenses_tsv: string; income_tsv: string; notes: string[] } {
  const savingsToExpenses = profile.savings_go_to === 'expenses';
  const all = entries;
  entries = all.filter((entry) => (ENTRY_KINDS as readonly string[]).includes(entry.kind) && (entry.kind === 'transfer' || hasAmount(entry)));
  const unknownKind = all.filter((entry) => !(ENTRY_KINDS as readonly string[]).includes(entry.kind)).length;
  const noAmount = all.length - entries.length - unknownKind;
  const expenses = entries.filter((entry) => entry.kind === 'consumption' || (savingsToExpenses && entry.kind === 'savings'));
  const income = entries.filter((entry) => entry.kind === 'income');
  const savings = entries.filter((entry) => entry.kind === 'savings').length;
  const transfers = entries.filter((entry) => entry.kind === 'transfer').length;

  const notes: string[] = [
    'Expenses: ' + expenses.length + ' rows. Columns in order: ' + profile.expenses_columns.join(', ') + '.',
    'Income: ' + income.length + ' rows. Columns in order: ' + profile.income_columns.join(', ') + '.',
    'The rows have no header line. Amounts are positive, with the decimal sign "' + profile.decimal + '". Dates have the form ' + profile.date_format + '.',
    savingsToExpenses
      ? 'Savings: ' + savings + ' moves to savings are in the expenses rows, because this template books a move to savings as an expense.'
      : 'Savings: ' + savings + ' moves to savings are left out. This template has no place for them.',
    'Transfers between your own accounts: ' + transfers + ' left out. A transfer is not an expense and not income.',
  ];
  // The sheet has positive amounts only. An entry with a negative amount (for example a refund) would look like
  // an expense of that amount, thus it is left out and counted here. The person adds it by hand.
  if (noAmount > 0) {
    notes.push('Left out: ' + noAmount + ' entries with an amount that is zero, negative or not a whole number of cents. A sheet row has a positive amount only. Add them by hand.');
  }
  if (unknownKind > 0) notes.push('Left out: ' + unknownKind + ' entries with a kind that this export does not know.');
  const unknown = [...profile.expenses_columns, ...profile.income_columns].filter((column) => fieldOf(column) === undefined);
  if (unknown.length > 0) {
    notes.push('These columns have no data in this application and stay empty: ' + [...new Set(unknown)].join(', ') + '.');
  }
  return {
    expenses_tsv: expenses.map((entry) => line(entry, profile.expenses_columns, profile)).join('\n'),
    income_tsv: income.map((entry) => line(entry, profile.income_columns, profile)).join('\n'),
    notes,
  };
}
