// The merchant memory: "the last time, the person put this merchant in this category".
// It is knowledge that the application learns from the decisions of the person, and it is plain data:
// a table that a person can read, correct and delete. The suggest graph asks the memory before it
// asks the model, thus a merchant that is known costs nothing and needs no network.
import type { DatabaseSync } from 'node:sqlite';

export type Remembered = { merchant_key: string; category_id: string; times_confirmed: number; last_confirmed_on: string; source_run_id: string };

export interface MerchantMemory {
  recall(merchant_key: string): Remembered | null;
  /** The person confirmed this category. The same category again counts up; a different category starts at 1. */
  remember(merchant_key: string, category_id: string, on: string, source_run_id: string): void;
}

const next = (before: Remembered | null, merchant_key: string, category_id: string, on: string, source_run_id: string): Remembered => ({
  merchant_key, category_id, last_confirmed_on: on, source_run_id,
  times_confirmed: before && before.category_id === category_id ? before.times_confirmed + 1 : 1,
});

export function memoryMerchantMemory(): MerchantMemory {
  const rows = new Map<string, Remembered>();
  return {
    recall: (key) => rows.get(key) ?? null,
    remember: (key, category_id, on, run) => void rows.set(key, next(rows.get(key) ?? null, key, category_id, on, run)),
  };
}

export function sqliteMerchantMemory(db: DatabaseSync): MerchantMemory {
  const recall = (key: string): Remembered | null => {
    const row = db.prepare('SELECT * FROM merchant_memory WHERE merchant_key = ?').get(key);
    return row ? ({ ...row } as Remembered) : null;
  };
  return {
    recall,
    remember(key, category_id, on, run) {
      const r = next(recall(key), key, category_id, on, run);
      db.prepare(
        'INSERT INTO merchant_memory (merchant_key, category_id, times_confirmed, last_confirmed_on, source_run_id) VALUES (?, ?, ?, ?, ?) ' +
          'ON CONFLICT (merchant_key) DO UPDATE SET category_id = excluded.category_id, times_confirmed = excluded.times_confirmed, last_confirmed_on = excluded.last_confirmed_on, source_run_id = excluded.source_run_id',
      ).run(r.merchant_key, r.category_id, r.times_confirmed, r.last_confirmed_on, r.source_run_id);
    },
  };
}
