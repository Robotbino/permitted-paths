// Stage 2 and 3 of the import pipeline: map and validate.
// A mapping profile says which column of a file is the date, the description and the amount, and how to read them.
// Two profiles for two fictional banks are here. A file that matches no profile needs a mapping from a person
// (or, at level 3, a proposal from a model). validateMapping is the gate for ANY mapping, whoever proposed it:
// it is a dry run on the real file, and a mapping that does not PASS is not used.
import type { Problem } from '../contracts.ts';
import { cleanerFor } from './clean.ts';
import type { Inspected } from './inspect.ts';
import { checkMappingShape } from './mapping-shape.ts';
import { parseDate, readMoney, type DateFormat, type Direction } from './values.ts';

export type MappingProfile = {
  id: string;
  name: string;
  /** Header names. Either amount, or debit and credit. */
  columns: { date: string; description: string; amount?: string; debit?: string; credit?: string; type?: string; balance?: string };
  date_format: DateFormat;
  decimal: '.' | ',';
  /** For one signed amount column. If it is absent, a negative amount is money out. */
  negative_means?: Direction;
  /** The values of the type column. If the profile has no type column, they are compared with the start of the description. */
  type_values?: { pending?: string[]; reversal?: string[]; fee?: string[] };
  /**
   * Text that is removed from a description. Plain text is a literal prefix: it is removed at the start only.
   * Text with expression signs (^ $ \d [ ] and so on) is a regular expression source: each match is removed.
   * Only a safe part of the expression language is permitted (see clean.ts).
   */
  clean?: Array<{ remove: string }>;
};

/** The number of rows that the dry run reads. */
export const DRY_RUN_ROWS = 20;

export const PROFILES: MappingProfile[] = [
  {
    id: 'northbank',
    name: 'Northbank (fictional): semicolons, a Debit and a Credit column, a running balance',
    columns: { date: 'Posting Date', description: 'Details', debit: 'Debit', credit: 'Credit', balance: 'Balance' },
    date_format: 'DD/MM/YYYY',
    decimal: ',',
    type_values: { fee: ['FEE:'] },
    clean: [{ remove: '^CARD PURCHASE ' }, { remove: ' CARD \\d{4}$' }],
  },
  {
    id: 'harbour',
    name: 'Harbour Bank (fictional): quoted cells, one signed amount, a Type column',
    columns: { date: 'Date', description: 'Description', amount: 'Amount', type: 'Type' },
    date_format: 'YYYY-MM-DD',
    decimal: '.',
    negative_means: 'out',
    type_values: { pending: ['PENDING'], reversal: ['REVERSAL'], fee: ['FEE'] },
  },
];

/** A header name without case and without spaces: "Posting Date" and "posting date " are the same column. */
export function columnKey(name: string): string {
  return name.toLowerCase().replace(/\s/g, '');
}

/** The position of a column in the header, or -1. */
export function columnIndex(header: string[], name: string | undefined): number {
  if (name === undefined) return -1;
  const key = columnKey(name);
  return header.findIndex((cell) => columnKey(cell) === key);
}

/** A function that gives the text of a named column of one row. An absent column or cell gives ''. */
export function cellReader(header: string[], cells: string[]): (name: string | undefined) => string {
  return (name) => cells[columnIndex(header, name)] ?? '';
}

function mappedColumns(profile: MappingProfile): Array<[field: string, name: string]> {
  const result: Array<[string, string]> = [];
  for (const [field, name] of Object.entries(profile.columns)) if (typeof name === 'string') result.push([field, name]);
  return result;
}

/** true: the cells of a row are the header again. This occurs when two files are joined into one. */
export function isHeaderRow(header: string[], cells: string[]): boolean {
  return cells.length === header.length && cells.every((cell, i) => columnKey(cell) === columnKey(header[i] ?? ''));
}

/**
 * The one profile of which each needed column is in the header. The names must be equal; case and spaces do not count.
 * The file can have more columns (for example a time). If two profiles fit, none is chosen.
 * null means: a person (or a model proposal that passes validateMapping) must give the mapping.
 */
export function matchProfile(header: string[]): MappingProfile | null {
  const fits = PROFILES.filter((profile) => mappedColumns(profile).every(([, name]) => columnIndex(header, name) !== -1));
  return fits.length === 1 ? (fits[0] ?? null) : null;
}

/**
 * The gate for a mapping: a dry run. An empty list is PASS. It never throws, also for a value that is not a mapping.
 * Checks: the shape and the permitted values (mapping-shape.ts); either amount, or debit and credit;
 * each mapped column is in the header one time; the file has rows; each of the first 20 rows gives a real date
 * and an amount; the "remove" entries leave text in each description.
 */
export function validateMapping(profile: MappingProfile, inspected: Inspected): Problem[] {
  const problems: Problem[] = checkMappingShape(profile);
  if (problems.length > 0) return problems;
  const columns = profile.columns;
  const single = columns.amount !== undefined;
  const anyPair = columns.debit !== undefined || columns.credit !== undefined;
  const fullPair = columns.debit !== undefined && columns.credit !== undefined;
  if (single === anyPair || (!single && !fullPair)) {
    problems.push({ rule: 'MAP-AMOUNT-COLUMNS', text: 'The mapping must name one amount column, or a money-out column and a money-in column. Not both and not one half.' });
  }
  for (const [field, name] of mappedColumns(profile)) {
    const key = columnKey(name);
    const count = inspected.header.filter((cell) => columnKey(cell) === key).length;
    if (count === 0) problems.push({ rule: 'MAP-COLUMN', text: 'The column "' + name + '" (for ' + field + ') is not in the file.' });
    if (count > 1) problems.push({ rule: 'MAP-COLUMN-TWICE', text: 'The column "' + name + '" (for ' + field + ') is in the file ' + count + ' times. It is not clear which one to read.' });
  }
  if (inspected.rows.length === 0) problems.push({ rule: 'MAP-NO-ROWS', text: 'The file has no rows, thus the mapping cannot be tried.' });
  if (problems.length > 0) return problems;

  const clean = cleanerFor(profile);
  const hasClean = (profile.clean ?? []).length > 0;
  for (const row of inspected.rows.slice(0, DRY_RUN_ROWS)) {
    if (isHeaderRow(inspected.header, row.cells)) continue; // a second header line is a problem of that row, not of the mapping
    const cell = cellReader(inspected.header, row.cells);
    const dateText = cell(columns.date);
    if (parseDate(dateText, profile.date_format) === null) {
      problems.push({ rule: 'MAP-DATE', text: 'Line ' + row.line_no + ': the text "' + dateText + '" is not a real date in the form ' + profile.date_format + '.' });
    }
    for (const problem of readMoney(profile, cell).problems) {
      problems.push({ rule: 'MAP-AMOUNT', text: 'Line ' + row.line_no + ': ' + problem.text });
    }
    const description = cell(columns.description).trim();
    if (hasClean && description !== '' && clean(description) === '') {
      problems.push({ rule: 'MAP-CLEAN', text: 'Line ' + row.line_no + ': the "remove" entries remove the whole description "' + description + '". Then different rows look the same.' });
    }
  }
  return problems;
}
