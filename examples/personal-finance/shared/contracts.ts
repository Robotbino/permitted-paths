// The shared contracts. The web application and the server import this one file,
// thus the two sides cannot have different ideas of an expense.
// A Zod schema is the check at run time. The TypeScript type comes from the schema.
import { z } from 'zod';
import { CURRENCIES, MAX_CENTS } from './money.ts';

/** A problem that a check found. An empty list of problems is PASS. */
export type Problem = { rule: string; text: string };

/** A real calendar date in the form YYYY-MM-DD. It is a local date: it has no time and no time zone. */
export function isRealDate(text: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
}

/** The request to record one expense. strictObject: a field that is not in the contract is a problem. */
export const RecordExpenseRequest = z.strictObject({
  idempotency_key: z.string().min(8).max(64),
  amount_cents: z.number().int().min(1).max(MAX_CENTS),
  currency: z.enum(CURRENCIES),
  occurred_on: z.string().refine(isRealDate),
  merchant_name: z.string().trim().min(1).max(80),
  category_id: z.string().min(1).max(40),
  note: z.string().max(200).optional(),
  confirm_duplicate: z.boolean().optional(),
  /** Level 3: the run of the suggest graph that the person saw. Only for the trace; it changes nothing in the expense. */
  suggest_run_id: z.string().max(40).optional(),
});
export type RecordExpenseRequest = z.infer<typeof RecordExpenseRequest>;

// The rule that each field of the request belongs to. Rules R1 to R4 are rules of shape.
const RULE_OF_FIELD: Record<string, [rule: string, text: string]> = {
  amount_cents: ['R1', 'The amount must be an integer number of cents, more than 0 and not more than ' + MAX_CENTS + '.'],
  currency: ['R2', 'The currency must be ZAR.'],
  occurred_on: ['R3', 'The date must be a real calendar date in the form YYYY-MM-DD.'],
  merchant_name: ['R4', 'The merchant name must have 1 to 80 characters.'],
};

export type ShapeResult = { ok: true; value: RecordExpenseRequest } | { ok: false; problems: Problem[] };

/** The check of shape. It reads only the request. It does not read the store. */
export function checkShape(input: unknown): ShapeResult {
  const parsed = RecordExpenseRequest.safeParse(input);
  if (parsed.success) return { ok: true, value: parsed.data };
  const problems: Problem[] = [];
  for (const issue of parsed.error.issues) {
    const field = String(issue.path[0] ?? '');
    const known = RULE_OF_FIELD[field];
    const problem: Problem = known
      ? { rule: known[0], text: known[1] }
      : { rule: 'R4', text: field ? 'The field "' + field + '" is absent or not correct.' : 'The request has a field that the contract does not permit.' };
    if (!problems.some((p) => p.rule === problem.rule && p.text === problem.text)) problems.push(problem);
  }
  return { ok: false, problems };
}

export type Category = { id: string; name: string; active: boolean };

export type Budget = { id: string; category_id: string; period: string; limit_cents: number; currency: 'ZAR' };

export type Expense = {
  id: string;
  idempotency_key: string;
  occurred_on: string; // local date, YYYY-MM-DD
  amount_cents: number;
  currency: 'ZAR';
  merchant_name: string;
  merchant_key: string; // the normalised merchant name
  category_id: string;
  note: string | null;
  created_at: string; // UTC time of the record, for the audit
};

export const BUDGET_STATES = ['NO_BUDGET', 'WITHIN', 'NEAR', 'OVER'] as const;
export type BudgetState = (typeof BUDGET_STATES)[number];

/** The budget of one category in one month. spent_cents is always calculated; no table stores it. */
export type BudgetStatus = {
  category_id: string;
  period: string; // YYYY-MM
  state: BudgetState;
  limit_cents: number | null;
  spent_cents: number;
  remaining_cents: number | null;
};

/** run_id (level 2): the run of the execution graph that made this result. GET /api/runs/<id> gives its trace. */
export type RecordExpenseResult = { expense: Expense; budget: BudgetStatus; replayed: boolean; run_id?: string };

export type MonthSummary = {
  period: string;
  total_spent_cents: number;
  categories: Array<{ category: Category; budget: BudgetStatus }>;
  recent: Expense[];
};

export const ERROR_CODES = ['SHAPE', 'RULE', 'NEEDS_CONFIRMATION', 'KEY_CONFLICT', 'STORAGE_UNAVAILABLE', 'VERIFICATION_FAILED', 'NOT_FOUND', 'BAD_REQUEST', 'INTERNAL'] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

/** Each response that is not a success has this body. */
export type ApiError = { error: { code: ErrorCode; problems: Problem[]; run_id?: string } };
