import { describe, expect, test } from 'vitest';
import { inspect } from './inspect.ts';
import { normalise, type StagedRow } from './normalise.ts';
import { PROFILES } from './profiles.ts';
import { reconcile, type OtherAccountRow } from './reconcile.ts';
import { HARBOUR_ACCOUNT, HARBOUR_SAMPLE, NORTHBANK_ACCOUNT, NORTHBANK_SAMPLE } from './samples.ts';

const NORTHBANK = PROFILES[0]!;
const HARBOUR = PROFILES[1]!;
const QUOTED_HEAD = '"Date","Type","Description","Amount"\n';

function harbour(text: string, account = HARBOUR_ACCOUNT): StagedRow[] {
  return normalise(inspect(text), HARBOUR, { account, source_name: 'test.csv' }).rows;
}
const northRows = (): StagedRow[] => normalise(inspect(NORTHBANK_SAMPLE), NORTHBANK, { account: NORTHBANK_ACCOUNT, source_name: 'n.csv' }).rows;

function asOther(rows: StagedRow[]): OtherAccountRow[] {
  const out: OtherAccountRow[] = [];
  for (const row of rows) {
    if (row.occurred_on !== null && row.amount_cents !== null && row.direction !== null) {
      out.push({ account: row.account, occurred_on: row.occurred_on, amount_cents: row.amount_cents, direction: row.direction, fingerprint: row.fingerprint });
    }
  }
  return out;
}

describe('reconcile: the order of the rules', () => {
  test('a row with a problem is "problem", also if its fingerprint is known', () => {
    const rows = harbour(QUOTED_HEAD + '"2026-02-30","PURCHASE","Shop","-5.00"\n');
    const result = reconcile(rows, { fingerprints: [rows[0]!.fingerprint] });
    expect(result.rows[0]?.status).toBe('problem');
    expect(result.summary).toEqual({ new: 0, duplicate: 0, transfer: 0, held: 0, reversed: 0, problem: 1 });
  });

  test('a known fingerprint is "duplicate", also for a pending row', () => {
    const rows = harbour(HARBOUR_SAMPLE);
    const result = reconcile(rows, { fingerprints: [rows[9]!.fingerprint] });
    expect(result.rows[9]?.status).toBe('duplicate');
    expect(result.rows[9]?.note).toBe('This row is already in the ledger. It is not added again.');
  });

  test('a pending row is "held" with a note in plain words', () => {
    const result = reconcile(harbour(HARBOUR_SAMPLE), { fingerprints: [] });
    expect(result.rows[9]).toMatchObject({ status: 'held', note: 'This payment is pending. No money moved yet. The row comes again when the payment clears.' });
  });

  test('each row that is not "new" has a note, and a "new" row has none', () => {
    const result = reconcile(harbour(HARBOUR_SAMPLE), { fingerprints: [] });
    for (const row of result.rows) expect(row.note === undefined).toBe(row.status === 'new');
  });

  test('the input rows are not changed', () => {
    const rows = harbour(QUOTED_HEAD + '"2026-03-08","REVERSAL","Shop","5.00"\n');
    reconcile(rows, { fingerprints: [] });
    expect(rows[0]).toMatchObject({ status: 'new', problems: [] });
  });
});

