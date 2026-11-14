// The plan store and the income store in SQLite. This file contains the SQL of the four tables of
// migration 005: plan_settings, commitments, savings_pots and income.
// It gets the three query functions of sqlite.ts as an argument, thus each failure of the database
// becomes an error of the application in one location only.
import type { Income, PlanSettings, SavingsPot, StoredCommitment } from '../../shared/contracts.plan.ts';
import type { BufferItem } from '../../shared/planning/plan.ts';
import type { IncomeStore, PlanStore } from './ports.ts';

type Value = string | number | null;
export type Queries = {
  all<T>(sql: string, ...values: Value[]): T[];
  one<T>(sql: string, ...values: Value[]): T | null;
  run(sql: string, ...values: Value[]): void;
};

type SettingsRow = { payday: number; variable_living_cents: number; savings_request_cents: number; card_account: string | null; buffer_items: string };
type CommitmentRow = Omit<StoredCommitment, 'pay_to_person' | 'active'> & { pay_to_person: number; active: number };
type PotRow = Omit<SavingsPot, 'active'> & { active: number };

const INCOME_COLUMNS = 'id, idempotency_key, occurred_on, amount_cents, source, account, created_at';

export function sqlitePlanStores({ all, one, run }: Queries): { plan: PlanStore; income: IncomeStore } {
  return {
    plan: {
      getSettings() {
        const row = one<SettingsRow>('SELECT payday, variable_living_cents, savings_request_cents, card_account, buffer_items FROM plan_settings WHERE id = 1');
        if (!row) return null;
        return { ...row, buffer_items: JSON.parse(row.buffer_items) as BufferItem[] };
      },
      setSettings: (s) =>
        run(
          'INSERT INTO plan_settings (id, payday, variable_living_cents, savings_request_cents, card_account, buffer_items) VALUES (1, ?, ?, ?, ?, ?) '
            + 'ON CONFLICT (id) DO UPDATE SET payday = excluded.payday, variable_living_cents = excluded.variable_living_cents, '
            + 'savings_request_cents = excluded.savings_request_cents, card_account = excluded.card_account, buffer_items = excluded.buffer_items',
          s.payday, s.variable_living_cents, s.savings_request_cents, s.card_account, JSON.stringify(s.buffer_items.map((b) => ({ name: b.name, amount_cents: b.amount_cents }))),
        ),
      // rowid: the order of the first insert. An update keeps the rowid.
      listCommitments: () =>
        all<CommitmentRow>('SELECT id, name, amount_cents, due_day, account, pay_to_person, active FROM commitments ORDER BY rowid')
          .map((row) => ({ ...row, pay_to_person: row.pay_to_person === 1, active: row.active === 1 })),
      upsertCommitment: (c) =>
        run(
          'INSERT INTO commitments (id, name, amount_cents, due_day, account, pay_to_person, active) VALUES (?, ?, ?, ?, ?, ?, ?) '
            + 'ON CONFLICT (id) DO UPDATE SET name = excluded.name, amount_cents = excluded.amount_cents, due_day = excluded.due_day, '
            + 'account = excluded.account, pay_to_person = excluded.pay_to_person, active = excluded.active',
          c.id, c.name, c.amount_cents, c.due_day, c.account, c.pay_to_person ? 1 : 0, c.active ? 1 : 0,
        ),
      listPots: () => all<PotRow>('SELECT id, name, priority, target_cents, active FROM savings_pots ORDER BY rowid').map((row) => ({ ...row, active: row.active === 1 })),
      upsertPot: (p) =>
        run(
          'INSERT INTO savings_pots (id, name, priority, target_cents, active) VALUES (?, ?, ?, ?, ?) '
            + 'ON CONFLICT (id) DO UPDATE SET name = excluded.name, priority = excluded.priority, target_cents = excluded.target_cents, active = excluded.active',
          p.id, p.name, p.priority, p.target_cents, p.active ? 1 : 0,
        ),
    },
    income: {
      insert: (i) => run('INSERT INTO income (' + INCOME_COLUMNS + ') VALUES (?, ?, ?, ?, ?, ?, ?)', i.id, i.idempotency_key, i.occurred_on, i.amount_cents, i.source, i.account, i.created_at),
      findByKey: (key) => one<Income>('SELECT ' + INCOME_COLUMNS + ' FROM income WHERE idempotency_key = ?', key),
      sumBetween(from, toInclusive) {
        const row = one<{ total: number }>('SELECT COALESCE(SUM(amount_cents), 0) AS total FROM income WHERE occurred_on >= ? AND occurred_on <= ?', from, toInclusive);
        return row?.total ?? 0;
      },
      listBetween: (from, toInclusive) => all<Income>('SELECT ' + INCOME_COLUMNS + ' FROM income WHERE occurred_on >= ? AND occurred_on <= ? ORDER BY occurred_on, created_at, id', from, toInclusive),
    },
  };
}
