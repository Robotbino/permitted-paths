// Tests for the repairs after the adversarial review: the rows. Each test fails without its repair.
// A wrong amount or direction must never be staged as 'new'.
import { describe, expect, test } from 'vitest';
import { checkBalance, cleanDescription, inspect, normalise, parseCents, PROFILES, reconcile, runPipeline, type MappingProfile } from './index.ts';
import { HARBOUR_ACCOUNT, HARBOUR_SAMPLE, NORTHBANK_ACCOUNT, NORTHBANK_SAMPLE, UNKNOWN_PROFILE, UNKNOWN_SAMPLE } from './samples.ts';

const NORTHBANK = PROFILES.find((p) => p.id === 'northbank') as MappingProfile;
const north = { account: NORTHBANK_ACCOUNT, source_name: 'north.csv' };
const harbour = { account: HARBOUR_ACCOUNT, source_name: 'harbour.csv' };
const HEAD = 'Posting Date;Details;Debit;Credit;Balance\n';
const rules = (row: { problems: Array<{ rule: string }> } | undefined): string[] => (row?.problems ?? []).map((p) => p.rule);

describe('a row with the wrong number of cells', () => {
  test('an amount with a thousands comma and no quotes is a problem row, not R1.00', () => {
    const result = runPipeline('Date,Type,Description,Amount\n2026-03-01,PURCHASE,Shop,-1,250.00\n2026-03-02,PURCHASE,Shop,-20.00\n', harbour);
    expect(result.rows.map((row) => row.status)).toEqual(['problem', 'new']);
    expect(rules(result.rows[0])).toContain('ROW-CELLS');
    expect(result.rows[1]).toMatchObject({ amount_cents: 2000, direction: 'out' });
  });

  test('a row with fewer cells than the header is a problem row', () => {
    const result = runPipeline(HEAD + '05/03/2026;X;68,00\n06/03/2026;Y;10,00;;90,00\n', north);
    expect(result.rows.map((row) => row.status)).toEqual(['problem', 'new']);
    expect(rules(result.rows[0])).toEqual(['ROW-CELLS']);
  });

  test('150 000 rows with one more cell do not stop the pipeline, and the batch problems stay few', () => {
    const lines = ['Date,Type,Description,Amount'];
    for (let i = 0; i < 150_000; i++) lines.push('2026-03-01,PURCHASE,Shop ' + (i % 7) + ',-1,250.00');
    const result = runPipeline(lines.join('\n'), harbour);
    expect(result.problems.map((p) => p.rule)).not.toContain('PIPELINE-STOPPED');
    expect(result.summary.problem).toBe(150_000);
    expect(result.problems).toHaveLength(21);
    expect(result.problems[20]).toEqual({ rule: 'INSPECT-CELLS-MORE', text: '149980 more lines have a number of cells that is different from the header.' });
  }, 30_000);
});

describe('a Debit and a Credit column', () => {
  test('a minus sign in a direction column is a problem: the direction is not clear', () => {
    const result = runPipeline(HEAD + '05/03/2026;X;-68,00;;100,00\n06/03/2026;Y;;-50,00;50,00\n07/03/2026;Z;10,00;;40,00\n', north);
    expect(result.rows.map((row) => row.status)).toEqual(['problem', 'problem', 'new']);
    expect(rules(result.rows[0])).toEqual(['ROW-SIGN']);
    expect(result.rows[1]).toMatchObject({ amount_cents: null, direction: null });
  });

  test('a zero in the column that is not used is the same as an empty cell', () => {
    const rows = normalise(inspect(HEAD + '05/03/2026;X;68,00;0,00;100,00\n06/03/2026;Y;0,00;50,00;150,00\n07/03/2026;Z;0,00;0,00;150,00\n'), NORTHBANK, north).rows;
    expect(rows[0]).toMatchObject({ amount_cents: 6800, direction: 'out', problems: [] });
    expect(rows[1]).toMatchObject({ amount_cents: 5000, direction: 'in', problems: [] });
    expect(rules(rows[2])).toEqual(['ROW-ZERO']);
  });
});