describe('reconcile: reversals', () => {
  test('a reversal and the purchase that it cancels are both "reversed" and point at each other', () => {
    const { rows } = reconcile(harbour(HARBOUR_SAMPLE), { fingerprints: [] });
    expect(rows[4]).toMatchObject({ status: 'reversed', pair_fingerprint: rows[5]!.fingerprint });
    expect(rows[5]).toMatchObject({ status: 'reversed', pair_fingerprint: rows[4]!.fingerprint });
    expect(rows[5]?.note).toBe('This row cancels the row of 2026-03-06 with the same amount. The two rows together change nothing.');
  });

  test('a reversal with no partner is a problem', () => {
    const { rows, summary } = reconcile(harbour(QUOTED_HEAD + '"2026-03-08","REVERSAL","Shop","5.00"\n'), { fingerprints: [] });
    expect(rows[0]?.status).toBe('problem');
    expect(rows[0]?.problems.map((p) => p.rule)).toEqual(['ROW-REVERSAL']);
    expect(summary.problem).toBe(1);
  });

  test('a reversal takes the nearest earlier row, and one row is cancelled only once', () => {
    const text = QUOTED_HEAD +
      '"2026-03-01","PURCHASE","Shop","-5.00"\n"2026-03-04","PURCHASE","Shop","-5.00"\n"2026-03-05","REVERSAL","Shop","5.00"\n"2026-03-06","REVERSAL","Shop","5.00"\n';
    const { rows } = reconcile(harbour(text), { fingerprints: [] });
    expect(rows[2]?.pair_fingerprint).toBe(rows[1]!.fingerprint);
    expect(rows[3]?.pair_fingerprint).toBe(rows[0]!.fingerprint);
    expect(rows.map((row) => row.status)).toEqual(['reversed', 'reversed', 'reversed', 'reversed']);
  });

  test('a row more than 10 days before, a later row, or a row with the same direction is not a partner', () => {
    const far = QUOTED_HEAD + '"2026-03-01","PURCHASE","Shop","-5.00"\n"2026-03-12","REVERSAL","Shop","5.00"\n';
    expect(reconcile(harbour(far), { fingerprints: [] }).rows.map((row) => row.status)).toEqual(['new', 'problem']);
    const edge = QUOTED_HEAD + '"2026-03-01","PURCHASE","Shop","-5.00"\n"2026-03-11","REVERSAL","Shop","5.00"\n';
    expect(reconcile(harbour(edge), { fingerprints: [] }).rows.map((row) => row.status)).toEqual(['reversed', 'reversed']);
    const later = QUOTED_HEAD + '"2026-03-08","REVERSAL","Shop","5.00"\n"2026-03-09","PURCHASE","Shop","-5.00"\n';
    expect(reconcile(harbour(later), { fingerprints: [] }).rows.map((row) => row.status)).toEqual(['problem', 'new']);
    const same = QUOTED_HEAD + '"2026-03-07","EFT","Shop","5.00"\n"2026-03-08","REVERSAL","Shop","5.00"\n';
    expect(reconcile(harbour(same), { fingerprints: [] }).rows.map((row) => row.status)).toEqual(['new', 'problem']);
  });

  test('a reversal of a row that is already in the ledger points at that row', () => {
    const rows = harbour(HARBOUR_SAMPLE);
    const result = reconcile(rows, { fingerprints: [rows[4]!.fingerprint] });
    expect(result.rows[4]?.status).toBe('duplicate');
    expect(result.rows[5]).toMatchObject({ status: 'reversed', pair_fingerprint: rows[4]!.fingerprint });
    expect(result.rows[5]?.note).toContain('already in the ledger');
  });
});

