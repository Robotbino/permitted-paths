import { describe, expect, test } from 'vitest';
import { inspect } from './inspect.ts';
import { matchProfile, PROFILES, validateMapping, type MappingProfile } from './profiles.ts';
import { HARBOUR_SAMPLE, NORTHBANK_SAMPLE, UNKNOWN_PROFILE, UNKNOWN_SAMPLE } from './samples.ts';
import { daysBetween, parseCents, parseDate } from './values.ts';

describe('parseDate', () => {
  test('each format gives the same local date', () => {
    expect(parseDate('2026-03-03', 'YYYY-MM-DD')).toBe('2026-03-03');
    expect(parseDate('20260303', 'YYYYMMDD')).toBe('2026-03-03');
    expect(parseDate('03/04/2026', 'DD/MM/YYYY')).toBe('2026-04-03');
    expect(parseDate('03/04/2026', 'MM/DD/YYYY')).toBe('2026-03-04');
    expect(parseDate('3/4/2026', 'DD/MM/YYYY')).toBe('2026-04-03');
  });

  test('a date that does not exist is null', () => {
    expect(parseDate('31/02/2026', 'DD/MM/YYYY')).toBeNull();
    expect(parseDate('2026-02-29', 'YYYY-MM-DD')).toBeNull();
    expect(parseDate('2028-02-29', 'YYYY-MM-DD')).toBe('2028-02-29'); // a leap year
    expect(parseDate('13/25/2026', 'MM/DD/YYYY')).toBeNull();
  });

  test('text in a different form is null', () => {
    expect(parseDate('2026-03-03', 'DD/MM/YYYY')).toBeNull();
    expect(parseDate('', 'YYYY-MM-DD')).toBeNull();
    expect(parseDate('3 March 2026', 'YYYY-MM-DD')).toBeNull();
  });

  test('the days between two dates, also across the end of a month', () => {
    expect(daysBetween('2026-02-25', '2026-03-03')).toBe(6);
    expect(daysBetween('2026-03-03', '2026-02-25')).toBe(-6);
  });
});

describe('parseCents', () => {
  test('a decimal comma and spaces between thousands', () => {
    expect(parseCents('1 250,00', ',')).toEqual({ cents: 125000, negative: false });
    expect(parseCents('28 500,5', ',')).toEqual({ cents: 2850050, negative: false });
    expect(parseCents('842,35', ',')).toEqual({ cents: 84235, negative: false });
  });

  test('a decimal dot and a sign', () => {
    expect(parseCents('-245.50', '.')).toEqual({ cents: 24550, negative: true });
    expect(parseCents('+12.40', '.')).toEqual({ cents: 1240, negative: false });
    expect(parseCents('1 120.75', '.')).toEqual({ cents: 112075, negative: false });
  });

  test('the decimal sign of the other kind is not accepted, because the amount would be ambiguous', () => {
    expect(parseCents('1,250', '.')).toBeNull();
    expect(parseCents('12.40', ',')).toBeNull();
    expect(parseCents('1.250,00', ',')).toBeNull();
  });

  test('text that is not an amount is null', () => {
    expect(parseCents('', '.')).toBeNull();
    expect(parseCents('abc', '.')).toBeNull();
    expect(parseCents('1.234', '.')).toBeNull(); // three decimals
    expect(parseCents('0.1', '.')).toEqual({ cents: 10, negative: false }); // no float: 0.1 is exactly 10 cents
  });
});

describe('matchProfile', () => {
  test('each bank sample matches its profile', () => {
    expect(matchProfile(inspect(NORTHBANK_SAMPLE).header)?.id).toBe('northbank');
    expect(matchProfile(inspect(HARBOUR_SAMPLE).header)?.id).toBe('harbour');
  });

  test('case and spaces in a header name do not count', () => {
    expect(matchProfile(['posting date', 'DETAILS', ' Debit ', 'credit', 'Balance'])?.id).toBe('northbank');
    expect(matchProfile(['PostingDate', 'Details', 'Debit', 'Credit', 'Balance'])?.id).toBe('northbank');
  });

  test('an unknown layout or a header with a missing column gives null', () => {
    expect(matchProfile(inspect(UNKNOWN_SAMPLE).header)).toBeNull();
    expect(matchProfile(['Posting Date', 'Details', 'Debit', 'Credit'])).toBeNull();
    expect(matchProfile([])).toBeNull();
  });
});

