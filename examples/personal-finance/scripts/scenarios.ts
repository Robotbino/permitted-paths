// Named scenarios. Each scenario is a small world, a request, and the result that we expect:
// the HTTP status and the path through the execution graph.
// Two things use this file: the path tests, and the recorder that makes recordings/runs.json
// for the course page. The page replays what the real code did; it has no second implementation.
import type { AddressInfo } from 'node:net';
import type { Expense } from '../shared/contracts.ts';
import { fixedClock, sequentialIds } from '../server/clock.ts';
import { StorageUnavailable } from '../server/errors.ts';
import { memoryTrace, type RunRecord } from '../server/graph/trace.ts';
import { sqliteLedgerReader } from '../server/graph/verifier.ts';
import type { App } from '../server/http/handlers.ts';
import { createHttpServer } from '../server/http/server.ts';
import { seed } from '../server/repositories/seed.ts';
import { openDatabase, sqliteStores } from '../server/repositories/sqlite.ts';

export const TODAY = '2026-03-14';
const base = { amount_cents: 18500, currency: 'ZAR', occurred_on: TODAY, merchant_name: 'Woolworths', category_id: 'groceries' };

/** A defect that the scenario puts into the world, to show a failure path. */
export type Fault = 'none' | 'save_fails_once' | 'save_always_fails' | 'save_wrong_cents';

export type Scenario = {
  id: string;
  level: number;
  title: string;
  fault: Fault;
  /** Requests that go in before the request of the scenario. */
  before: unknown[];
  request: unknown;
  expect: { status: number; path: string[]; rows: number };
};

const OK_PATH = ['gate1', 'dedupe', 'load_facts', 'gate2', 'commit', 'project', 'verify', 'respond'];

export const SCENARIOS: Scenario[] = [
  { id: 'valid', level: 2, title: 'A correct expense: R185.00 at Woolworths', fault: 'none', before: [],
    request: { ...base, idempotency_key: 'key-valid-1' }, expect: { status: 201, path: OK_PATH, rows: 1 } },
  { id: 'bad_shape', level: 2, title: 'The amount is 185.5: not an integer number of cents', fault: 'none', before: [],
    request: { ...base, idempotency_key: 'key-shape-1', amount_cents: 185.5 }, expect: { status: 400, path: ['gate1', 'reject'], rows: 0 } },
  { id: 'inactive_category', level: 2, title: 'The category "Gym (closed)" is not active', fault: 'none', before: [],
    request: { ...base, idempotency_key: 'key-rule-1', merchant_name: 'Virgin Active', category_id: 'gym' }, expect: { status: 422, path: ['gate1', 'dedupe', 'load_facts', 'gate2', 'reject'], rows: 0 } },
  { id: 'over_budget', level: 2, title: 'R4 600.00 of groceries, with a budget of R4 500.00', fault: 'none', before: [],
    request: { ...base, idempotency_key: 'key-over-1', amount_cents: 460_000, merchant_name: 'Makro' }, expect: { status: 201, path: OK_PATH, rows: 1 } },
  { id: 'duplicate_submit', level: 2, title: 'The same request arrives a second time (the phone lost the first answer)', fault: 'none',
    before: [{ ...base, idempotency_key: 'key-dup-1' }],
    request: { ...base, idempotency_key: 'key-dup-1' }, expect: { status: 200, path: ['gate1', 'dedupe', 'respond'], rows: 1 } },
  { id: 'similar_expense', level: 2, title: 'A new request with the same date, amount and merchant', fault: 'none',
    before: [{ ...base, idempotency_key: 'key-sim-1' }],
    request: { ...base, idempotency_key: 'key-sim-2' }, expect: { status: 409, path: ['gate1', 'dedupe', 'load_facts', 'gate2', 'reject'], rows: 1 } },
  { id: 'save_fails_once', level: 2, title: 'The store fails one time during the save', fault: 'save_fails_once', before: [],
    request: { ...base, idempotency_key: 'key-retry-1' }, expect: { status: 201, path: ['gate1', 'dedupe', 'load_facts', 'gate2', 'commit', 'backoff', 'commit', 'project', 'verify', 'respond'], rows: 1 } },
  { id: 'store_down', level: 2, title: 'The store fails each time during the save', fault: 'save_always_fails', before: [],
    request: { ...base, idempotency_key: 'key-down-1' }, expect: { status: 503, path: ['gate1', 'dedupe', 'load_facts', 'gate2', 'commit', 'backoff', 'commit', 'escalate'], rows: 0 } },
  { id: 'ledger_mismatch', level: 2, title: 'A defect saves R186.00, not R185.00', fault: 'save_wrong_cents', before: [],
    request: { ...base, idempotency_key: 'key-wrong-1' }, expect: { status: 500, path: ['gate1', 'dedupe', 'load_facts', 'gate2', 'commit', 'project', 'verify', 'escalate'], rows: 1 } },
];

export type World = { app: App; base: string; rows(): number; close(): Promise<void> };

/** A new world for one scenario: SQLite in memory, a fixed clock, sequential ids, no real wait, a real HTTP server. */
export async function makeWorld(fault: Fault, extend: (app: App) => void = () => {}): Promise<World> {
  const db = openDatabase(':memory:');
  const stores = sqliteStores(db);
  seed(stores, TODAY.slice(0, 7));
  const insert = stores.expenses.insert;
  let calls = 0;
  if (fault !== 'none') {
    stores.expenses.insert = (expense: Expense) => {
      calls += 1;
      if (fault === 'save_always_fails' || (fault === 'save_fails_once' && calls === 1)) throw new StorageUnavailable('fault of the scenario');
      insert(fault === 'save_wrong_cents' ? { ...expense, amount_cents: expense.amount_cents + 100 } : expense);
    };
  }
  const app: App = {
    stores, clock: fixedClock(TODAY), ids: sequentialIds(), trace: memoryTrace(), ledger: sqliteLedgerReader(db), sleep: async () => {},
  };
  extend(app);
  const server = createHttpServer(app);
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  return {
    app,
    base: 'http://127.0.0.1:' + (server.address() as AddressInfo).port,
    rows: () => Number((db.prepare('SELECT COUNT(*) AS n FROM expenses').get() as { n: number }).n),
    close: async () => {
      await new Promise((done) => server.close(done));
      db.close();
    },
  };
}

export type Exchange = { status: number; body: any };

export async function send(world: World, path: string, body: unknown): Promise<Exchange> {
  const response = await fetch(world.base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { status: response.status, body: await response.json() };
}

export type ScenarioResult = { http: Exchange; run: RunRecord | null; rows: number };

export async function runScenario(scenario: Scenario): Promise<ScenarioResult> {
  const world = await makeWorld(scenario.fault);
  try {
    for (const earlier of scenario.before) await send(world, '/api/expenses', earlier);
    const http = await send(world, '/api/expenses', scenario.request);
    const run_id: string | undefined = http.body.run_id ?? http.body.error?.run_id;
    return { http, run: run_id ? (world.app.trace?.get(run_id) ?? null) : null, rows: world.rows() };
  } finally {
    await world.close();
  }
}
