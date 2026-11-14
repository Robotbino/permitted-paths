// Tests for the repairs after the adversarial review: the mapping gate, the header, and the time of a large file.
// The gate must give problems for ANY value, also for a value that is not a mapping. It must never throw.
import { describe, expect, test } from 'vitest';
import { checkRemove, cleanDescription, cleanerFor, inspect, matchProfile, runPipeline, validateMapping, type MappingProfile, type OtherAccountRow } from './index.ts';
import { HARBOUR_ACCOUNT, NORTHBANK_SAMPLE, UNKNOWN_PROFILE, UNKNOWN_SAMPLE } from './samples.ts';

const unknown = inspect(UNKNOWN_SAMPLE);
const gate = (profile: unknown): string[] => validateMapping(profile as MappingProfile, unknown).map((p) => p.rule);
const withClean = (remove: string): MappingProfile => ({ ...UNKNOWN_PROFILE, clean: [{ remove }] });

describe('validateMapping checks the permitted values at run time', () => {
  test('a value that is not a mapping gives MAP-SHAPE and no exception', () => {
    const bad: unknown[] = [
      null,
      'northbank',
      { ...UNKNOWN_PROFILE, date_format: 'DD-MM-YYYY' },
      { ...UNKNOWN_PROFILE, columns: undefined },
      { ...UNKNOWN_PROFILE, columns: { ...UNKNOWN_PROFILE.columns, date: 5 } },
      { ...UNKNOWN_PROFILE, columns: { ...UNKNOWN_PROFILE.columns, payee: 'What' } },
      { ...UNKNOWN_PROFILE, clean: 'x' },
      { ...UNKNOWN_PROFILE, negative_means: 'sideways' },
      { ...UNKNOWN_PROFILE, decimal: ';' },
      { ...UNKNOWN_PROFILE, type_values: { fee: 'FEE' } },
      { ...UNKNOWN_PROFILE, type_values: { refund: ['R'] } },
    ];
    for (const profile of bad) expect(gate(profile)).toContain('MAP-SHAPE');
  });

  test('the pipeline asks for a mapping, and stages no row, if the given mapping has an incorrect shape', () => {
    const profile = { ...UNKNOWN_PROFILE, negative_means: 'sideways' } as unknown as MappingProfile;
    const result = runPipeline(UNKNOWN_SAMPLE, { account: 'cash', source_name: 'x.tsv', profile });
    expect(result.needs_mapping).toBe(true);
    expect(result.rows).toEqual([]);
    expect(result.problems.map((p) => p.rule)).not.toContain('PIPELINE-STOPPED');
  });

  test('a file with no rows does not pass the gate', () => {
    expect(validateMapping(UNKNOWN_PROFILE, inspect('When\tWhat\tMoney out\tMoney in\n')).map((p) => p.rule)).toEqual(['MAP-NO-ROWS']);
  });

  test('a mapped column that is in the header two times does not pass the gate', () => {
    const twice = inspect('When\tWhat\tMoney out\tMoney in\tWhat\n03/02/2026\tGarden centre\t310.00\t\tx\n');
    expect(validateMapping(UNKNOWN_PROFILE, twice).map((p) => p.rule)).toEqual(['MAP-COLUMN-TWICE']);
  });
});

describe('a "remove" entry cannot be slow and cannot remove each description', () => {
  test('an expression with a group, a "|" or many repeat signs does not pass the gate', () => {
    for (const remove of ['(a+)+$', '(a|aa)+$', 'a|b', '(x)\\1', 'a?a?a?aaa', '\\d*\\d*\\d*x']) {
      expect(checkRemove(remove)).not.toBeNull();
      expect(gate(withClean(remove))).toEqual(['MAP-CLEAN']);
    }
    expect(checkRemove('^CARD PURCHASE ')).toBeNull();
    expect(checkRemove(' CARD \\d{4}$')).toBeNull();
    expect(checkRemove('\\(PTY\\) LTD$')).toBeNull();
    expect(checkRemove('[A-Z(|]+ REF$')).toBeNull();
  });

  test('two repeat signs, or more than 10 entries, do not pass the gate; the worst permitted mapping is fast', () => {
    expect(checkRemove('a*a*b')).not.toBeNull();
    expect(gate({ ...UNKNOWN_PROFILE, clean: Array.from({ length: 11 }, () => ({ remove: 'X' })) })).toEqual(['MAP-CLEAN']);
    // Ten entries with one repeat each, on 100 descriptions of 200 characters: the worst that the gate permits.
    const worst: MappingProfile = { ...UNKNOWN_PROFILE, clean: Array.from({ length: 60 }, () => ({ remove: 'a*b' })) };
    const clean = cleanerFor(worst);
    const started = performance.now();
    for (let i = 0; i < 100; i++) clean('a'.repeat(200));
    expect(performance.now() - started).toBeLessThan(500);
  });

  test('an entry that is not permitted is never run: the description stays, and the time is short', () => {
    const text = 'a'.repeat(40) + '!';
    expect(cleanDescription(text, withClean('(a+)+$'))).toBe(text);
  }, 1000);

  test('an entry that removes the whole description does not pass the gate', () => {
    const problems = validateMapping(withClean('.*'), unknown);
    expect(problems.map((p) => p.rule)).toEqual(['MAP-CLEAN', 'MAP-CLEAN', 'MAP-CLEAN', 'MAP-CLEAN', 'MAP-CLEAN']);
    expect(problems[0]?.text).toContain('Line 2: the "remove" entries remove the whole description "Garden centre".');
  });

  test('plain text is a prefix: it is removed at the start only', () => {
    expect(cleanDescription('POS SHOP POSTNET POS', withClean('POS'))).toBe('SHOP POSTNET POS');
    expect(cleanDescription('pos shop', withClean('POS '))).toBe('shop');
    expect(cleanDescription('SHOP POS', withClean('POS'))).toBe('SHOP POS');
  });

  test('a very long description is not cleaned with the entries, and it is still masked', () => {
    const long = 'POS ' + 'x'.repeat(200) + ' 12345';
    expect(cleanDescription(long, withClean('POS '))).toBe('POS ' + 'x'.repeat(200) + ' ####');
  });
});

