// The flat answer of the real model, and its change into a value of the port.
// Structured outputs do not permit number limits or text length limits, thus the schema here is
// loose on purpose: ONE flat object with a "kind" and optional fields. The code makes a request
// from the fields, and the action gate does all the real checks.
// This file has no SDK. It only changes the form, and it says ERROR for an answer that has no
// form of the port (a kind that is not permitted, a question with no text).
import { z } from 'zod';
import { cutText } from './audit.ts';
import { PERIODS } from './capabilities.ts';
import type { InterpreterOutput } from './interpreter.ts';

export const ANSWER_KINDS = ['ACTION', 'CLARIFY', 'DECLINE'] as const;

/** The flat answer of the model. Each field after "kind" is optional and has no limit: the gate checks. */
export const FlatAnswer = z.object({
  kind: z.enum(ANSWER_KINDS),
  // Text, not a list of names: a name that is not permitted must reach the action gate, which rejects it by name
  // and writes the name in the audit. With a list here, the SDK would refuse the answer before the gate.
  capability: z.string().optional(),
  period: z.enum(PERIODS).optional(),
  category_id: z.string().optional(),
  merchant_name: z.string().optional(),
  batch_id: z.string().optional(),
  map_date: z.string().optional(),
  map_description: z.string().optional(),
  map_amount: z.string().optional(),
  map_debit: z.string().optional(),
  map_credit: z.string().optional(),
  map_date_format: z.string().optional(),
  map_decimal: z.string().optional(),
  change_percent: z.number().optional(),
  reason: z.string().optional(),
  question: z.string().optional(),
  options: z.array(z.string()).optional(),
});
export type FlatAnswer = z.infer<typeof FlatAnswer>;

/** The largest sizes of the texts that go to the person, and the number of options of a question. */
export const MAX_QUESTION = 200;
export const MAX_OPTION = 80;
export const MIN_OPTIONS = 2;
export const MAX_OPTIONS = 4;

/** Only the fields that the model gave. An absent field stays absent, thus the gate sees what is absent. */
function given(fields: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined && value !== null));
}

/** A model can fill a field that it does not use with empty text. For a field that is optional at the gate, that is "absent". */
const optional = (value: unknown): unknown => (typeof value === 'string' && value.trim() === '' ? undefined : value);

/** Text with no spaces at the two ends, or '' if the value is not text. */
const textOf = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

/** The flat answer becomes a value of the port. This is a change of form, not a check of the request. */
export function toInterpreterOutput(a: FlatAnswer): InterpreterOutput {
  const kind: unknown = a.kind;
  if (kind === 'CLARIFY') {
    const question = textOf(a.question);
    if (!question) return { status: 'ERROR', detail: 'The answer was CLARIFY with no question.' };
    const options = (Array.isArray(a.options) ? a.options : []).map(textOf).filter((o) => o !== '').slice(0, MAX_OPTIONS);
    if (options.length < MIN_OPTIONS) return { status: 'ERROR', detail: 'The answer was CLARIFY with fewer than ' + MIN_OPTIONS + ' options.' };
    return { status: 'CLARIFY', question: cutText(question, MAX_QUESTION), options: options.map((o) => cutText(o, MAX_OPTION)) };
  }
  if (kind === 'DECLINE') return { status: 'DECLINE', reason: cutText(textOf(a.reason) || 'This application does not do that.', MAX_QUESTION) };
  if (kind !== 'ACTION') return { status: 'ERROR', detail: 'The answer had a kind that is not permitted.' };
  const capability: unknown = a.capability;
  if (typeof capability !== 'string' || capability === '') return { status: 'ERROR', detail: 'The answer was ACTION with no capability.' };
  const input =
    capability === 'analyse_spending'
      ? given({ period: a.period, category_id: optional(a.category_id) })
      : capability === 'suggest_category'
        ? given({ merchant_name: a.merchant_name })
        : capability === 'propose_column_mapping'
          ? given({
              batch_id: a.batch_id,
              mapping: given({ date: a.map_date, description: a.map_description, amount: optional(a.map_amount), debit: optional(a.map_debit), credit: optional(a.map_credit), date_format: a.map_date_format, decimal: a.map_decimal }),
            })
          : capability === 'recommend_allowance'
            ? given({ change_percent: a.change_percent, reason: a.reason })
            : {}; // a name that is not in the allowlist goes on with no input: the gate rejects it by name
  return { status: 'ACTION', request: { capability, input } };
}
