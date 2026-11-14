// Level 4. The contracts of "import a statement": many expenses in one operation, in two steps.
// Step 1 reads the statement and proposes. Step 2 gets the decisions of the person and records.
import { z } from 'zod';
import type { Problem } from './contracts.ts';

export const ImportRequest = z.strictObject({ csv: z.string().min(1).max(9000) });

export const DecideRequest = z.strictObject({
  decisions: z.array(z.strictObject({ line_no: z.number().int().min(1), category_id: z.string().min(1).max(40).nullable() })).max(200),
});
export type DecideRequest = z.infer<typeof DecideRequest>;

/** One line of the statement after the parser. `problem` is not null when the line cannot become an expense. */
export type StatementLine = {
  line_no: number;
  raw: string;
  occurred_on: string | null;
  merchant_name: string | null;
  amount_cents: number | null;
  problem: Problem | null;
};

export type LineSuggestion = { category_id: string; category_name: string; source: 'memory' | 'model'; run_id: string } | null;

/** Rule R14: each line of a statement has exactly one of these four ends. */
export const LINE_ENDS = ['RECORDED', 'DUPLICATE', 'REJECTED', 'WAITING'] as const;
export type LineEnd = (typeof LINE_ENDS)[number];
export type LineOutcome = { line_no: number; end: LineEnd; expense_id: string | null; detail: string };

/** The answer of step 1: what the application read, and what it proposes. Nothing is recorded yet. */
export type ImportProposal = {
  batch_id: string;
  run_id: string;
  lines: Array<StatementLine & { suggestion: LineSuggestion }>;
  budget: { unknown_merchants: number; model_calls_allowed: number; model_calls_made: number };
};

/** The answer of step 2: the end of each line, and the independent check that the ends are complete. */
export type ImportResult = {
  batch_id: string;
  run_id: string;
  outcomes: LineOutcome[];
  counts: Record<LineEnd, number>;
  reconciliation: { ok: boolean; problems: Problem[] };
};
