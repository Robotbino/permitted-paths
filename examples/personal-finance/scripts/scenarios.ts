// Named scenarios. Each scenario is a small world, a request, and the result that we expect:
// the HTTP status and the path through the execution graph.
// Two things use this file: the path tests, and the recorder that makes recordings/runs.json
// for the course page. The page replays what the real code did; it has no second implementation.
import { readFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Expense } from '../shared/contracts.ts';
import { fixedClock, sequentialIds } from '../server/clock.ts';
import { merchantKey } from '../server/domain/expense.ts';
import { StorageUnavailable } from '../server/errors.ts';
import { memoryTrace, type RunRecord } from '../server/graph/trace.ts';
import { sqliteLedgerReader } from '../server/graph/verifier.ts';
import type { App } from '../server/http/handlers.ts';
import { createHttpServer } from '../server/http/server.ts';
import { memoryImportStore } from '../server/import/line-worker.ts';
import { fakeSuggester, type FakeBehaviour } from '../server/intelligence/fake-suggester.ts';
import { sqliteMerchantMemory } from '../server/intelligence/merchant-memory.ts';
import { seed } from '../server/repositories/seed.ts';
import { openDatabase, sqliteStores } from '../server/repositories/sqlite.ts';

export const TODAY = '2026-03-14';
export const STATEMENT = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'statement-march.csv'), 'utf8').replace(/\r\n/g, '\n');
const base = { amount_cents: 18500, currency: 'ZAR', occurred_on: TODAY, merchant_name: 'Woolworths', category_id: 'groceries' };

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
  /** Level 4: the largest number of model calls for one import. */
  importBudget?: number;
};

export type Scenario = {
  id: string;
  level: number;
  title: string;
  world: WorldOptions;
  endpoint: '/api/expenses' | '/api/expenses/suggest' | '/api/imports';
  /** Level 4: a second request that is made from the answer of the first (the decisions of the person). */
  follow?: (first: any) => { path: string; body: unknown };
  /** Requests that go in before the request of the scenario, to the same endpoint. */
  before: unknown[];
  request: unknown;
  expect: { status: number; path: string[]; rows: number; reason?: string };
};

const OK_PATH = ['gate1', 'dedupe', 'load_facts', 'gate2', 'commit', 'project', 'verify', 'respond'];
const record = (s: Omit<Scenario, 'level' | 'endpoint' | 'world' | 'before'> & { fault?: Fault; before?: unknown[] }): Scenario => ({
  level: 2, endpoint: '/api/expenses', world: { fault: s.fault ?? 'none' }, before: s.before ?? [], id: s.id, title: s.title, request: s.request, expect: s.expect,
});
const suggest = (id: string, title: string, world: WorldOptions, merchant_name: string, path: string[], reason: string, before: unknown[] = []): Scenario => ({
  id, level: 3, title, world: { memory: true, ...world }, endpoint: '/api/expenses/suggest', before, request: { merchant_name }, expect: { status: 200, path, rows: 0, reason },
});

