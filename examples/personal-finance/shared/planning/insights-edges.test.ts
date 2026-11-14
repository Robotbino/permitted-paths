// Tests of the repairs after a review of the insights: a cycle in progress, refunds, category ids
// that are names on each object, keys with control characters, and the kind of each interpretation.
import { describe, expect, test } from 'vitest';
import { insightsFor, type InsightInput } from './insights.ts';

function quiet(): InsightInput {
  return {
    weeks: [{ cap_cents: 50_000, spent_cents: 40_000 }],
    spend_by_day: Array.from({ length: 30 }, () => 3_000),
    rows: [],
    by_category_now: { groceries: 300_000 },
    by_category_before: { groceries: 290_000 },
    planned_savings_cents: 100_000,
    savings_rows_cents: 100_000,
  };
}
const ids = (input: InsightInput): string[] => insightsFor(input).map((i) => i.id);
const row = (cycle_id: string, merchant_key: string, amount_cents: number) => ({ cycle_id, merchant_key, amount_cents, category_id: 'entertainment' });
const three = (merchant_key: string, amount_cents: number) => ['2025-12-25', '2026-01-25', '2026-02-25'].map((id) => row(id, merchant_key, amount_cents));
const frontLoaded = [40_000, 30_000, 0, 20_000, 10_000, 5_000, 5_000, 5_000, ...Array.from({ length: 23 }, () => 0)];

describe('early_cycle_share in a cycle that is in progress', () => {
  test('even spending on day 9 gives nothing, with 9 slots and with 31 slots', () => {
    expect(ids({ ...quiet(), spend_by_day: Array.from({ length: 9 }, () => 1_000) })).toEqual([]);
    expect(ids({ ...quiet(), spend_by_day: [...Array.from({ length: 8 }, () => 1_000), ...Array.from({ length: 23 }, () => 0)] })).toEqual([]);
  });

  test('spending that is all near the payday gives nothing while the days after it can be in the future', () => {
    expect(frontLoaded.length).toBe(31);
    expect(ids({ ...quiet(), spend_by_day: frontLoaded })).toEqual([]);
    expect(ids({ ...quiet(), spend_by_day: frontLoaded, days_observed: 27 })).toEqual([]);
  });

  test('the same spending gives the insight when the caller says that the cycle is complete', () => {
    const found = insightsFor({ ...quiet(), spend_by_day: frontLoaded, days_observed: 31 });
    expect(found.map((i) => i.id)).toEqual(['early_cycle_share']);
    expect(found[0]?.evidence).toEqual({ early_cents: 100_000, total_cents: 115_000, share_percent: 86, early_days: 5 });
  });

  test('days after days_observed are not in the total', () => {
    const spend_by_day = [...Array.from({ length: 28 }, () => 1_000), 500_000];
    expect(ids({ ...quiet(), spend_by_day, days_observed: 28 })).toEqual([]);
  });

  test('a refund day counts as 0, thus the share is never above 100%', () => {
    const spend_by_day = [1_000, 0, 0, 0, 0, -500, ...Array.from({ length: 23 }, () => 0), 100];
    const found = insightsFor({ ...quiet(), spend_by_day });
    expect(found[0]?.evidence).toEqual({ early_cents: 1_000, total_cents: 1_100, share_percent: 90, early_days: 5 });
    expect(ids({ ...quiet(), spend_by_day: [1_000, 0, 0, 0, 0, -500] })).toEqual([]);
  });
});

describe('recurring_charges', () => {
  test('a refund or an amount of 0 in 3 cycles is not a charge', () => {
    expect(ids({ ...quiet(), rows: three('streamhouse', -5_000) })).toEqual([]);
    expect(ids({ ...quiet(), rows: three('streamhouse', 0) })).toEqual([]);
    expect(ids({ ...quiet(), rows: three('streamhouse', Number.NaN) })).toEqual([]);
  });

  test('the observation and the evidence give the cycles of the run', () => {
    const rows = [row('2024-01-25', 'ironworks gym', 55_000), row('2024-02-25', 'ironworks gym', 55_000), row('2024-03-25', 'ironworks gym', 55_000), row('2026-02-25', 'ironworks gym', 55_000)];
    const found = insightsFor({ ...quiet(), rows });
    expect(found[0]?.observation).toBe('The merchant "ironworks gym" charged R550.00 in 3 consecutive cycles (2024-01-25 to 2024-03-25).');
    expect(found[0]?.evidence).toMatchObject({ consecutive_cycles: 3, first_cycle_id: '2024-01-25', last_cycle_id: '2024-03-25' });
  });

  test('of two runs with the same length, the later one is reported', () => {
    const rows = [...['2024-01-25', '2024-02-25', '2024-03-25', '2025-12-25', '2026-01-25', '2026-02-25'].map((id) => row(id, 'streamhouse', 19_900))];
    expect(insightsFor({ ...quiet(), rows })[0]?.evidence).toMatchObject({ first_cycle_id: '2025-12-25', last_cycle_id: '2026-02-25' });
  });

  test('a cycle id that is not a day of the calendar is not used', () => {
    const rows = [row('2026-02-30', 'streamhouse', 19_900), row('2026-03-30', 'streamhouse', 19_900), row('2026-04-30', 'streamhouse', 19_900)];
    expect(ids({ ...quiet(), rows })).toEqual([]);
  });

  test('control characters, direction characters and a long key do not go into the sentence', () => {
    const key = 'corner\r\ncafe‮' + 'x'.repeat(5_000);
    const found = insightsFor({ ...quiet(), rows: three(key, 4_500) });
    expect(found[0]?.observation).not.toMatch(/[\r\n‮]/);
    expect(found[0]?.observation.length).toBeLessThan(160);
    expect(found[0]?.observation).toContain('The merchant "corner  cafe x');
    expect(found[0]?.evidence.merchant_key).toBe(key); // the evidence keeps the key as it is
  });
});