describe('the header', () => {
  test('lines with one column before the header are not read, and the file is staged', () => {
    const result = runPipeline('Account: 123\nPeriod: March\n\n' + NORTHBANK_SAMPLE, { account: 'a', source_name: 's' });
    expect(result.profile?.id).toBe('northbank');
    expect(result.summary.new).toBe(14);
    expect(result.rows[0]?.line_no).toBe(5);
    expect(result.problems).toEqual([{ rule: 'INSPECT-PREAMBLE', text: 'The header is on line 4. The lines before it have one column and were not read.' }]);
  });

  test('a file with one column in each line still gives the one-column problem for line 1', () => {
    const result = inspect('a\nb\nc\n');
    expect(result.header).toEqual(['a']);
    expect(result.problems.map((p) => p.rule)).toEqual(['INSPECT-ONE-COLUMN']);
  });

  test('a header with the columns of both banks matches no profile: a person must choose', () => {
    expect(matchProfile(['Posting Date', 'Details', 'Debit', 'Credit', 'Balance', 'Date', 'Type', 'Description', 'Amount'])).toBeNull();
    expect(matchProfile(['date', 'TIME', 'type', 'Description ', 'amount'])?.id).toBe('harbour');
  });
});

describe('the time of a large file', () => {
  test('60 000 rows with 20 000 rows of a different account are staged in a short time', () => {
    const types = ['PURCHASE', 'EFT', 'TRANSFER', 'REVERSAL', 'PENDING', 'FEE'];
    const lines = ['"Date","Time","Type","Description","Amount"'];
    for (let i = 0; i < 60_000; i++) {
      const day = String((i % 28) + 1).padStart(2, '0');
      lines.push('"2026-03-' + day + '","08:00","' + types[i % 6] + '","Shop ' + (i % 500) + '","' + (i % 3 === 0 ? '' : '-') + ((i % 900) + 1) + '.00"');
    }
    const others: OtherAccountRow[] = [];
    for (let i = 0; i < 20_000; i++) {
      others.push({ account: 'northbank-current', occurred_on: '2026-03-' + String((i % 28) + 1).padStart(2, '0'), amount_cents: ((i % 900) + 1) * 100, direction: i % 2 === 0 ? 'out' : 'in', fingerprint: 'n' + i });
    }
    const result = runPipeline(lines.join('\n'), { account: HARBOUR_ACCOUNT, source_name: 'big.csv', known: { fingerprints: [], other_account_rows: others } });
    expect(result.rows).toHaveLength(60_000);
    expect(result.problems.map((p) => p.rule)).not.toContain('PIPELINE-STOPPED');
    expect(result.summary.held).toBe(10_000);
    expect(result.summary.transfer).toBeGreaterThan(0);
  }, 20_000);
});

describe('runPipeline: each bad input has its own clear result', () => {
  test('text that is not a file gives one inspect problem and never a stop', () => {
    const cases: Array<[input: unknown, rule: string]> = [
      ['', 'INSPECT-EMPTY'],
      [null, 'INSPECT-EMPTY'],
      [42, 'INSPECT-EMPTY'],
      ['one column only\nrow', 'INSPECT-ONE-COLUMN'],
      ['Date,Amount\n', 'INSPECT-NO-ROWS'],
      ['"', 'INSPECT-QUOTE'],
    ];
    for (const [input, rule] of cases) {
      const result = runPipeline(input as string, { account: 'a', source_name: 's' });
      expect(result.problems.map((p) => p.rule)).toContain(rule);
      expect(result.problems.map((p) => p.rule)).not.toContain('PIPELINE-STOPPED');
      expect(result.rows).toEqual([]);
      expect(result.needs_mapping).toBe(false);
    }
  });

  test('absent options give a stop problem and no exception', () => {
    const result = runPipeline(NORTHBANK_SAMPLE, undefined as unknown as { account: string; source_name: string });
    expect(result.rows).toEqual([]);
    expect(result.problems.map((p) => p.rule)).toEqual(['PIPELINE-STOPPED']);
  });
});