describe('validateMapping', () => {
  test('the known profiles and the hand-made profile PASS on their samples', () => {
    const [northbank, harbour] = PROFILES;
    expect(validateMapping(northbank!, inspect(NORTHBANK_SAMPLE))).toEqual([]);
    expect(validateMapping(harbour!, inspect(HARBOUR_SAMPLE))).toEqual([]);
    expect(validateMapping(UNKNOWN_PROFILE, inspect(UNKNOWN_SAMPLE))).toEqual([]);
  });

  test('a mapping that names a column that is not in the file gives a problem', () => {
    const profile: MappingProfile = { ...UNKNOWN_PROFILE, columns: { ...UNKNOWN_PROFILE.columns, description: 'Narrative' } };
    expect(validateMapping(profile, inspect(UNKNOWN_SAMPLE))).toEqual([{ rule: 'MAP-COLUMN', text: 'The column "Narrative" (for description) is not in the file.' }]);
  });

  test('a mapping needs one amount column, or a debit and a credit column', () => {
    const inspected = inspect(UNKNOWN_SAMPLE);
    const none: MappingProfile = { ...UNKNOWN_PROFILE, columns: { date: 'When', description: 'What' } };
    const half: MappingProfile = { ...UNKNOWN_PROFILE, columns: { date: 'When', description: 'What', debit: 'Money out' } };
    const both: MappingProfile = { ...UNKNOWN_PROFILE, columns: { ...UNKNOWN_PROFILE.columns, amount: 'Money in' } };
    for (const profile of [none, half, both]) {
      expect(validateMapping(profile, inspected).map((p) => p.rule)).toEqual(['MAP-AMOUNT-COLUMNS']);
    }
  });

  test('the incorrect date format gives a problem with the first line that does not parse', () => {
    const profile: MappingProfile = { ...UNKNOWN_PROFILE, date_format: 'DD/MM/YYYY' };
    const problems = validateMapping(profile, inspect(UNKNOWN_SAMPLE));
    expect(problems.map((p) => p.rule)).toEqual(['MAP-DATE', 'MAP-DATE', 'MAP-DATE']);
    expect(problems[0]?.text).toBe('Line 4: the text "03/13/2026" is not a real date in the form DD/MM/YYYY.');
  });

  test('the incorrect decimal sign or the incorrect amount column gives a problem', () => {
    const comma: MappingProfile = { ...UNKNOWN_PROFILE, decimal: ',' };
    expect(validateMapping(comma, inspect(UNKNOWN_SAMPLE)).every((p) => p.rule === 'MAP-AMOUNT')).toBe(true);
    expect(validateMapping(comma, inspect(UNKNOWN_SAMPLE))).toHaveLength(5);
    const words: MappingProfile = { ...UNKNOWN_PROFILE, columns: { date: 'When', description: 'What', amount: 'What' } };
    expect(validateMapping(words, inspect(UNKNOWN_SAMPLE))[0]?.rule).toBe('MAP-AMOUNT');
  });

  test('the dry run reads the first 20 rows only', () => {
    const good = Array.from({ length: 20 }, () => '2026-03-01,x,1.00');
    const inspected = inspect(['Date,Description,Amount', ...good, 'not a date,x,?'].join('\n'));
    const profile: MappingProfile = { id: 't', name: 't', columns: { date: 'Date', description: 'Description', amount: 'Amount' }, date_format: 'YYYY-MM-DD', decimal: '.' };
    expect(validateMapping(profile, inspected)).toEqual([]);
  });

  test('a "remove" entry that is empty or very long gives a problem', () => {
    const long: MappingProfile = { ...UNKNOWN_PROFILE, clean: [{ remove: 'a'.repeat(81) }, { remove: '' }] };
    expect(validateMapping(long, inspect(UNKNOWN_SAMPLE)).map((p) => p.rule)).toEqual(['MAP-CLEAN', 'MAP-CLEAN']);
  });
});
