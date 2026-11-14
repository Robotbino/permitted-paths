// The world of a scenario: the real application with SQLite in memory, a fixed clock, sequential ids,
// no real wait, stand-ins for the two models, and a real HTTP server on a free port.
// A scenario can put a defect into the world (a fault), or rows into the ledger before its request.
// All data is fictional: the person Sam, paid on day 25, with the plan of the worked example.
import type { AddressInfo } from 'node:net';
import type { Expense } from '../shared/contracts.ts';
import { MAIN, rand } from '../shared/planning/plan-example.ts';
import { fixedClock, sequentialIds } from '../server/clock.ts';
import { merchantKey } from '../server/domain/expense.ts';
import { StorageUnavailable } from '../server/errors.ts';
import { memoryTrace } from '../server/graph/trace.ts';
import { sqliteLedgerReader } from '../server/graph/verifier.ts';
import type { App } from '../server/http/handlers.ts';
import { createHttpServer } from '../server/http/server.ts';
import { memoryImportStore } from '../server/import/line-worker.ts';
import { fakeSuggester, type FakeBehaviour } from '../server/intelligence/fake-suggester.ts';
import { sqliteMerchantMemory } from '../server/intelligence/merchant-memory.ts';
import { fakeInterpreter, type FakeInterpreterBehaviour } from '../server/intelligence/permitted/fake-interpreter.ts';
import { sqliteAssistStore } from '../server/repositories/assist-store.ts';
import type { Stores } from '../server/repositories/ports.ts';
import { seed } from '../server/repositories/seed.ts';
import { openDatabase, sqliteStores } from '../server/repositories/sqlite.ts';

export const TODAY = '2026-03-14';
/** A day in the pay cycle of the worked example (2026-01-25 to 2026-02-24). */
export const PLAN_TODAY = '2026-02-03';

/** A defect that the scenario puts into the world, to show a failure path. */
export type Fault = 'none' | 'save_fails_once' | 'save_always_fails' | 'save_wrong_cents';

/** The world of a scenario. Level 2 has no memory and no model. Level 3 has a memory, and a model if `ai` is not 'off'. */
export type WorldOptions = {
  fault?: Fault;
  memory?: boolean;
  /** 'off': no suggester. The other values are behaviours of the stand-in model. */
  ai?: 'off' | FakeBehaviour;
  /** What the memory already knows: [merchant name, category id]. */
  remembered?: Array<[string, string]>;
  dailyCap?: number;
  /** The stand-in model waits this time before it answers, as a real model does. */
  latencyMs?: number;
  /** Level 3: the largest number of model calls for one import. */
  importBudget?: number;
  /** The date of the fixed clock. Absent: TODAY. */
  today?: string;
  /** Rows that the ledger has at the start. 'worked_example': the history and the pay cycle of the worked example. */
  ledger?: 'worked_example';
  /** Level 3, the assist path. Absent or 'off': no interpreter. The other values are behaviours of the stand-in. */
  interpreter?: 'off' | FakeInterpreterBehaviour;
};

export type World = { app: App; base: string; rows(): number; incomeRows(): number; memoryRows(): number; modelCalls(): number; close(): Promise<void> };

/**
 * The ledger behind the worked example: two complete pay cycles, one cycle with no income row, and
 * the first days of the cycle 2026-01-25. The plan that the application makes from these rows is
 * the plan of shared/planning/plan-example.ts (a test proves it).
 */
