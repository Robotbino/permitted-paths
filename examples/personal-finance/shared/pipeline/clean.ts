// The clean description of a row: the noise of the bank is removed and numbers are masked.
// A "remove" entry of a mapping can come from a person or from a model proposal, thus it is not trusted.
// A regular expression can be very slow on purpose (it tries each possible split of the text).
// For this reason only a small, safe part of the expression language is permitted here,
// and an entry that is not permitted is never run.
import type { MappingProfile } from './profiles.ts';

/** The largest length of one "remove" entry. */
export const MAX_REMOVE_LENGTH = 80;
/** The largest number of signs in one entry that repeat a part a variable number of times: * + ? {2,5}. */
export const MAX_REPEATS = 1;
/** The largest number of "remove" entries in one mapping. */
export const MAX_CLEAN_ENTRIES = 10;
/** A description that is longer than this is not cleaned with "remove" entries. It is still masked. */
export const MAX_CLEAN_LENGTH = 200;

// Plain text: letters, digits, spaces and a few signs that have no special meaning in an expression.
const PLAIN = /^[\p{L}\p{N} :\-_/#&',]+$/u;

/** true: the entry is literal text. It is removed only at the start of a description (a prefix). */
function isLiteral(source: string): boolean {
  if (PLAIN.test(source)) return true;
  try {
    new RegExp(source, 'i');
    return false;
  } catch {
    return true; // not a correct expression, thus it is literal text
  }
}

/**
 * The check of one "remove" entry. null is PASS; a text says why the entry is not permitted.
 * An expression is permitted if it has no group, no "|", no back reference and not more than 1 variable repeat.
 * The expression is tried at each place of the text, thus one repeat can still cost the square of the length.
 * Three limits together keep the time short: the length of a description (MAX_CLEAN_LENGTH), one repeat for
 * each entry, and MAX_CLEAN_ENTRIES entries. With two repeats the time grows with the cube of the length.
 */
export function checkRemove(source: unknown): string | null {
  if (typeof source !== 'string' || source === '' || source.length > MAX_REMOVE_LENGTH) {
    return 'A "remove" entry must be text of 1 to ' + MAX_REMOVE_LENGTH + ' characters.';
  }
  if (isLiteral(source)) return null;
  // The same expression without escaped characters and without character classes. What stays is structure.
  const bare = source.replace(/\\[^1-9k]/g, '_').replace(/\[[^\]]*\]/g, '_');
  if (/[()|\\]/.test(bare)) {
    return 'The "remove" entry "' + source + '" has a group, a "|" or a back reference. These are not permitted, because they can be very slow.';
  }
  const repeats = bare.match(/[*+?]|\{\d*,\d*\}/g) ?? [];
  if (repeats.length > MAX_REPEATS) {
    return 'The "remove" entry "' + source + '" has more than ' + MAX_REPEATS + ' repeat sign (* + ? or {2,5}). Divide it into smaller entries.';
  }
  return null;
}

/** The function that removes the text of one entry. null: the entry is not permitted and is not used. */
export function removeRule(source: unknown): ((text: string) => string) | null {
  if (typeof source !== 'string' || checkRemove(source) !== null) return null;
  if (isLiteral(source)) {
    const prefix = source.toLowerCase();
    return (text) => (text.slice(0, source.length).toLowerCase() === prefix ? text.slice(source.length) : text);
  }
  const expression = new RegExp(source, 'gi');
  return (text) => text.replace(expression, '');
}

/** Text without characters that a person cannot see: a control character becomes a space, a hidden format character goes. */
export function visibleText(text: string): string {
  return text.replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ').replace(/[​-‏‪-‮⁠-⁤﻿]/g, '');
}

/** Each number of 4 or more digits becomes "####". One space or hyphen between digits does not hide a number: "62-0011-873". */
export function maskDigits(text: string): string {
  return text.replace(/\d(?:[ -]?\d){3,}/g, '####');
}

/** The cleaner of one profile. The entries are prepared one time, then the function is used for each row. */
export function cleanerFor(profile: MappingProfile): (description: string) => string {
  const entries: unknown = profile.clean;
  const rules: Array<(text: string) => string> = [];
  // Not more than MAX_CLEAN_ENTRIES, also if a caller did not check the mapping first.
  for (const entry of Array.isArray(entries) ? entries.slice(0, MAX_CLEAN_ENTRIES) : []) {
    const rule = removeRule((entry as { remove?: unknown } | null)?.remove);
    if (rule !== null) rules.push(rule);
  }
  return (description) => {
    let text = description;
    if (text.length <= MAX_CLEAN_LENGTH) for (const rule of rules) text = rule(text);
    return maskDigits(visibleText(text)).replace(/\s+/g, ' ').trim();
  };
}

/** A description without the noise of the bank, without hidden characters, and with each long number masked. */
export function cleanDescription(description: string, profile: MappingProfile): string {
  return cleanerFor(profile)(description);
}
