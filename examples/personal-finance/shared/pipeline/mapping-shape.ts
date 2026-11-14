// The shape check of a mapping at run time. A mapping can come from a person, from a file or from a model,
// thus the TypeScript type is not enough: the value can have any form. This check reads the mapping as
// unknown data and gives problems. It never throws. validateMapping (profiles.ts) calls it first,
// and reads a file with the mapping only if this check gives PASS (an empty list).
import type { Problem } from '../contracts.ts';
import { checkRemove, MAX_CLEAN_ENTRIES } from './clean.ts';
import { DATE_FORMATS, DIRECTIONS } from './values.ts';

export const DECIMAL_SIGNS = ['.', ','] as const;
export const COLUMN_FIELDS = ['date', 'description', 'amount', 'debit', 'credit', 'type', 'balance'] as const;
export const TYPE_VALUE_FIELDS = ['pending', 'reversal', 'fee'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isText(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

/** An empty list is PASS: the value has the form of a MappingProfile and each choice is a permitted value. */
export function checkMappingShape(profile: unknown): Problem[] {
  const problems: Problem[] = [];
  const add = (text: string): void => {
    problems.push({ rule: 'MAP-SHAPE', text });
  };
  if (!isRecord(profile)) return [{ rule: 'MAP-SHAPE', text: 'The mapping must be an object.' }];
  if (!isText(profile.id) || !isText(profile.name)) add('The mapping must have an id and a name as text.');

  const columns = profile.columns;
  if (!isRecord(columns)) add('The mapping must have "columns": the header names of the date, the description and the amount.');
  else {
    if (!isText(columns.date) || !isText(columns.description)) add('The columns "date" and "description" must be header names as text.');
    for (const [field, name] of Object.entries(columns)) {
      if (!(COLUMN_FIELDS as readonly string[]).includes(field)) add('The column field "' + field + '" is not known. Permitted: ' + COLUMN_FIELDS.join(', ') + '.');
      else if (name !== undefined && !isText(name)) add('The column "' + field + '" must be a header name as text.');
    }
  }
  if (!(DATE_FORMATS as readonly unknown[]).includes(profile.date_format)) add('The date format must be one of: ' + DATE_FORMATS.join(', ') + '.');
  if (!(DECIMAL_SIGNS as readonly unknown[]).includes(profile.decimal)) add('The decimal sign must be "." or ",".');
  if (profile.negative_means !== undefined && !(DIRECTIONS as readonly unknown[]).includes(profile.negative_means)) {
    add('"negative_means" must be "out" or "in".');
  }

  const typeValues = profile.type_values;
  if (typeValues !== undefined) {
    if (!isRecord(typeValues)) add('"type_values" must be an object with lists of text.');
    else {
      for (const [field, values] of Object.entries(typeValues)) {
        if (!(TYPE_VALUE_FIELDS as readonly string[]).includes(field)) add('The type field "' + field + '" is not known. Permitted: ' + TYPE_VALUE_FIELDS.join(', ') + '.');
        else if (values !== undefined && !(Array.isArray(values) && values.every(isText))) add('"type_values.' + field + '" must be a list of text.');
      }
    }
  }

  const clean = profile.clean;
  if (clean !== undefined) {
    if (!Array.isArray(clean)) add('"clean" must be a list of entries with "remove".');
    else if (clean.length > MAX_CLEAN_ENTRIES) problems.push({ rule: 'MAP-CLEAN', text: '"clean" has ' + clean.length + ' entries. A mapping can have ' + MAX_CLEAN_ENTRIES + ' at most.' });
    else {
      for (const entry of clean) {
        const reason = checkRemove(isRecord(entry) ? entry.remove : undefined);
        if (reason !== null) problems.push({ rule: 'MAP-CLEAN', text: reason });
      }
    }
  }
  return problems;
}
