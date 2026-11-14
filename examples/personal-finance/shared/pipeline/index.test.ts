import { describe, expect, test } from 'vitest';
import { runPipeline, type OtherAccountRow, type ReconciledRow } from './index.ts';
import { HARBOUR_ACCOUNT, HARBOUR_SAMPLE, NORTHBANK_ACCOUNT, NORTHBANK_SAMPLE, UNKNOWN_PROFILE, UNKNOWN_SAMPLE } from './samples.ts';

const north = { account: NORTHBANK_ACCOUNT, source_name: 'northbank-march.csv' };
const harbour = { account: HARBOUR_ACCOUNT, source_name: 'harbour-march.csv' };

function asOther(rows: ReconciledRow[]): OtherAccountRow[] {
  const out: OtherAccountRow[] = [];
  for (const row of rows) {
    if (row.occurred_on !== null && row.amount_cents !== null && row.direction !== null) {
      out.push({ account: row.account, occurred_on: row.occurred_on, amount_cents: row.amount_cents, direction: row.direction, fingerprint: row.fingerprint });
    }
  }
  return out;
}

describe('runPipeline: the samples end to end', () => {
  test('the Northbank sample alone gives 14 new rows and no problem', () => {
    const result = runPipeline(NORTHBANK_SAMPLE, north);
    expect(result.profile?.id).toBe('northbank');
    expect(result.needs_mapping).toBe(false);
    expect(result.mapping_problems).toEqual([]);
    expect(result.problems).toEqual([]);
    expect(result.rows).toHaveLength(14);
    expect(result.summary).toEqual({ new: 14, duplicate: 0, transfer: 0, held: 0, reversed: 0, problem: 0 });
    expect(result.file_hash).toMatch(/^[0-9a-f]{14}$/);
  });

  test('the Harbour sample alone gives 7 new rows, 1 held row and 2 reversed rows', () => {
    const result = runPipeline(HARBOUR_SAMPLE, harbour);
    expect(result.profile?.id).toBe('harbour');
    expect(result.problems).toEqual([]);
    expect(result.summary).toEqual({ new: 7, duplicate: 0, transfer: 0, held: 1, reversed: 2, problem: 0 });
    expect(result.rows.map((row) => row.status)).toEqual(['new', 'new', 'new', 'new', 'reversed', 'reversed', 'new', 'new', 'new', 'held']);
  });

  test('with the Northbank rows known, the Harbour sample gives 6 new, 1 transfer, 1 held and 2 reversed', () => {
    const first = runPipeline(NORTHBANK_SAMPLE, north);
    const second = runPipeline(HARBOUR_SAMPLE, { ...harbour, known: { fingerprints: [], other_account_rows: asOther(first.rows) } });
    expect(second.summary).toEqual({ new: 6, duplicate: 0, transfer: 1, held: 1, reversed: 2, problem: 0 });
    expect(second.rows[2]).toMatchObject({ status: 'transfer', description: 'Transfer from Northbank', pair_fingerprint: first.rows[5]!.fingerprint });
  });

  test('with the Harbour rows known, the Northbank sample gives 13 new rows and 1 transfer', () => {
    const first = runPipeline(HARBOUR_SAMPLE, harbour);
    const second = runPipeline(NORTHBANK_SAMPLE, { ...north, known: { fingerprints: [], other_account_rows: asOther(first.rows) } });
    expect(second.summary).toEqual({ new: 13, duplicate: 0, transfer: 1, held: 0, reversed: 0, problem: 0 });
  });
});