describe('reconcile: transfers between own accounts', () => {
  test('the transfer out of Northbank pairs with the transfer into Harbour Bank', () => {
    const harbourRows = harbour(HARBOUR_SAMPLE);
    const north = reconcile(northRows(), { fingerprints: [], other_account_rows: asOther(harbourRows) });
    expect(north.rows[5]).toMatchObject({ status: 'transfer', pair_fingerprint: harbourRows[2]!.fingerprint });
    // The money in is a row of the ledger already (income), thus the note does not say "not income".
    expect(north.rows[5]?.note).toBe('This is a move between your own accounts, from northbank-current to harbour-everyday. It is not an expense. The other side is already in the ledger as income, and it stays income. Next time, import the account that the money left first. This is a match by amount and date only. The review cannot undo it.');
    expect(north.summary).toEqual({ new: 13, duplicate: 0, transfer: 1, held: 0, reversed: 0, problem: 0 });
    const other = reconcile(harbourRows, { fingerprints: [], other_account_rows: asOther(northRows()) });
    expect(other.rows[2]).toMatchObject({ status: 'transfer', pair_fingerprint: north.rows[5]!.fingerprint });
  });

  test('the fee of the transfer stays an expense', () => {
    const north = reconcile(northRows(), { fingerprints: [], other_account_rows: asOther(harbour(HARBOUR_SAMPLE)) });
    expect(north.rows[6]).toMatchObject({ kind: 'fee', status: 'new' });
  });

  test('two rows of one batch in different accounts pair with each other', () => {
    const out = harbour(QUOTED_HEAD + '"2026-03-01","EFT","To other","-100.00"\n', 'one');
    const into = harbour(QUOTED_HEAD + '"2026-03-04","EFT","From other","100.00"\n', 'two');
    const { rows, summary } = reconcile([...out, ...into], { fingerprints: [] });
    expect(summary.transfer).toBe(2);
    expect(rows[0]?.pair_fingerprint).toBe(rows[1]!.fingerprint);
    expect(rows[1]?.pair_fingerprint).toBe(rows[0]!.fingerprint);
  });

  test('no pair: the same account, more than 3 days, a different amount, or the same direction', () => {
    const base = harbour(QUOTED_HEAD + '"2026-03-01","EFT","To other","-100.00"\n', 'one');
    const cases: Array<[date: string, amount: string, account: string]> = [
      ['2026-03-02', '100.00', 'one'],
      ['2026-03-05', '100.00', 'two'],
      ['2026-03-02', '100.01', 'two'],
      ['2026-03-02', '-100.00', 'two'],
    ];
    for (const [date, amount, account] of cases) {
      const second = harbour(QUOTED_HEAD + '"' + date + '","EFT","Other side","' + amount + '"\n', account);
      expect(reconcile([...base, ...second], { fingerprints: [] }).summary.transfer).toBe(0);
    }
  });

  test('one known row of the other account pairs with one row only', () => {
    const text = QUOTED_HEAD + '"2026-03-01","EFT","Move","-100.00"\n"2026-03-02","EFT","Move","-100.00"\n';
    const others: OtherAccountRow[] = [{ account: 'two', occurred_on: '2026-03-02', amount_cents: 10000, direction: 'in', fingerprint: 'two|x' }];
    const { rows } = reconcile(harbour(text, 'one'), { fingerprints: [], other_account_rows: others });
    expect(rows.map((row) => row.status)).toEqual(['new', 'transfer']); // the nearest date wins
  });
});

describe('reconcile: balance continuity', () => {
  test('the full Northbank sample has a continuous balance', () => {
    expect(reconcile(northRows(), { fingerprints: [] }).problems).toEqual([]);
  });

  test('a cut file gives one batch problem at the first line where the balance breaks', () => {
    const lines = NORTHBANK_SAMPLE.split('\n');
    const cut = [...lines.slice(0, 5), ...lines.slice(7)].join('\n'); // lines 6 and 7 of the file are absent
    const rows = normalise(inspect(cut), NORTHBANK, { account: NORTHBANK_ACCOUNT, source_name: 'cut.csv' }).rows;
    const result = reconcile(rows, { fingerprints: [] });
    expect(result.problems).toHaveLength(1);
    expect(result.problems[0]?.rule).toBe('BATCH-BALANCE');
    expect(result.problems[0]?.text).toContain('Line 6: the balance does not continue from line 5.');
    expect(result.problems[0]?.text).toContain('R19 347.65 and the file has R15 897.65');
    expect(result.summary.new).toBe(12); // the rows themselves have no problem
  });

  test('a file with the newest row first is checked in the order of time', () => {
    const lines = NORTHBANK_SAMPLE.trim().split('\n');
    const reversed = [lines[0], ...lines.slice(1).reverse()].join('\n');
    const rows = normalise(inspect(reversed), NORTHBANK, { account: NORTHBANK_ACCOUNT, source_name: 'r.csv' }).rows;
    expect(reconcile(rows, { fingerprints: [] }).problems).toEqual([]);
  });

  test('a file without a balance column has no balance check', () => {
    expect(reconcile(harbour(HARBOUR_SAMPLE), { fingerprints: [] }).problems).toEqual([]);
  });
});