function workedExampleLedger(stores: Stores): void {
  let n = 0;
  const paid = (occurred_on: string) => {
    n += 1;
    stores.income.insert({ id: 'inc_seed_' + n, idempotency_key: 'seed-pay-' + String(n).padStart(4, '0'), occurred_on, amount_cents: rand('32000'), source: 'Salary Acme Logistics', account: MAIN, created_at: occurred_on + 'T06:00:00.000Z' });
  };
  const spend = (occurred_on: string, amount: string, category_id: string, merchant_name: string) => {
    n += 1;
    stores.expenses.insert({
      id: 'exp_seed_' + n, idempotency_key: 'seed-key-' + String(n).padStart(4, '0'), occurred_on, amount_cents: rand(amount), currency: 'ZAR',
      merchant_name, merchant_key: merchantKey(merchant_name), category_id, note: null, account: 'main', created_at: occurred_on + 'T10:00:00.000Z',
    });
  };
  paid('2025-10-25');
  spend('2025-11-01', '13649', 'rent', 'Cityview Rentals');
  spend('2025-11-05', '7000', 'groceries', 'Greenleaf Market');
  spend('2025-11-08', '1500', 'eating-out', 'Tidewater Grill');
  paid('2025-11-25');
  spend('2025-12-01', '13649', 'rent', 'Cityview Rentals');
  spend('2025-12-05', '10551', 'groceries', 'Greenleaf Market');
  spend('2025-12-09', '1800', 'entertainment', 'Page and Quill Books');
  spend('2026-01-05', '900', 'groceries', 'Greenleaf Market'); // the cycle 2025-12-25: an expense, and no income row
  paid('2026-01-25');
  // The first days of the cycle 2026-01-25. These rows do not change the plan; they are what the weeks and the analysis show.
  spend('2026-01-26', '6000', 'savings', 'Savings Pocket');
  spend('2026-01-27', '1240.50', 'groceries', 'Greenleaf Market');
  spend('2026-01-29', '185', 'eating-out', 'Corner Cafe');
  spend('2026-01-31', '329.95', 'entertainment', 'Page and Quill Books');
  spend('2026-02-01', '9500', 'rent', 'Cityview Rentals');
  spend('2026-02-02', '950', 'transport', 'Metro Fuel Stop');
}

/** A new world for one scenario. */
export async function makeWorld(options: WorldOptions = {}): Promise<World> {
  const fault = options.fault ?? 'none';
  const today = options.today ?? TODAY;
  const db = openDatabase(':memory:');
  const stores = sqliteStores(db);
  seed(stores, today.slice(0, 7));
  if (options.ledger === 'worked_example') workedExampleLedger(stores);
  const insert = stores.expenses.insert;
  let calls = 0;
  if (fault !== 'none') {
    stores.expenses.insert = (expense: Expense) => {
      calls += 1;
      if (fault === 'save_always_fails' || (fault === 'save_fails_once' && calls === 1)) throw new StorageUnavailable('fault of the scenario');
      insert(fault === 'save_wrong_cents' ? { ...expense, amount_cents: expense.amount_cents + 100 } : expense);
    };
  }
  const memory = options.memory ? sqliteMerchantMemory(db) : undefined;
  for (const [name, category_id] of options.remembered ?? []) memory?.remember(merchantKey(name), category_id, '2026-03-01', 'run_seed');
  const suggester = options.ai && options.ai !== 'off' ? fakeSuggester(options.ai, options.latencyMs) : undefined;
  const interpreter = options.interpreter && options.interpreter !== 'off' ? fakeInterpreter(options.interpreter) : undefined;
  const app: App = {
    stores, clock: fixedClock(today), ids: sequentialIds(), trace: memoryTrace(), ledger: sqliteLedgerReader(db), sleep: async () => {},
    memory, suggester, dailyCap: options.dailyCap, batches: memoryImportStore(), importBudget: options.importBudget,
    interpreter, assistStore: sqliteAssistStore(db),
  };
  const server = createHttpServer(app);
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  const count = (table: string) => Number((db.prepare('SELECT COUNT(*) AS n FROM ' + table).get() as { n: number }).n);
  return {
    app,
    base: 'http://127.0.0.1:' + (server.address() as AddressInfo).port,
    rows: () => count('expenses'),
    incomeRows: () => count('income'),
    memoryRows: () => count('merchant_memory'),
    modelCalls: () => (suggester?.calls.length ?? 0) + (interpreter?.calls.length ?? 0),
    close: async () => {
      await new Promise((done) => server.close(done));
      db.close();
    },
  };
}

export type Exchange = { status: number; body: any };

/** One request to the real server. A GET has no body. */
export async function call(world: World, method: 'GET' | 'POST', path: string, body?: unknown): Promise<Exchange> {
  const response = await fetch(world.base + path, method === 'GET' ? {} : { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { status: response.status, body: await response.json() };
}

export const send = (world: World, path: string, body: unknown): Promise<Exchange> => call(world, 'POST', path, body);