describe('runPipeline: a file that comes again', () => {
  test('the same file twice gives duplicates only, and the same file hash', () => {
    for (const [text, options] of [[NORTHBANK_SAMPLE, north], [HARBOUR_SAMPLE, harbour]] as const) {
      const first = runPipeline(text, options);
      const second = runPipeline(text, { ...options, known: { fingerprints: first.rows.map((row) => row.fingerprint) } });
      expect(second.summary.duplicate).toBe(first.rows.length);
      expect(second.rows.every((row) => row.status === 'duplicate')).toBe(true);
      expect(second.file_hash).toBe(first.file_hash);
    }
  });

  test('a second file that overlaps the first gives only the rows that are new', () => {
    const lines = NORTHBANK_SAMPLE.split('\n');
    const early = lines.slice(0, 9).join('\n'); // the header and 8 rows: the first of the two equal cafe purchases is the last row
    const first = runPipeline(early, north);
    expect(first.summary.new).toBe(8);
    const second = runPipeline(NORTHBANK_SAMPLE, { ...north, known: { fingerprints: first.rows.map((row) => row.fingerprint) } });
    expect(second.summary).toEqual({ new: 6, duplicate: 8, transfer: 0, held: 0, reversed: 0, problem: 0 });
    expect(second.rows.filter((row) => row.status === 'new').map((row) => row.line_no)).toEqual([10, 11, 12, 13, 14, 15]);
    expect(second.file_hash).not.toBe(first.file_hash);
  });

  test('a cut file gives the rows and a balance problem of the batch', () => {
    const lines = NORTHBANK_SAMPLE.split('\n');
    const result = runPipeline([...lines.slice(0, 3), ...lines.slice(4)].join('\n'), north);
    expect(result.rows).toHaveLength(13);
    expect(result.problems.map((p) => p.rule)).toEqual(['BATCH-BALANCE']);
  });
});

describe('runPipeline: the mapping', () => {
  test('the unknown sample needs a mapping and stages no row', () => {
    const result = runPipeline(UNKNOWN_SAMPLE, { account: 'cash-book', source_name: 'other.tsv' });
    expect(result.profile).toBeNull();
    expect(result.needs_mapping).toBe(true);
    expect(result.rows).toEqual([]);
    expect(result.inspected.header).toEqual(['When', 'What', 'Money out', 'Money in']);
  });

  test('the unknown sample with its hand-made profile gives 5 new rows', () => {
    const result = runPipeline(UNKNOWN_SAMPLE, { account: 'cash-book', source_name: 'other.tsv', profile: UNKNOWN_PROFILE });
    expect(result.needs_mapping).toBe(false);
    expect(result.mapping_problems).toEqual([]);
    expect(result.summary.new).toBe(5);
    expect(result.rows.map((row) => [row.occurred_on, row.amount_cents, row.direction])).toEqual([
      ['2026-03-02', 31000, 'out'],
      ['2026-03-05', 4500, 'in'],
      ['2026-03-13', 20000, 'out'],
      ['2026-03-15', 150000, 'in'],
      ['2026-03-20', 112075, 'out'],
    ]);
  });

  test('a given mapping that does not pass the gate stages no row', () => {
    const profile = { ...UNKNOWN_PROFILE, columns: { ...UNKNOWN_PROFILE.columns, date: 'Day' } };
    const result = runPipeline(UNKNOWN_SAMPLE, { account: 'cash-book', source_name: 'other.tsv', profile });
    expect(result.needs_mapping).toBe(true);
    expect(result.mapping_problems.map((p) => p.rule)).toEqual(['MAP-COLUMN']);
    expect(result.rows).toEqual([]);
  });
});

describe('runPipeline: bad input', () => {
  test('it never throws: each bad input gives problems and no rows', () => {
    const inputs: unknown[] = ['', '﻿', 'one column only\nrow', 'Date,Amount\n', '"', '\t\t\t', ';;;\n;;;', null, undefined, 42];
    for (const input of inputs) {
      const result = runPipeline(input as string, north);
      expect(result.rows).toEqual([]);
      expect(result.problems.length + result.mapping_problems.length + (result.needs_mapping ? 1 : 0)).toBeGreaterThan(0);
    }
  });

  test('an empty file does not ask for a mapping', () => {
    const result = runPipeline('', north);
    expect(result.needs_mapping).toBe(false);
    expect(result.problems.map((p) => p.rule)).toEqual(['INSPECT-EMPTY']);
  });
});
