// The whole server: a real HTTP request, the real handlers and services, SQLite in memory.
// Port 0: the operating system gives a free port, thus two test files cannot collide.
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { fixedClock, sequentialIds } from '../clock.ts';
import { seed } from '../repositories/seed.ts';
import { openDatabase, sqliteStores } from '../repositories/sqlite.ts';
import { createHttpServer } from './server.ts';

const db = openDatabase(':memory:');
const stores = sqliteStores(db);
seed(stores, '2026-03');
const server = createHttpServer({ stores, clock: fixedClock('2026-03-14'), ids: sequentialIds() });
let base = '';

beforeAll(async () => {
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  base = 'http://127.0.0.1:' + (server.address() as AddressInfo).port;
});
afterAll(() => {
  server.close();
  db.close();
});

const request = { idempotency_key: 'key-0001', amount_cents: 18500, currency: 'ZAR', occurred_on: '2026-03-14', merchant_name: 'Woolworths', category_id: 'groceries' };
async function post(body: unknown, headers: Record<string, string> = { 'Content-Type': 'application/json' }) {
  const response = await fetch(base + '/api/expenses', { method: 'POST', headers, body: typeof body === 'string' ? body : JSON.stringify(body) });
  return { status: response.status, body: (await response.json()) as any, retry: response.headers.get('retry-after') };
}

test('GET /api/categories gives the active categories', async () => {
  const body = (await (await fetch(base + '/api/categories')).json()) as Array<{ id: string }>;
  expect(body.map((c) => c.id)).toContain('groceries');
  expect(body.map((c) => c.id)).not.toContain('gym');
});

test('201 for a new expense, then 200 for the same request again', async () => {
  const first = await post(request);
  expect(first.status).toBe(201);
  expect(first.body.budget.spent_cents).toBe(18500);
  const second = await post(request);
  expect(second.status).toBe(200);
  expect(second.body.replayed).toBe(true);
});

test('the summary of the month shows the expense', async () => {
  const body = (await (await fetch(base + '/api/summary?period=2026-03')).json()) as any;
  expect(body.total_spent_cents).toBe(18500);
  expect(body.recent[0].merchant_name).toBe('Woolworths');
});

test('each kind of refusal has its status code', async () => {
  expect((await post({ ...request, idempotency_key: 'key-0002', amount_cents: -1 })).status).toBe(400); // shape
  expect((await post({ ...request, idempotency_key: 'key-0002', category_id: 'gym' })).status).toBe(422); // rule
  const similar = await post({ ...request, idempotency_key: 'key-0002' });
  expect([similar.status, similar.body.error.code]).toEqual([409, 'NEEDS_CONFIRMATION']);
  const conflict = await post({ ...request, amount_cents: 999 });
  expect([conflict.status, conflict.body.error.code]).toEqual([409, 'KEY_CONFLICT']);
});

test('the server protects itself', async () => {
  expect((await post('{not json')).status).toBe(400);
  expect((await post(request, { 'Content-Type': 'text/plain' })).status).toBe(415);
  const large = await post({ ...request, note: 'x'.repeat(50_000) });
  expect([large.status, large.body.error.problems[0].text]).toEqual([400, 'The body is larger than 40000 bytes.']); // the limit of the body, not the limit of the note
  expect((await post(request, { 'Content-Type': 'application/json', Origin: 'https://example.com' })).status).toBe(403);
  expect((await fetch(base + '/api/no-such-thing')).status).toBe(404);
});

test('a defect gives 500 with no detail; a store that is not available gives 503 and Retry-After', async () => {
  const insert = stores.expenses.insert;
  stores.expenses.insert = () => {
    throw new (class extends Error {})('disk');
  };
  // An error that is not known is a defect: 500, with no detail.
  expect((await post({ ...request, idempotency_key: 'key-0003', merchant_name: 'Checkers' })).status).toBe(500);
  stores.expenses.insert = insert;

  const closed = openDatabase(':memory:');
  const broken = createHttpServer({ stores: sqliteStores(closed), clock: fixedClock('2026-03-14'), ids: sequentialIds() });
  closed.close();
  await new Promise<void>((done) => broken.listen(0, '127.0.0.1', done));
  const response = await fetch('http://127.0.0.1:' + (broken.address() as AddressInfo).port + '/api/categories');
  expect([response.status, response.headers.get('retry-after')]).toEqual([503, '1']);
  broken.close();
});