export const SCENARIOS: Scenario[] = [
  // Level 2: the record graph.
  record({ id: 'valid', title: 'A correct expense: R185.00 at Woolworths', request: { ...base, idempotency_key: 'key-valid-1' }, expect: { status: 201, path: OK_PATH, rows: 1 } }),
  record({ id: 'bad_shape', title: 'The amount is 185.5: not an integer number of cents', request: { ...base, idempotency_key: 'key-shape-1', amount_cents: 185.5 }, expect: { status: 400, path: ['gate1', 'reject'], rows: 0 } }),
  record({ id: 'inactive_category', title: 'The category "Gym (closed)" is not active', request: { ...base, idempotency_key: 'key-rule-1', merchant_name: 'Virgin Active', category_id: 'gym' }, expect: { status: 422, path: ['gate1', 'dedupe', 'load_facts', 'gate2', 'reject'], rows: 0 } }),
  record({ id: 'over_budget', title: 'R4 600.00 of groceries, with a budget of R4 500.00', request: { ...base, idempotency_key: 'key-over-1', amount_cents: 460_000, merchant_name: 'Makro' }, expect: { status: 201, path: OK_PATH, rows: 1 } }),
  record({ id: 'duplicate_submit', title: 'The same request arrives a second time (the phone lost the first answer)', before: [{ ...base, idempotency_key: 'key-dup-1' }], request: { ...base, idempotency_key: 'key-dup-1' }, expect: { status: 200, path: ['gate1', 'dedupe', 'respond'], rows: 1 } }),
  record({ id: 'similar_expense', title: 'A new request with the same date, amount and merchant', before: [{ ...base, idempotency_key: 'key-sim-1' }], request: { ...base, idempotency_key: 'key-sim-2' }, expect: { status: 409, path: ['gate1', 'dedupe', 'load_facts', 'gate2', 'reject'], rows: 1 } }),
  record({ id: 'save_fails_once', title: 'The store fails one time during the save', fault: 'save_fails_once', request: { ...base, idempotency_key: 'key-retry-1' }, expect: { status: 201, path: ['gate1', 'dedupe', 'load_facts', 'gate2', 'commit', 'backoff', 'commit', 'project', 'verify', 'respond'], rows: 1 } }),
  record({ id: 'store_down', title: 'The store fails each time during the save', fault: 'save_always_fails', request: { ...base, idempotency_key: 'key-down-1' }, expect: { status: 503, path: ['gate1', 'dedupe', 'load_facts', 'gate2', 'commit', 'backoff', 'commit', 'escalate'], rows: 0 } }),
  record({ id: 'ledger_mismatch', title: 'A defect saves R186.00, not R185.00', fault: 'save_wrong_cents', request: { ...base, idempotency_key: 'key-wrong-1' }, expect: { status: 500, path: ['gate1', 'dedupe', 'load_facts', 'gate2', 'commit', 'project', 'verify', 'escalate'], rows: 1 } }),

  // Level 3: the suggest graph. The model is a stand-in, thus the recordings need no network and no key.
  suggest('suggest_from_model', 'A merchant that the memory does not know: Engen Garage', { ai: 'answer' }, 'Engen Garage', ['gate1', 'recall', 'allow', 'ask_model', 'suggestion_gate', 'respond'], 'FROM_MODEL'),
  suggest('suggest_from_memory', 'A merchant that the person categorised before: Woolworths', { ai: 'answer', remembered: [['Woolworths', 'groceries']] }, 'woolworths', ['gate1', 'recall', 'suggestion_gate', 'respond'], 'FROM_MEMORY'),
  suggest('suggest_ai_off', 'The AI is off: the server has no API key', { ai: 'off' }, 'Engen Garage', ['gate1', 'recall', 'allow', 'respond'], 'AI_OFF'),
  suggest('suggest_model_down', 'The model does not answer in the permitted time', { ai: 'timeout' }, 'Engen Garage', ['gate1', 'recall', 'allow', 'ask_model', 'respond'], 'MODEL_UNAVAILABLE'),
  suggest('suggest_not_permitted', 'The model answers with a category that does not exist', { ai: 'not_permitted' }, 'Engen Garage', ['gate1', 'recall', 'allow', 'ask_model', 'suggestion_gate', 'respond'], 'NOT_PERMITTED'),
  suggest('suggest_unknown', 'The model does not know the merchant', { ai: 'answer' }, 'Zzyx Trading 4471', ['gate1', 'recall', 'allow', 'ask_model', 'suggestion_gate', 'respond'], 'MODEL_DOES_NOT_KNOW'),
  suggest('suggest_daily_cap', 'The daily limit of model calls is used', { ai: 'answer', dailyCap: 1 }, 'Shell Sandton', ['gate1', 'recall', 'allow', 'respond'], 'DAILY_CAP', [{ merchant_name: 'Engen Garage' }]),
  suggest('suggest_memory_inactive', 'The memory names a category that is not active now', { ai: 'answer', remembered: [['Virgin Active', 'gym']] }, 'Virgin Active', ['gate1', 'recall', 'suggestion_gate', 'respond'], 'NOT_PERMITTED'),
  { id: 'record_with_memory', level: 3, title: 'A correct expense, in an application that has a memory', world: { memory: true, ai: 'answer' }, endpoint: '/api/expenses', before: [],
    request: { ...base, idempotency_key: 'key-memory-1', merchant_name: 'Engen Garage', category_id: 'transport' }, expect: { status: 201, path: ['gate1', 'dedupe', 'load_facts', 'gate2', 'commit', 'project', 'verify', 'remember', 'respond'], rows: 1 } },
  // Level 4: the import graph. Two requests: the proposal, then the decisions of the person.
  { id: 'import_statement', level: 4, title: 'Import a statement of 14 lines; the person accepts each suggestion', world: { memory: true, ai: 'answer', remembered: [['Woolworths', 'groceries']], importBudget: 4 },
    endpoint: '/api/imports', before: [], request: { csv: STATEMENT },
    follow: (first) => ({ path: '/api/imports/' + first.batch_id + '/decide', body: { decisions: first.lines.map((l: any) => ({ line_no: l.line_no, category_id: l.suggestion?.category_id ?? null })) } }),
    expect: { status: 200, path: ['await_person', 'apply', 'reconcile', 'respond'], rows: 6 } },
];

