import { describe, expect, test } from 'vitest';
import { inspect } from './inspect.ts';
import { cleanDescription, normalise, type StagedRow } from './normalise.ts';
import { PROFILES, type MappingProfile } from './profiles.ts';
import { HARBOUR_ACCOUNT, HARBOUR_SAMPLE, NORTHBANK_ACCOUNT, NORTHBANK_SAMPLE } from './samples.ts';

const NORTHBANK = PROFILES[0]!;
const HARBOUR = PROFILES[1]!;
const HEAD = 'Posting Date;Details;Debit;Credit;Balance\n';

function north(text: string): StagedRow[] {
  return normalise(inspect(text), NORTHBANK, { account: NORTHBANK_ACCOUNT, source_name: 'test.csv' }).rows;
}
function harbour(text: string): StagedRow[] {
  return normalise(inspect(text), HARBOUR, { account: HARBOUR_ACCOUNT, source_name: 'test.csv' }).rows;
}
function one(rows: StagedRow[]): StagedRow {
  expect(rows).toHaveLength(1);
  return rows[0]!;
}

describe('normalise', () => {
  test('a Northbank card purchase becomes a date, cents, a direction and a clean description', () => {
    const row = north(NORTHBANK_SAMPLE)[3]!;
    expect(row).toMatchObject({
      line_no: 5,
      account: NORTHBANK_ACCOUNT,
      occurred_on: '2026-03-01',
      amount_cents: 84235,
      direction: 'out',
      description: 'CARD PURCHASE GREENLEAF MARKET CARD 4821',
      description_clean: 'GREENLEAF MARKET',
      type: null,
      kind: 'expense',
      balance_after_cents: 1935765,
      problems: [],
      status: 'new',
    });
    expect(row.raw).toBe('01/03/2026;CARD PURCHASE GREENLEAF MARKET CARD 4821;842,35;;19 357,65');
  });

  test('the salary row is income on the pay day, with thousands spaces read correctly', () => {
    expect(north(NORTHBANK_SAMPLE)[0]).toMatchObject({ occurred_on: '2026-02-25', amount_cents: 2850000, direction: 'in', kind: 'income', balance_after_cents: 3270000 });
  });

  test('a row whose details start with FEE: is a fee', () => {
    const kinds = north(NORTHBANK_SAMPLE).map((row) => row.kind);
    expect(kinds.filter((kind) => kind === 'fee')).toHaveLength(2);
    expect(kinds.filter((kind) => kind === 'income')).toHaveLength(1);
    expect(kinds.filter((kind) => kind === 'expense')).toHaveLength(11);
  });

  test('a Harbour row gets its direction from the sign and its kind from the type', () => {
    const rows = harbour(HARBOUR_SAMPLE);
    expect(rows.map((row) => row.kind)).toEqual(['income', 'expense', 'income', 'expense', 'expense', 'reversal', 'expense', 'fee', 'expense', 'pending']);
    expect(rows[1]).toMatchObject({ amount_cents: 24550, direction: 'out', type: 'PURCHASE', description: 'Sunrise Pharmacy, Main Road', balance_after_cents: null });
    expect(rows[5]).toMatchObject({ amount_cents: 189900, direction: 'in', type: 'REVERSAL' });
  });

  test('negative_means "in" turns the sign around', () => {
    const profile: MappingProfile = { ...HARBOUR, negative_means: 'in' };
    const rows = normalise(inspect(HARBOUR_SAMPLE), profile, { account: 'a', source_name: 's' }).rows;
    expect(rows[1]?.direction).toBe('in');
    expect(rows[0]?.direction).toBe('out');
  });

  test('a run of 4 or more digits in a description is masked', () => {
    expect(north(NORTHBANK_SAMPLE)[5]?.description_clean).toBe('TRANSFER TO HARBOUR BANK ####');
    expect(cleanDescription('REF 123 ACC 1234567890 X', NORTHBANK)).toBe('REF 123 ACC #### X');
  });

  test('a "remove" entry that is not a correct expression is used as literal text', () => {
    const profile: MappingProfile = { ...HARBOUR, clean: [{ remove: 'POS (' }] };
    expect(cleanDescription('POS (Tidewater Grill', profile)).toBe('Tidewater Grill');
  });

  test('a date that does not exist is a problem of that row, and the other rows continue', () => {
    const rows = north(HEAD + '31/02/2026;SHOP A;10,00;;90,00\n01/03/2026;SHOP B;10,00;;80,00\n');
    expect(rows).toHaveLength(2);
    expect(rows[0]?.occurred_on).toBeNull();
    expect(rows[0]?.problems).toEqual([{ rule: 'ROW-DATE', text: 'The text "31/02/2026" is not a real date in the form DD/MM/YYYY.' }]);
    expect(rows[1]?.problems).toEqual([]);
    expect(rows[1]?.occurred_on).toBe('2026-03-01');
  });

  test('a debit and a credit that are both filled are a problem', () => {
    const row = one(north(HEAD + '01/03/2026;SHOP A;10,00;10,00;90,00\n'));
    expect(row.problems.map((p) => p.rule)).toEqual(['ROW-BOTH']);
    expect(row.amount_cents).toBeNull();
    expect(row.direction).toBeNull();
  });

  test('a debit and a credit that are both empty are a problem', () => {
    expect(one(north(HEAD + '01/03/2026;SHOP A;;;90,00\n')).problems.map((p) => p.rule)).toEqual(['ROW-NONE']);
  });

  test('a zero amount is a problem', () => {
    expect(one(north(HEAD + '01/03/2026;SHOP A;0,00;;90,00\n')).problems.map((p) => p.rule)).toEqual(['ROW-ZERO']);
    expect(one(harbour('"Date","Type","Description","Amount"\n"2026-03-01","PURCHASE","Shop","-0.00"\n')).problems.map((p) => p.rule)).toEqual(['ROW-ZERO']);
  });

  test('amount text with the incorrect decimal sign is a problem', () => {
    expect(one(north(HEAD + '01/03/2026;SHOP A;10.00;;90,00\n')).problems.map((p) => p.rule)).toEqual(['ROW-AMOUNT']);
  });

  test('a balance that is not a number is a problem, and an empty balance is not', () => {
    expect(one(north(HEAD + '01/03/2026;SHOP A;10,00;;n/a\n')).problems.map((p) => p.rule)).toEqual(['ROW-BALANCE']);
    expect(one(north(HEAD + '01/03/2026;SHOP A;10,00;;\n'))).toMatchObject({ problems: [], balance_after_cents: null });
    expect(one(north(HEAD + '01/03/2026;SHOP A;10,00;;-90,00\n')).balance_after_cents).toBe(-9000);
  });

  test('a row with too few cells keeps its place and gets problems', () => {
    const row = one(north(HEAD + '01/03/2026;SHOP A\n'));
    expect(row.problems.map((p) => p.rule)).toEqual(['ROW-CELLS', 'ROW-NONE']);
    expect(row.description).toBe('SHOP A');
  });

  test('a file without the date column gives a batch problem and no rows', () => {
    const result = normalise(inspect('Details;Debit;Credit\nSHOP;1,00;\n'), NORTHBANK, { account: 'a', source_name: 'cut.csv' });
    expect(result.rows).toEqual([]);
    expect(result.problems.map((p) => p.rule)).toEqual(['NORMALISE-COLUMNS']);
    expect(result.problems[0]?.text).toContain('cut.csv');
  });
});

