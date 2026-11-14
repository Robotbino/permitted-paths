// The input of each capability, as a Zod schema. This is check 3 of the action gate.
// Each schema is strict: a field that is not in it is a problem. Each text is plain text: no
// control character, and no text that is only spaces. An id has only letters, digits and . : _ -
// The date formats are the list of the import pipeline, not a copy: a mapping that the gate
// accepts is a mapping that the pipeline can read.
import { z } from 'zod';
import { columnKey, type MappingProfile } from '../../../shared/pipeline/profiles.ts';
import { DATE_FORMATS } from '../../../shared/pipeline/values.ts';
import { isPlainText } from './audit.ts';

export { DATE_FORMATS };
export const PERIODS = ['this_cycle', 'last_cycle'] as const;
export const DECIMAL_MARKS = ['.', ','] as const;

/** Plain text: no control character, no hidden character. The check is isPlainText of audit.ts. */
const PLAIN = { message: 'It must be plain text with no control character.' };
/** An id of the application: letters, digits and . : _ - only. */
export const ID_TEXT = /^[\w.:-]+$/;

/** The name of a column in the statement of the person. Spaces at the two ends do not count. */
const Column = z.string().trim().min(1).max(60).refine(isPlainText, PLAIN);

const COLUMN_FIELDS = ['date', 'description', 'amount', 'debit', 'credit'] as const;

/** Which column of a statement has which meaning. One amount column, or a debit and a credit column. */
export const ColumnMapping = z
  .strictObject({
    date: Column,
    description: Column,
    amount: Column.optional(),
    debit: Column.optional(),
    credit: Column.optional(),
    date_format: z.enum(DATE_FORMATS),
    decimal: z.enum(DECIMAL_MARKS),
  })
  .refine((m) => (m.amount !== undefined ? m.debit === undefined && m.credit === undefined : m.debit !== undefined && m.credit !== undefined), {
    message: 'It must name one amount column, or a debit column and a credit column.',
  })
  .refine(
    (m) => {
      // The pipeline compares column names without case and without spaces. The gate does the same.
      const keys = COLUMN_FIELDS.flatMap((field) => (m[field] === undefined ? [] : [columnKey(m[field])]));
      return new Set(keys).size === keys.length;
    },
    { message: 'One column cannot have two meanings.' },
  );
export type ColumnMapping = z.infer<typeof ColumnMapping>;

export const AnalyseSpendingInput = z.strictObject({ period: z.enum(PERIODS), category_id: z.string().min(1).max(40).regex(ID_TEXT).optional() });
export const SuggestCategoryInput = z.strictObject({ merchant_name: z.string().trim().min(1).max(80).refine(isPlainText, PLAIN) });
export const ProposeColumnMappingInput = z.strictObject({ batch_id: z.string().min(1).max(64).regex(ID_TEXT), mapping: ColumnMapping });
export const RecommendAllowanceInput = z.strictObject({ change_percent: z.number().int().min(-50).max(50), reason: z.string().max(200).refine(isPlainText, PLAIN) });

export type AnalyseSpendingInput = z.infer<typeof AnalyseSpendingInput>;
export type SuggestCategoryInput = z.infer<typeof SuggestCategoryInput>;
export type ProposeColumnMappingInput = z.infer<typeof ProposeColumnMappingInput>;
export type RecommendAllowanceInput = z.infer<typeof RecommendAllowanceInput>;

/**
 * The mapping in the form of the import pipeline. The gate has a flat mapping (it is what a model
 * can give); the pipeline has the columns in one object. An executor uses this function, thus no
 * executor converts by hand.
 */
export function toMappingProfile(mapping: ColumnMapping, id: string, name: string): MappingProfile {
  const columns: MappingProfile['columns'] = { date: mapping.date, description: mapping.description };
  if (mapping.amount !== undefined) columns.amount = mapping.amount;
  if (mapping.debit !== undefined) columns.debit = mapping.debit;
  if (mapping.credit !== undefined) columns.credit = mapping.credit;
  return { id, name, columns, date_format: mapping.date_format, decimal: mapping.decimal };
}