export type World = { app: App; base: string; rows(): number; memoryRows(): number; modelCalls(): number; close(): Promise<void> };

/** A new world for one scenario: SQLite in memory, a fixed clock, sequential ids, no real wait, a real HTTP server. */
export async function makeWorld(options: WorldOptions = {}): Promise<World> {
  const fault = options.fault ?? 'none';
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
  const memory = options.memory ? sqliteMerchantMemory(db) : undefined;
  for (const [name, category_id] of options.remembered ?? []) memory?.remember(merchantKey(name), category_id, '2026-03-01', 'run_seed');
  const suggester = options.ai && options.ai !== 'off' ? fakeSuggester(options.ai, options.latencyMs) : undefined;
  const app: App = {
    stores, clock: fixedClock(TODAY), ids: sequentialIds(), trace: memoryTrace(), ledger: sqliteLedgerReader(db), sleep: async () => {},
    memory, suggester, dailyCap: options.dailyCap, batches: memoryImportStore(), importBudget: options.importBudget,
  };
  const server = createHttpServer(app);
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  const count = (table: string) => Number((db.prepare('SELECT COUNT(*) AS n FROM ' + table).get() as { n: number }).n);
  return {
    app,
    base: 'http://127.0.0.1:' + (server.address() as AddressInfo).port,
    rows: () => count('expenses'),
    memoryRows: () => count('merchant_memory'),
    modelCalls: () => suggester?.calls.length ?? 0,
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

export type ScenarioResult = { http: Exchange; run: RunRecord | null; rows: number; memory_rows: number; model_calls: number; first?: { http: Exchange; run: RunRecord | null } };

export async function runScenario(scenario: Scenario): Promise<ScenarioResult> {
  const world = await makeWorld(scenario.world);
  try {
    for (const earlier of scenario.before) await send(world, scenario.endpoint, earlier);
    const before = { memory: world.memoryRows(), calls: world.modelCalls() };
    let http = await send(world, scenario.endpoint, scenario.request);
    const runOf = (x: Exchange) => {
      const id: string | undefined = x.body.run_id ?? x.body.error?.run_id;
      return id ? (world.app.trace?.get(id) ?? null) : null;
    };
    let first: ScenarioResult['first'];
    if (scenario.follow) {
      first = { http, run: runOf(http) };
      const next = scenario.follow(http.body);
      http = await send(world, next.path, next.body);
    }
    return { http, first, run: runOf(http), rows: world.rows(), memory_rows: world.memoryRows() - before.memory, model_calls: world.modelCalls() - before.calls };
  } finally {
    await world.close();
  }
}