describe('one bad row does not stop the file of a known bank', () => {
  test('a date that does not exist in the first 20 rows is a row problem, and the other 13 rows are staged', () => {
    const result = runPipeline(NORTHBANK_SAMPLE.replace('02/03/2026;CARD PURCHASE METRO', '31/02/2026;CARD PURCHASE METRO'), north);
    expect(result.needs_mapping).toBe(false);
    expect(result.mapping_problems).toEqual([]);
    expect(result.summary).toEqual({ new: 13, duplicate: 0, transfer: 0, held: 0, reversed: 0, problem: 1 });
    expect(rules(result.rows[4])).toEqual(['ROW-DATE']);
  });

  test('a zero amount in the first 20 rows is a row problem', () => {
    const result = runPipeline(NORTHBANK_SAMPLE.replace(';950,00;;', ';0,00;;'), north);
    expect(result.needs_mapping).toBe(false);
    expect(result.summary.new).toBe(13);
    expect(rules(result.rows[4])).toEqual(['ROW-ZERO']);
  });

  test('two files joined into one: the second header line is one problem row', () => {
    const result = runPipeline(NORTHBANK_SAMPLE + NORTHBANK_SAMPLE, north);
    expect(result.needs_mapping).toBe(false);
    expect(result.rows).toHaveLength(29);
    expect(result.summary.problem).toBe(1);
    expect(result.rows[14]).toMatchObject({ line_no: 16, status: 'problem', problems: [{ rule: 'ROW-HEADER' }] });
    const given = runPipeline(UNKNOWN_SAMPLE + UNKNOWN_SAMPLE, { account: 'cash', source_name: 'x.tsv', profile: UNKNOWN_PROFILE });
    expect(given.needs_mapping).toBe(false);
    expect(given.summary).toMatchObject({ new: 10, problem: 1 });
  });

  test('if no row of the dry run parses, the file still asks for a mapping', () => {
    const result = runPipeline('Date,Type,Description,Amount\n01/03/2026,PURCHASE,Shop,-5.00\n02/03/2026,PURCHASE,Shop,-6.00\n', harbour);
    expect(result.needs_mapping).toBe(true);
    expect(result.rows).toEqual([]);
  });
});

describe('a pending row does not take the fingerprint of the cleared row', () => {
  const first = '"Date","Time","Type","Description","Amount"\n"2026-03-12","19:03","PURCHASE","Orbit Streaming","-159.00"\n';

  test('a later file with the pending row before the same purchase: held, then duplicate', () => {
    const ledger = runPipeline(first, harbour).rows.map((row) => row.fingerprint);
    const second = first.replace('\n', '\n"2026-03-12","19:03","PENDING","Orbit Streaming","-159.00"\n');
    const result = runPipeline(second, { ...harbour, known: { fingerprints: ledger } });
    expect(result.rows.map((row) => row.status)).toEqual(['held', 'duplicate']);
  });

  test('a pending row that clears in a later file is new there', () => {
    const pending = runPipeline(HARBOUR_SAMPLE, harbour).rows[9];
    const cleared = runPipeline(first, { ...harbour, known: { fingerprints: [] } }).rows[0];
    expect(pending?.fingerprint).toBe('harbour-everyday|2026-03-12|-15900|Orbit Streaming|p0');
    expect(cleared?.fingerprint).toBe('harbour-everyday|2026-03-12|-15900|Orbit Streaming|0');
  });
});

describe('the balance check does not need different dates', () => {
  test('a file with the newest row first and one date for all rows is PASS', () => {
    const rows = normalise(inspect(HEAD + '05/03/2026;B;20,00;;70,00\n05/03/2026;A;10,00;;90,00\n'), NORTHBANK, north).rows;
    expect(checkBalance(rows)).toEqual([]);
    expect(reconcile(rows, { fingerprints: [] }).problems).toEqual([]);
  });

  test('a cut file with the newest row first and one date still gives the break', () => {
    const text = HEAD + '05/03/2026;D;5,00;;45,00\n05/03/2026;C;20,00;;70,00\n05/03/2026;B;10,00;;90,00\n05/03/2026;A;10,00;;150,00\n';
    const problems = checkBalance(normalise(inspect(text), NORTHBANK, north).rows);
    expect(problems).toHaveLength(1);
    expect(problems[0]?.text).toContain('Line 4: the balance does not continue from line 5.');
  });
});

describe('amount text and descriptions', () => {
  test('a space in an amount is permitted only between groups of three digits', () => {
    expect(parseCents('1 250,00', ',')).toEqual({ cents: 125000, negative: false });
    expect(parseCents('- R 12 345 678,5', ',')).toEqual({ cents: 1234567850, negative: true });
    expect(parseCents('12 50', ',')).toBeNull();
    expect(parseCents('1 2,5', ',')).toBeNull();
    expect(parseCents('1250 000', '.')).toBeNull();
  });

  test('an amount of more than R1 000 000.00 is a problem row', () => {
    const rows = normalise(inspect(HEAD + '05/03/2026;X;1 000 000,01;;0,00\n05/03/2026;Y;1 000 000,00;;0,00\n'), NORTHBANK, north).rows;
    expect(rules(rows[0])).toEqual(['ROW-LARGE']);
    expect(rows[1]).toMatchObject({ amount_cents: 100_000_000, problems: [] });
  });

  test('control characters and hidden characters do not stay in the clean description', () => {
    expect(cleanDescription('a\u0000b\u0007 ‮ evil​', NORTHBANK)).toBe('a b evil');
  });

  test('a number with spaces or hyphens between its digits is masked as one number', () => {
    expect(cleanDescription('ACC 62-0011-873 REF 123 456 789', NORTHBANK)).toBe('ACC #### REF ####');
    expect(cleanDescription('GATE 12 UNIT 7', NORTHBANK)).toBe('GATE 12 UNIT 7');
  });
});