describe('fingerprints', () => {
  test('the fingerprint is account, date, signed cents, clean description and occurrence number', () => {
    expect(north(NORTHBANK_SAMPLE)[3]?.fingerprint).toBe('northbank-current|2026-03-01|-84235|GREENLEAF MARKET|0');
    expect(north(NORTHBANK_SAMPLE)[0]?.fingerprint).toBe('northbank-current|2026-02-25|2850000|SALARY ACME LOGISTICS|0');
  });

  test('two equal purchases on one day get different fingerprints', () => {
    const rows = north(NORTHBANK_SAMPLE);
    expect(rows[7]?.fingerprint).toBe('northbank-current|2026-03-05|-6800|CORNER CAFE|0');
    expect(rows[8]?.fingerprint).toBe('northbank-current|2026-03-05|-6800|CORNER CAFE|1');
    expect(new Set(rows.map((row) => row.fingerprint)).size).toBe(14);
  });

  test('the same file gives the same fingerprints each time, and a different account gives different ones', () => {
    const first = north(NORTHBANK_SAMPLE).map((row) => row.fingerprint);
    expect(north(NORTHBANK_SAMPLE).map((row) => row.fingerprint)).toEqual(first);
    const other = normalise(inspect(NORTHBANK_SAMPLE), NORTHBANK, { account: 'second', source_name: 's' }).rows;
    expect(other.some((row) => first.includes(row.fingerprint))).toBe(false);
  });
});

describe('provenance', () => {
  test('each changed field of a Northbank row has a step with the text before and after', () => {
    expect(north(NORTHBANK_SAMPLE)[3]?.provenance).toEqual([
      { step: 'date', field: 'occurred_on', from: '01/03/2026', to: '2026-03-01' },
      { step: 'amount', field: 'amount_cents', from: '842,35', to: '84235' },
      { step: 'direction', field: 'direction', from: 'the column "Debit"', to: 'out' },
      { step: 'clean', field: 'description_clean', from: 'CARD PURCHASE GREENLEAF MARKET CARD 4821', to: 'GREENLEAF MARKET' },
      { step: 'kind', field: 'kind', from: 'direction out', to: 'expense' },
      { step: 'balance', field: 'balance_after_cents', from: '19 357,65', to: '1935765' },
    ]);
  });

  test('a value that did not change has no step', () => {
    const steps = harbour(HARBOUR_SAMPLE)[1]!.provenance;
    expect(steps.map((s) => s.step)).toEqual(['amount', 'direction', 'kind']); // an ISO date and a clean description stay as they are
    expect(steps[1]).toEqual({ step: 'direction', field: 'direction', from: 'a minus sign', to: 'out' });
    expect(steps[2]).toEqual({ step: 'kind', field: 'kind', from: 'direction out', to: 'expense' }); // PURCHASE is not a special type
  });
});
