// Stage 4 of the import pipeline: normalise. Rows of cells go in; staged rows come out.
// A staged row has one date form, cents, a direction, a clean description and a fingerprint.
// Each value that this stage changes gets a provenance step, thus a person can see where a value
// came from and how it was changed. A row with a problem stays in the output with its problems;
// the other rows continue. Nothing here writes to a store: a person reviews the staged rows first.
import type { Problem } from '../contracts.ts';
import { cleanerFor } from './clean.ts';
import type { Inspected } from './inspect.ts';
import { cellReader, columnIndex, isHeaderRow, type MappingProfile } from './profiles.ts';
import { parseCents, parseDate, readMoney, type Direction } from './values.ts';

export { cleanDescription } from './clean.ts';

export const ROW_KINDS = ['expense', 'income', 'fee', 'pending', 'reversal'] as const;
export type RowKind = (typeof ROW_KINDS)[number];

export type ProvenanceStep = { step: string; field: string; from: string; to: string };

export type StagedRow = {
  line_no: number;
  raw: string;
  account: string;
  occurred_on: string | null;
  amount_cents: number | null; // positive
  direction: Direction | null;
  description: string;
  description_clean: string;
  type: string | null;
  kind: RowKind;
  balance_after_cents: number | null;
  fingerprint: string;
  provenance: ProvenanceStep[];
  problems: Problem[];
  status: 'new';
};

export type NormaliseContext = { account: string; source_name: string };

/** The kind of a row. The type values of the profile come first; without a match, the direction decides. */
function kindOf(profile: MappingProfile, type: string | null, description: string, direction: Direction | null): { kind: RowKind; from: string } {
  const probe = (type ?? description).trim().toLowerCase();
  const matches = (values: string[] | undefined): boolean =>
    (values ?? []).some((value) => (type !== null ? probe === value.toLowerCase() : probe.startsWith(value.toLowerCase())));
  const from = type !== null ? 'type "' + type + '"' : 'the start of the description';
  const values = profile.type_values ?? {};
  if (matches(values.pending)) return { kind: 'pending', from };
  if (matches(values.reversal)) return { kind: 'reversal', from };
  if (matches(values.fee)) return { kind: 'fee', from };
  return { kind: direction === 'in' ? 'income' : 'expense', from: 'direction ' + (direction ?? 'unknown') };
}

export function normalise(inspected: Inspected, profile: MappingProfile, ctx: NormaliseContext): { rows: StagedRow[]; problems: Problem[] } {
  const columns = profile.columns;
  const absent = [columns.date, columns.description].filter((name) => columnIndex(inspected.header, name) === -1);
  if (absent.length > 0) {
    const text = 'File "' + ctx.source_name + '": the column "' + absent.join('", "') + '" is not in the file. No row was read.';
    return { rows: [], problems: [{ rule: 'NORMALISE-COLUMNS', text }] };
  }
  const hasType = columnIndex(inspected.header, columns.type) !== -1;
  const clean = cleanerFor(profile);
  const width = inspected.header.length;
  const occurrences = new Map<string, number>();
  const rows: StagedRow[] = [];

  for (const source of inspected.rows) {
    const cell = cellReader(inspected.header, source.cells);
    const provenance: ProvenanceStep[] = [];
    let problems: Problem[] = [];

    // With more or fewer cells than the header, a value can be in the wrong column. Such a row is never trusted.
    if (source.cells.length !== width) {
      problems.push({ rule: 'ROW-CELLS', text: 'The line has ' + source.cells.length + ' cells and the header has ' + width + '. The values can be in the wrong columns.' });
    }

    const dateText = cell(columns.date).trim();
    const occurred_on = parseDate(dateText, profile.date_format);
    if (occurred_on === null) {
      problems.push({ rule: 'ROW-DATE', text: 'The text "' + dateText + '" is not a real date in the form ' + profile.date_format + '.' });
    } else if (occurred_on !== dateText) {
      provenance.push({ step: 'date', field: 'occurred_on', from: dateText, to: occurred_on });
    }

    const money = readMoney(profile, cell);
    for (const problem of money.problems) problems.push(problem);
    if (money.amount_cents !== null && money.direction !== null) {
      provenance.push({ step: 'amount', field: 'amount_cents', from: money.amount_text, to: String(money.amount_cents) });
      provenance.push({ step: 'direction', field: 'direction', from: money.direction_from, to: money.direction });
    }

    const description = cell(columns.description).trim();
    const description_clean = clean(description);
    if (description_clean !== description) {
      provenance.push({ step: 'clean', field: 'description_clean', from: description, to: description_clean });
    }

    const type = hasType ? cell(columns.type).trim() : null;
    const { kind, from } = kindOf(profile, type, description, money.direction);
    provenance.push({ step: 'kind', field: 'kind', from, to: kind });

    let balance_after_cents: number | null = null;
    const balanceText = cell(columns.balance).trim();
    if (balanceText !== '') {
      const balance = parseCents(balanceText, profile.decimal);
      if (balance === null) {
        problems.push({ rule: 'ROW-BALANCE', text: 'The text "' + balanceText + '" is not a balance with the decimal sign "' + profile.decimal + '".' });
      } else {
        balance_after_cents = balance.negative ? -balance.cents : balance.cents;
        provenance.push({ step: 'balance', field: 'balance_after_cents', from: balanceText, to: String(balance_after_cents) });
      }
    }
    if (isHeaderRow(inspected.header, source.cells)) {
      problems = [{ rule: 'ROW-HEADER', text: 'This line is the header line again. Possibly two files are joined into one.' }];
    }

    // The fingerprint. Two equal purchases on one day get the occurrence numbers 0 and 1, thus they are two rows.
    // The same file gives the same fingerprints each time, thus a second import finds each row again.
    // A pending row has its own numbers ("p0"). It never goes to the ledger, thus it must not take the number
    // of the cleared row with the same date, text and amount.
    // Limit: the number counts the equal rows of ONE file. If two equal purchases of one day are in two
    // different files, both get the number 0 and the second one looks like a duplicate.
    const signed = money.amount_cents === null ? '?' : String(money.direction === 'out' ? -money.amount_cents : money.amount_cents);
    const base = [ctx.account, occurred_on ?? '?', signed, description_clean].join('|');
    const counter = kind === 'pending' ? base + '|p' : base;
    const occurrence = occurrences.get(counter) ?? 0;
    occurrences.set(counter, occurrence + 1);

    rows.push({
      line_no: source.line_no,
      raw: source.raw,
      account: ctx.account,
      occurred_on,
      amount_cents: money.amount_cents,
      direction: money.direction,
      description,
      description_clean,
      type,
      kind,
      balance_after_cents,
      fingerprint: counter + (kind === 'pending' ? '' : '|') + occurrence,
      provenance,
      problems,
      status: 'new',
    });
  }
  return { rows, problems: [] };
}
