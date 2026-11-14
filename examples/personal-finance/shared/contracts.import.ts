// Level 3. The contracts of "import a statement": many rows in one operation, in two or three steps.
// Step 1 reads the file and proposes. If the layout of the file is not known, the answer asks for a
// mapping, and a mapping step comes between. The last step gets the decisions of the person and records.
// The rows come from the import pipeline (shared/pipeline); this file gives them the form of the API.
import { z } from 'zod';
import { AccountName, type Problem } from './contracts.ts';
import { DECIMAL_SIGNS } from './pipeline/mapping-shape.ts';
import type { ProvenanceStep, RowKind } from './pipeline/normalise.ts';
import type { RowStatus } from './pipeline/reconcile.ts';
import { DATE_FORMATS, type Direction } from './pipeline/values.ts';

/** One import has this number of lines at most. The proposal and the decisions then fit in one request. */
export const MAX_STATEMENT_LINES = 100;

/**
 * `mapping` is unknown data on purpose: it can come from a person or from a proposal of a model.
 * The mapping gate (validateMapping) reads it and decides. The contract only carries it.
 */
export const ImportRequest = z.strictObject({
  csv: z.string().min(1).max(9000),
  account: AccountName,
  mapping: z.unknown().optional(),
});

/** The mapping step: POST /api/imports/<batch id>/mapping. */
export const MappingRequest = z.strictObject({ mapping: z.unknown() });

export const DecideRequest = z.strictObject({
  decisions: z.array(z.strictObject({ line_no: z.number().int().min(1), category_id: z.string().min(1).max(40).nullable() })).max(MAX_STATEMENT_LINES),
  /** The template of the budget sheet that the export text is for. Without it: 'default'. */
  export_profile: z.string().min(1).max(40).optional(),
});
export type DecideRequest = z.infer<typeof DecideRequest>;

export type LineSuggestion = { category_id: string; category_name: string; source: 'memory' | 'model'; run_id: string } | null;

/** One row of the file as the person sees it in the proposal. Only a row with the status 'new' can go to the ledger. */
export type ImportLine = {
  line_no: number; // the line in the file, from 1. The header is a line too.
  raw: string;
  status: RowStatus;
  /** Why the row is not 'new', in plain words. null for a 'new' row. */
  note: string | null;
  occurred_on: string | null;
  amount_cents: number | null; // positive
  direction: Direction | null;
  description_clean: string;
  kind: RowKind;
  problems: Problem[];
  /** Each value that the pipeline changed: from which text, to which value. */
  provenance: ProvenanceStep[];
  /** Only a 'new' row with money out gets a suggestion. */
  suggestion: LineSuggestion;
};

/** Rule R14: each line of a statement has exactly one of these five ends. PAIRED: not an expense and not income. */
export const LINE_ENDS = ['RECORDED', 'DUPLICATE', 'REJECTED', 'WAITING', 'PAIRED'] as const;
export type LineEnd = (typeof LINE_ENDS)[number];
/** A RECORDED or DUPLICATE line has an expense id (money out) or an income id (money in). */
export type LineOutcome = { line_no: number; end: LineEnd; expense_id: string | null; income_id: string | null; detail: string };

/** The answer of step 1 (or of the mapping step): what the application read, and what it proposes. Nothing is recorded yet. */
export type ImportProposal = {
  step: 'review';
  batch_id: string;
  run_id: string;
  account: string;
  /** The mapping that read the file: a known profile, or the mapping that was given. */
  profile: { id: string; name: string };
  lines: ImportLine[];
  summary: Record<RowStatus, number>;
  /** The problems of the file and of the batch, for example a balance that does not continue. The problems of one row are on that row. */
  problems: Problem[];
  budget: { unknown_merchants: number; model_calls_allowed: number; model_calls_made: number };
};

export type MappingField = { field: string; required: boolean; text: string };

/** What a mapping must say. The answer "a mapping is necessary" carries this list. */
export const MAPPING_FIELDS: MappingField[] = [
  { field: 'id', required: true, text: 'A short name of the mapping, as text.' },
  { field: 'name', required: true, text: 'A sentence that says which file the mapping is for.' },
  { field: 'columns.date', required: true, text: 'The header name of the date column.' },
  { field: 'columns.description', required: true, text: 'The header name of the description column.' },
  { field: 'columns.amount', required: false, text: 'The header name of one signed amount column. Give this, or "debit" and "credit".' },
  { field: 'columns.debit', required: false, text: 'The header name of the money-out column.' },
  { field: 'columns.credit', required: false, text: 'The header name of the money-in column.' },
  { field: 'columns.type', required: false, text: 'The header name of a column that says what a row is (pending, reversal, fee).' },
  { field: 'columns.balance', required: false, text: 'The header name of a running balance column.' },
  { field: 'date_format', required: true, text: 'One of: ' + DATE_FORMATS.join(', ') + '.' },
  { field: 'decimal', required: true, text: 'The decimal sign: ' + DECIMAL_SIGNS.map((sign) => '"' + sign + '"').join(' or ') + '.' },
  { field: 'negative_means', required: false, text: 'For one signed amount column: "out" or "in". Without it, a negative amount is money out.' },
  { field: 'type_values', required: false, text: 'Lists of text for "pending", "reversal" and "fee".' },
  { field: 'clean', required: false, text: 'A list of { remove } entries: text that is removed from a description.' },
];

/** The answer when the layout of the file is not known: the run waits for a mapping. Nothing is staged. */
export type MappingNeeded = {
  step: 'mapping';
  batch_id: string;
  run_id: string;
  account: string;
  header: string[];
  /** The first 5 rows, as cells. */
  rows: string[][];
  fields: MappingField[];
  /** Why a known profile did not read the file. Empty when no profile fits the header. */
  problems: Problem[];
};

/** The answer of the last step: the end of each line, the independent check, and the text for a budget sheet. */
export type ImportResult = {
  batch_id: string;
  run_id: string;
  outcomes: LineOutcome[];
  counts: Record<LineEnd, number>;
  reconciliation: { ok: boolean; problems: Problem[] };
  /** The rows that this import recorded, as tab-separated text. The person copies it; the application writes no sheet. */
  export_profile: string;
  expenses_tsv: string;
  income_tsv: string;
  notes: string[];
};
