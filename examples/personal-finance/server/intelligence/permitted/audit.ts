// The audit record of one request at the action gate: what was asked, when, and what the gate said.
// Each request gets a record, also a rejected one. The record is short. It does not keep long text
// of the person: a text value is cut, thus the audit is not a second copy of what the person wrote.
// The record that the assist path stores uses summariseShape: there a text value gives only its length.
// The text helpers are also here: each text that the gate did not write itself (a name, a field,
// an answer of a check) goes through shortText before it goes into a problem or a record.

export type AuditRecord = {
  request_id: string;
  /** UTC time of the check. It comes in as an argument. */
  at: string;
  /** The name that the request gave (cleaned, cut to 40 characters), or null if it gave no name. */
  capability: string | null;
  status: 'REJECTED' | 'PROPOSED';
  reason: string | null;
  input_summary: string;
};

/** The longest text value in a summary, and the longest summary. */
export const MAX_VALUE = 40;
export const MAX_SUMMARY = 240;
const MAX_FIELDS = 8;
/** The number of names that a problem text gives before it says "and N more". */
export const MAX_NAMES = 5;

// The characters that are not plain text: control characters (Cc), format characters (Cf: no width,
// the marks that change the direction of text, soft hyphen, tag characters), line and paragraph
// separators, the variation selectors, and the fillers that look like nothing.
const NOT_PLAIN = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}\u034f\u115f\u1160\u3164\uffa0\ufe00-\ufe0f\u{e0100}-\u{e01ef}]/u;
const isHalf = (char: string): boolean => char.length === 1 && char.charCodeAt(0) >= 0xd800 && char.charCodeAt(0) <= 0xdfff;
const isHighHalf = (code: number): boolean => code >= 0xd800 && code <= 0xdbff;

/** true: the text has no control character, no hidden character, and no half of a character pair alone. */
export function isPlainText(text: string): boolean {
  return clean(text) === text;
}

/** Each character that is not plain becomes spaces; a half pair alone becomes "?". The length stays the same. */
function clean(text: string): string {
  let result = '';
  // One step for each character (code point), thus a character outside the first plane is one character here.
  for (const char of text) {
    if (isHalf(char)) result += '?';
    else if (NOT_PLAIN.test(char)) result += ' '.repeat(char.length);
    else result += char;
  }
  return result;
}

/** The first max characters. The cut is never in the middle of a character pair. */
export function cutText(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, isHighHalf(text.charCodeAt(max - 1)) ? max - 1 : max);
}

/** Text that is safe in one line of a log: no control character, and max characters at most. */
export function shortText(text: string, max: number): string {
  return clean(cutText(text, max));
}

/** The first few names in quotes, then the number of the others. A list of any size gives a short text. */
export function nameList(names: string[]): string {
  const shown = names.slice(0, MAX_NAMES).map((name) => '"' + shortText(name, MAX_VALUE) + '"').join(', ');
  return names.length > MAX_NAMES ? shown + ' and ' + (names.length - MAX_NAMES) + ' more' : shown;
}

const cut = (text: string, max: number): string => (text.length > max ? cutText(text, max - 3) + '...' : text);

// keepText false: a text value gives only its length, thus the summary has no text of the person.
function summariseValue(value: unknown, depth: number, keepText: boolean): string {
  if (typeof value === 'string') return keepText ? '"' + clean(cut(value, MAX_VALUE)) + '"' : '(text of ' + value.length + ')';
  if (typeof value === 'number' || typeof value === 'boolean' || value === null) return String(value);
  if (Array.isArray(value)) return '[list of ' + value.length + ']';
  if (typeof value === 'object' && depth < 1) return '{' + summariseFields(value as Record<string, unknown>, depth + 1, keepText) + '}';
  return '(' + typeof value + ')';
}

function summariseFields(input: Record<string, unknown>, depth: number, keepText: boolean): string {
  const keys = Object.keys(input);
  const parts = keys.slice(0, MAX_FIELDS).map((key) => clean(cut(key, 30)) + '=' + summariseValue(input[key], depth, keepText));
  if (keys.length > MAX_FIELDS) parts.push('and ' + (keys.length - MAX_FIELDS) + ' more');
  return parts.join(' ');
}

function summarise(input: unknown, keepText: boolean): string {
  if (input === undefined) return '(no input)';
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return '(not an object: ' + summariseValue(input, 1, keepText) + ')';
  return cut(summariseFields(input as Record<string, unknown>, 0, keepText), MAX_SUMMARY);
}

/** A short text of the input for the gate: the field names, and each value cut. */
export function summariseInput(input: unknown): string {
  return summarise(input, true);
}

/**
 * The summary for the stored audit of the assist path: the field names, the numbers and true/false.
 * A text value gives only its length. Text can come from the person (a merchant name, a reason), and the stored audit keeps no text of the person.
 */
export function summariseShape(input: unknown): string {
  return summarise(input, false);
}

export function auditRecord(
  ctx: { now: string; request_id: string },
  capability: string | null,
  status: AuditRecord['status'],
  reason: string | null,
  input: unknown,
): AuditRecord {
  return { request_id: ctx.request_id, at: ctx.now, capability: capability === null ? null : shortText(capability, MAX_VALUE), status, reason, input_summary: summariseInput(input) };
}
