// Tests of the insights: each detector with data that supports it and with data that does not,
// and the rule that the three parts stay separate and judge nobody.
import { describe, expect, test } from 'vitest';
import { insightsFor, type InsightInput } from './insights.ts';

// A quiet cycle: no detector has anything to say.
function quiet(): InsightInput {
  return {
    weeks: [{ cap_cents: 50_000, spent_cents: 40_000 }, { cap_cents: 50_000, spent_cents: 45_000 }],
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

test('a quiet cycle gives no insight', () => {
  expect(insightsFor(quiet())).toEqual([]);
});

describe('weeks_over_cap', () => {
  test('3 of the last 4 weeks over the cap gives the insight with its numbers', () => {
    const weeks = [{ cap_cents: 50_000, spent_cents: 10_000 }, { cap_cents: 50_000, spent_cents: 60_000 }, { cap_cents: 50_000, spent_cents: 50_001 }, { cap_cents: 50_000, spent_cents: 50_000 }, { cap_cents: 50_000, spent_cents: 70_000 }];
    const found = insightsFor({ ...quiet(), weeks }).find((i) => i.id === 'weeks_over_cap');
    expect(found?.evidence).toEqual({ weeks_over: 3, weeks_with_data: 4 });
    expect(found?.observation).toBe('3 of the last 4 weeks with data were over the weekly cap.');
  });

  test('2 weeks over the cap gives nothing, and a week with no data is not counted', () => {
    const weeks = [{ cap_cents: 50_000, spent_cents: 60_000 }, { cap_cents: 50_000, spent_cents: 60_000 }, { cap_cents: 50_000, spent_cents: null }, { cap_cents: 50_000, spent_cents: 50_000 }];
    expect(ids({ ...quiet(), weeks })).not.toContain('weeks_over_cap');
    expect(ids({ ...quiet(), weeks: [] })).not.toContain('weeks_over_cap');
  });
});

describe('early_cycle_share', () => {
  test('more than half of the spending in the first 5 days gives the insight', () => {
    const spend_by_day = [40_000, 30_000, 0, 20_000, 10_000, ...Array.from({ length: 25 }, () => 2_000)];
    const found = insightsFor({ ...quiet(), spend_by_day }).find((i) => i.id === 'early_cycle_share');
    expect(found?.evidence).toEqual({ early_cents: 100_000, total_cents: 150_000, share_percent: 66, early_days: 5 });
  });

  test('exactly half, no spending, or a cycle of 5 days or less gives nothing', () => {
    const half = [10_000, 10_000, 10_000, 10_000, 10_000, 50_000];
    expect(ids({ ...quiet(), spend_by_day: half })).not.toContain('early_cycle_share');
    expect(ids({ ...quiet(), spend_by_day: Array.from({ length: 30 }, () => 0) })).not.toContain('early_cycle_share');
    expect(ids({ ...quiet(), spend_by_day: [90_000, 5_000] })).not.toContain('early_cycle_share');
  });
});

describe('recurring_charges', () => {
  test('the same merchant and amount in 3 consecutive cycles is a subscription candidate', () => {
    const rows = [row('2025-12-25', 'streamhouse', 19_900), row('2026-01-25', 'streamhouse', 19_900), row('2026-02-25', 'streamhouse', 19_900), row('2026-02-25', 'streamhouse', 19_900)];
    const found = insightsFor({ ...quiet(), rows });
    expect(found.map((i) => i.id)).toEqual(['recurring_charges:streamhouse:19900']);
    expect(found[0]?.evidence).toEqual({ merchant_key: 'streamhouse', amount_cents: 19_900, consecutive_cycles: 3, first_cycle_id: '2025-12-25', last_cycle_id: '2026-02-25' });
  });

  test('2 cycles, a gap between cycles, different amounts, or 3 rows in one cycle gives nothing', () => {
    const two = [row('2026-01-25', 'streamhouse', 19_900), row('2026-02-25', 'streamhouse', 19_900)];
    const gap = [row('2025-11-25', 'streamhouse', 19_900), row('2025-12-25', 'streamhouse', 19_900), row('2026-02-25', 'streamhouse', 19_900)];
    const amounts = [row('2025-12-25', 'corner cafe', 4_500), row('2026-01-25', 'corner cafe', 5_200), row('2026-02-25', 'corner cafe', 6_100)];
    const sameCycle = [row('2026-02-25', 'corner cafe', 4_500), row('2026-02-25', 'corner cafe', 4_500), row('2026-02-25', 'corner cafe', 4_500)];
    for (const rows of [two, gap, amounts, sameCycle]) expect(insightsFor({ ...quiet(), rows })).toEqual([]);
  });
});

describe('category_change', () => {
  test('a category that grew by more than 25% and by R200 or more gives the insight', () => {
    const found = insightsFor({ ...quiet(), by_category_now: { 'eating-out': 150_000, groceries: 300_000 }, by_category_before: { 'eating-out': 100_000, groceries: 290_000 } });
    expect(found.map((i) => i.id)).toEqual(['category_change:eating-out']);
    expect(found[0]?.evidence).toEqual({ category_id: 'eating-out', now_cents: 150_000, before_cents: 100_000, growth_cents: 50_000, growth_percent: 50 });
  });

  test('a small amount, exactly 25%, a decrease, or no previous amount gives nothing', () => {
    const cases: Array<[now: number, before: number | undefined]> = [[15_000, 5_000], [125_000, 100_000], [50_000, 100_000], [90_000, undefined]];
    for (const [now, before] of cases) {
      const by_category_before: Record<string, number> = before === undefined ? {} : { health: before };
      const input = { ...quiet(), by_category_now: { health: now }, by_category_before };
      expect(insightsFor(input)).toEqual([]);
    }
  });
});

describe('savings_not_moved', () => {
  test('planned savings and no savings row gives the insight', () => {
    const found = insightsFor({ ...quiet(), planned_savings_cents: 600_000, savings_rows_cents: 0 });
    expect(found.map((i) => i.id)).toEqual(['savings_not_moved']);
    expect(found[0]?.observation).toContain('R6 000.00');
  });

  test('no planned savings, or a savings row, gives nothing', () => {
    expect(insightsFor({ ...quiet(), planned_savings_cents: 0, savings_rows_cents: 0 })).toEqual([]);
    expect(insightsFor({ ...quiet(), planned_savings_cents: 600_000, savings_rows_cents: 100 })).toEqual([]);
  });
});

describe('the three parts of each insight', () => {
  const all = insightsFor({
    weeks: [{ cap_cents: 100, spent_cents: 200 }, { cap_cents: 100, spent_cents: 200 }, { cap_cents: 100, spent_cents: 200 }],
    spend_by_day: [90_000, ...Array.from({ length: 28 }, () => 0), 1_000], // a complete cycle of 30 days
    rows: [row('2025-12-25', 'streamhouse', 19_900), row('2026-01-25', 'streamhouse', 19_900), row('2026-02-25', 'streamhouse', 19_900)],
    by_category_now: { health: 200_000 },
    by_category_before: { health: 100_000 },
    planned_savings_cents: 600_000,
    savings_rows_cents: 0,
  });

  test('all five detectors can give an insight, in a fixed order', () => {
    expect(all.map((i) => i.id.split(':')[0])).toEqual(['weeks_over_cap', 'early_cycle_share', 'recurring_charges', 'category_change', 'savings_not_moved']);
  });

  test('the observation has a number, there are 2 or more interpretations, and the recommendation is an option', () => {
    for (const insight of all) {
      expect(insight.observation).toMatch(/\d/);
      expect(insight.interpretations.length).toBeGreaterThanOrEqual(2);
      expect(insight.recommendation).toMatch(/^Consider /);
      expect(Object.keys(insight.evidence).length).toBeGreaterThan(0);
    }
  });

  test('no insight text contains a judgement word', () => {
    const words = /\b(bad|fail\w*|irresponsibl\w*|should have|guilty|shame\w*|lazy|wast\w*)\b/i;
    for (const insight of all) {
      for (const text of [insight.observation, insight.recommendation, ...insight.interpretations]) expect(text).not.toMatch(words);
    }
  });
});
