// Named scenarios. Each scenario is a small world, a request, and the result that we expect:
// the HTTP status and the path through the execution graph.
// Two things use this file: the path tests, and the recorder that makes recordings/runs.json
// for the course page. The page replays what the real code did; it has no second implementation.
// This file has the scenarios of the record graph and the suggest graph. The import scenarios are
// in scenarios.import.ts; the assist and plan scenarios are in scenarios.assist.ts.
import type { RunRecord } from '../server/graph/trace.ts';
import { ASSIST_SCENARIOS } from './scenarios.assist.ts';
import { IMPORT_SCENARIOS } from './scenarios.import.ts';
import { call, makeWorld, send, TODAY, type Exchange, type Fault, type World, type WorldOptions } from './world.ts';

export { makeWorld, send, TODAY, type Exchange, type Fault, type World, type WorldOptions } from './world.ts';

const base = { amount_cents: 18500, currency: 'ZAR', occurred_on: TODAY, merchant_name: 'Woolworths', category_id: 'groceries' };

/** One request of a scenario. */
export type Step = { path: string; body: unknown };

export type Scenario = {
  id: string;
  level: number;
  title: string;
  world: WorldOptions;
  /** Absent: POST. A GET has no body, and its `request` is null. */
  method?: 'GET';
  endpoint: string;
  /** A second request that is made from the answer of the first (the decisions of the person, a mapping, an approval). */
  follow?: (first: any) => Step;
  /** Work that makes the world ready, with more than one request. `text` says in words what the world then has. */
  prepare?: { text: string; run(world: World): Promise<void> };
  /** Requests that go in before the request of the scenario, to the same endpoint. */
  before: unknown[];
  request: unknown;
  expect: {
    status: number;
    /** The path of the last run. Empty: the request runs no graph. */
    path: string[];
    /** The expense rows in the ledger at the end. */
    rows: number;
    reason?: string;
    /** The field "status" of the last answer (the assist path). */
    answer?: string;
    /** The first of two requests. */
    first?: { status: number; path: string[]; answer?: string };
  };
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
  ...IMPORT_SCENARIOS,
  ...ASSIST_SCENARIOS,
];

/** One request and its answer, as the recording keeps it. */
export type Recorded = { method: 'GET' | 'POST'; path: string; body: unknown; status: number; response: any };

export type ScenarioResult = {
  http: Exchange; run: RunRecord | null; rows: number; income_rows: number; memory_rows: number; model_calls: number;
  first?: { http: Exchange; run: RunRecord | null };
  /** Each request of the scenario, in order. The requests of `prepare` and `before` are not here. */
  exchanges: Recorded[];
};

export async function runScenario(scenario: Scenario): Promise<ScenarioResult> {
  const world = await makeWorld(scenario.world);
  try {
    await scenario.prepare?.run(world);
    for (const earlier of scenario.before) await send(world, scenario.endpoint, earlier);
    const before = { memory: world.memoryRows(), calls: world.modelCalls() };
    const exchanges: Recorded[] = [];
    const ask = async (method: 'GET' | 'POST', path: string, body: unknown): Promise<Exchange> => {
      const answer = await call(world, method, path, body);
      exchanges.push({ method, path, body: method === 'GET' ? null : body, status: answer.status, response: answer.body });
      return answer;
    };
    let http = await ask(scenario.method ?? 'POST', scenario.endpoint, scenario.request);
    const runOf = (x: Exchange) => {
      const id: string | undefined = x.body.run_id ?? x.body.error?.run_id;
      return id ? (world.app.trace?.get(id) ?? null) : null;
    };
    let first: ScenarioResult['first'];
    if (scenario.follow) {
      first = { http, run: runOf(http) };
      const next = scenario.follow(http.body);
      http = await ask('POST', next.path, next.body);
    }
    return { http, first, run: runOf(http), rows: world.rows(), income_rows: world.incomeRows(), memory_rows: world.memoryRows() - before.memory, model_calls: world.modelCalls() - before.calls, exchanges };
  } finally {
    await world.close();
  }
}
