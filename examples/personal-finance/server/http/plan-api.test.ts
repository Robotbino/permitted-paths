// GET /api/plan and GET /api/weeks: a real HTTP request, the real handlers and service, SQLite in memory.
// Port 0: the operating system gives a free port, thus two test files cannot collide.
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, expect, test } from 'vitest';
import type { PlanView, WeeksView } from '../../shared/contracts.plan.ts';
import { MAIN } from '../../shared/planning/plan-example.ts';
import { fixedClock, sequentialIds } from '../clock.ts';
import { seed } from '../repositories/seed.ts';
import { openDatabase, sqliteStores } from '../repositories/sqlite.ts';
import { createHttpServer } from './server.ts';

const db = openDatabase(':memory:');
const stores = sqliteStores(db);
seed(stores, '2026-02');
stores.income.insert({ id: 'inc_1', idempotency_key: 'pay-0001', occurred_on: '2026-01-25', amount_cents: 3_200_000, source: 'Salary', account: MAIN, created_at: '2026-01-25T06:00:00.000Z' });
const server = createHttpServer({ stores, clock: fixedClock('2026-02-03'), ids: sequentialIds() });
let base = '';

beforeAll(async () => {
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  base = 'http://127.0.0.1:' + (server.address() as AddressInfo).port;
});
afterAll(() => {
  server.close();
  db.close();
});

async function get<T>(path: string): Promise<{ status: number; body: T }> {
  const response = await fetch(base + path);
  return { status: response.status, body: (await response.json()) as T };
}
const record = (body: object) => fetch(base + '/api/expenses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currency: 'ZAR', ...body }) });

test('GET /api/plan gives the plan view of the cycle of today', async () => {
  const { status, body } = await get<PlanView>('/api/plan');
  expect(status).toBe(200);
  expect(body.today).toBe('2026-02-03');
  expect(body.cycle).toEqual({ id: '2026-01-25', start: '2026-01-25', end: '2026-02-24', days: 31 });
  expect([body.income_cents, body.income_source, body.input_problems]).toEqual([3_200_000, 'this_cycle', []]);
  // No expense is on record, thus no history and no unlisted amount: R32 000 - R13 649 - R6 500 - R0 - R1 600.
  expect(body.plan?.headroom_cents).toBe(1_025_100);
  expect(body.plan?.sizing.chosen_cents).toBe(700_000);
  expect(body.weeks).toHaveLength(5);
  expect(body.savings).toMatchObject({ planned_cents: 700_000, moved_cents: 0, held: false });
  expect(body.headline).not.toMatch(/on track|under budget/i);
});

test('an expense that is recorded through the API is in the weeks of the next answer', async () => {
  expect((await record({ idempotency_key: 'key-0001', amount_cents: 12_000, occurred_on: '2026-02-02', merchant_name: 'Bean There', category_id: 'eating-out' })).status).toBe(201);
  expect((await record({ idempotency_key: 'key-0002', amount_cents: 700_000, occurred_on: '2026-01-26', merchant_name: 'Northbank savings pot', category_id: 'savings' })).status).toBe(201);
  expect((await record({ idempotency_key: 'key-0003', amount_cents: 45_000, occurred_on: '2026-02-02', merchant_name: 'Greenleaf Market', category_id: 'groceries' })).status).toBe(201);

  const { status, body } = await get<WeeksView>('/api/weeks');
  expect(status).toBe(200);
  expect(Object.keys(body).sort()).toEqual(['cycle', 'pace', 'savings', 'weeks']);
  expect(body.weeks.map((w) => w.spent_cents)).toEqual([0, 12_000, null, null, null]);
  expect(body.savings).toMatchObject({ moved_cents: 700_000, held: true });

  const plan = (await get<PlanView>('/api/plan')).body;
  expect({ cycle: plan.cycle, weeks: plan.weeks, pace: plan.pace, savings: plan.savings }).toEqual(body);
  expect(plan.headline).toContain('the cycle is on track');
});

test('the date selects the cycle, for the two endpoints', async () => {
  const plan = await get<PlanView>('/api/plan?date=2026-03-01');
  expect(plan.body.cycle.id).toBe('2026-02-25');
  // The income of the cycle before, and that cycle is now in the history. It has not ended, thus it is not complete.
  expect(plan.body.income_source).toBe('previous_cycle');
  expect(plan.body.input.history).toEqual([{ cycle_id: '2026-01-25', complete: false, income_cents: 3_200_000, commitments_cents: 0, variable_cents: 45_000, unlisted_cents: 12_000 }]);
  expect(plan.body.weeks.every((w) => w.spent_cents === null)).toBe(true);
  expect((await get<WeeksView>('/api/weeks?date=2026-03-01')).body.cycle.id).toBe('2026-02-25');
});

test('a date that is not a day of the calendar is refused with 400', async () => {
  for (const path of ['/api/plan?date=2026-02-30', '/api/weeks?date=tomorrow']) {
    const { status, body } = await get<{ error: { code: string; problems: Array<{ rule: string }> } }>(path);
    expect([status, body.error.code, body.error.problems[0]?.rule]).toEqual([400, 'BAD_REQUEST', 'R3']);
  }
});

test('with no plan settings on record the answer is 404', async () => {
  const empty = openDatabase(':memory:');
  const other = createHttpServer({ stores: sqliteStores(empty), clock: fixedClock('2026-02-03'), ids: sequentialIds() });
  await new Promise<void>((done) => other.listen(0, '127.0.0.1', done));
  const response = await fetch('http://127.0.0.1:' + (other.address() as AddressInfo).port + '/api/plan');
  expect(response.status).toBe(404);
  other.close();
  empty.close();
});