describe('category_change', () => {
  test('a category id that is a name on each object gives nothing when it has no previous amount', () => {
    const input = { ...quiet(), by_category_now: { constructor: 50_000, toString: 100, __proto__: 90_000, hasOwnProperty: 70_000 }, by_category_before: {} };
    expect(insightsFor(input)).toEqual([]);
  });

  test('such a category id works as each other id when both cycles have an amount', () => {
    const found = insightsFor({ ...quiet(), by_category_now: { constructor: 150_000 }, by_category_before: { constructor: 100_000 } });
    expect(found.map((i) => i.id)).toEqual(['category_change:constructor']);
    expect(found[0]?.evidence).toMatchObject({ growth_cents: 50_000, growth_percent: 50 });
  });

  test('an amount that is not a whole number gives nothing', () => {
    expect(insightsFor({ ...quiet(), by_category_now: { health: Number.NaN }, by_category_before: { health: 100_000 } })).toEqual([]);
    expect(insightsFor({ ...quiet(), by_category_now: { health: 200_000 }, by_category_before: { health: Number.NaN } })).toEqual([]);
  });
});

describe('savings_not_moved', () => {
  test('savings rows that add up to less than 0 are stated as that, not as "no savings row"', () => {
    const found = insightsFor({ ...quiet(), planned_savings_cents: 100, savings_rows_cents: -500 });
    expect(found.map((i) => i.id)).toEqual(['savings_not_moved']);
    expect(found[0]?.observation).toBe('The plan has R1.00 for savings, and the savings rows of this cycle add up to -R5.00.');
  });
});

describe('the texts of each detector', () => {
  const all = insightsFor({
    weeks: [{ cap_cents: 100, spent_cents: 200 }, { cap_cents: 100, spent_cents: 200 }, { cap_cents: 100, spent_cents: 200 }],
    spend_by_day: frontLoaded,
    days_observed: 31,
    rows: three('streamhouse', 19_900),
    by_category_now: { health: 200_000 },
    by_category_before: { health: 100_000 },
    planned_savings_cents: 600_000,
    savings_rows_cents: -100,
  });

  test('each detector has an interpretation that is not about the behaviour of the person', () => {
    // An unusual cost, a wrong category, a cap that is too low, missing data, or an act of the merchant.
    const notBehaviour: Record<string, string> = {
      weeks_over_cap: 'The cap is too low for the real costs of a week.',
      early_cycle_share: 'A dated cost is in the free spending and not in the commitments.',
      recurring_charges: 'The merchant still charges for a plan that was cancelled.',
      category_change: 'Some rows have a wrong category.',
      savings_not_moved: 'The savings account is not in the imported data.',
    };
    expect(all.map((i) => i.id.split(':')[0]).sort()).toEqual(Object.keys(notBehaviour).sort());
    for (const insight of all) {
      expect(insight.interpretations.length).toBeGreaterThanOrEqual(2);
      expect(insight.interpretations).toContain(notBehaviour[insight.id.split(':')[0] ?? '']);
    }
  });

  test('no text contains a judgement word, also in the variants for refunds', () => {
    const words = /\b(bad|fail\w*|irresponsibl\w*|should have|guilty|shame\w*|lazy|wast\w*)\b/i;
    for (const insight of all) {
      for (const text of [insight.observation, insight.recommendation, ...insight.interpretations]) expect(text).not.toMatch(words);
    }
  });

  test('insightsFor does not change its input', () => {
    const input = quiet();
    input.rows = three('streamhouse', 19_900);
    Object.freeze(input.rows);
    Object.freeze(input.spend_by_day);
    Object.freeze(input.by_category_now);
    expect(insightsFor(Object.freeze(input)).length).toBe(1);
  });
});
