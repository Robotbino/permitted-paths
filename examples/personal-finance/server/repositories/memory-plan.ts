// The plan store and the income store in memory. Tests use them.
// The same contract suite (plan-contract.test.ts) runs on these stores and on the SQLite stores.
// A Map keeps the order in which the keys were added, thus a list has the order of the first insert.
import type { Income, PlanSettings, SavingsPot, StoredCommitment } from '../../shared/contracts.plan.ts';
import { DuplicateKey } from '../errors.ts';
import type { IncomeStore, PlanStore } from './ports.ts';

const copySettings = (s: PlanSettings): PlanSettings => ({ ...s, buffer_items: s.buffer_items.map((b) => ({ ...b })) });

export function memoryPlanStores(): { plan: PlanStore; income: IncomeStore } {
  let settings: PlanSettings | null = null;
  const commitments = new Map<string, StoredCommitment>();
  const pots = new Map<string, SavingsPot>();
  const income: Income[] = [];
  const between = (from: string, toInclusive: string) => income.filter((i) => i.occurred_on >= from && i.occurred_on <= toInclusive);
  return {
    plan: {
      getSettings: () => (settings ? copySettings(settings) : null),
      setSettings: (next) => void (settings = copySettings(next)),
      listCommitments: () => [...commitments.values()].map((c) => ({ ...c })),
      upsertCommitment: (commitment) => void commitments.set(commitment.id, { ...commitment }),
      listPots: () => [...pots.values()].map((p) => ({ ...p })),
      upsertPot: (pot) => void pots.set(pot.id, { ...pot }),
    },
    income: {
      insert(row) {
        if (income.some((i) => i.idempotency_key === row.idempotency_key)) throw new DuplicateKey();
        income.push({ ...row });
      },
      findByKey(key) {
        const row = income.find((i) => i.idempotency_key === key);
        return row ? { ...row } : null;
      },
      sumBetween: (from, toInclusive) => between(from, toInclusive).reduce((sum, i) => sum + i.amount_cents, 0),
      listBetween: (from, toInclusive) =>
        between(from, toInclusive)
          .sort((a, b) => a.occurred_on.localeCompare(b.occurred_on) || a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
          .map((i) => ({ ...i })),
    },
  };
}
