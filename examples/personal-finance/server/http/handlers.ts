// The handlers: one small function for each operation of the API.
// A handler changes an HTTP request into a call of a service, and the result into a reply.
// It contains no business rule.
import { periodOf } from '../domain/expense.ts';
import { AppError } from '../errors.ts';
import { ledgerReaderFromStores } from '../graph/verifier.ts';
import { decideImport, mapImport, startImport, type ImportDeps } from '../import/import.graph.ts';
import { ledgerView } from '../import/ledger-view.ts';
import { incomeWorker, recordWorker, suggestWorker, type ImportStore } from '../import/line-worker.ts';
import { modelBudget, type ModelBudget } from '../intelligence/model-budget.ts';
import type { IntentInterpreter } from '../intelligence/permitted/interpreter.ts';
import { suggestCategory, type SuggestDeps } from '../intelligence/suggest-category.graph.ts';
import { memoryAssistStore, type AssistStore } from '../repositories/assist-store.ts';
import { assist, decide, type AssistDeps } from '../services/assist.ts';
import { monthSummary } from '../services/month-summary.ts';
import { planCycle, weeksOfCycle } from '../services/plan-cycle.ts';
import { recordExpense, type RecordExpenseDeps } from '../services/record-expense.ts';

/** All that the handlers can use. main.ts makes it one time. */
export type App = RecordExpenseDeps & Pick<SuggestDeps, 'suggester'> & {
  dailyCap?: number; budget?: ModelBudget; batches?: ImportStore; importBudget?: number;
  /** Level 3, the assist path. No interpreter: the AI is off. The store is made at the first use if main.ts gave none. */
  interpreter?: IntentInterpreter; assistStore?: AssistStore;
};

const assistStoreOf = (app: App): AssistStore => (app.assistStore ??= memoryAssistStore());

/** The one budget of model calls of the application: suggestions and the assist path use it. It is made at the first use. */
function budgetOf(app: App): ModelBudget {
  // After a start of the server, the count of the day comes from the trace (suggestions) and the audit (assist).
  return (app.budget ??= modelBudget(app.dailyCap ?? 50, app.clock, (day) => (app.trace?.countSteps('ask_model', day) ?? 0) + assistStoreOf(app).countModelCalls(day)));
}

/** What the suggest graph gets. Look at what is absent: no store of expenses, and a memory that can only read. */
function suggestDepsOf(app: App): SuggestDeps {
  const memory = app.memory;
  return {
    listCategories: () => app.stores.categories.list(),
    clock: app.clock, ids: app.ids, suggester: app.suggester, trace: app.trace, budget: budgetOf(app),
    memory: memory ? { recall: (key) => memory.recall(key) } : undefined,
  };
}

export type ApiRequest = { query: URLSearchParams; params: string[]; body: unknown };
export type Reply = { status: number; body: unknown; headers?: Record<string, string> };
export type Handler = { method: 'GET' | 'POST'; path: string | RegExp; handle(app: App, request: ApiRequest): Promise<Reply> | Reply };

export const HANDLERS: Handler[] = [
  { method: 'GET', path: '/api/health', handle: (app) => ({ status: 200, body: { ok: true, today: app.clock.today() } }) },

  { method: 'GET', path: '/api/categories', handle: (app) => ({ status: 200, body: app.stores.categories.list().filter((c) => c.active) }) },

  {
    method: 'GET',
    path: '/api/summary',
    handle: (app, request) => ({ status: 200, body: monthSummary(app.stores, request.query.get('period') ?? periodOf(app.clock.today())) }),
  },

  // The plan of the pay cycle that contains the date (without a date: today). Each figure is calculated from stored rows.
  { method: 'GET', path: '/api/plan', handle: (app, request) => ({ status: 200, body: planCycle(app, request.query.get('date') ?? undefined) }) },
  // Only the weeks of that cycle, the pace and the savings.
  { method: 'GET', path: '/api/weeks', handle: (app, request) => ({ status: 200, body: weeksOfCycle(app, request.query.get('date') ?? undefined) }) },

  {
    method: 'POST',
    path: '/api/expenses',
    async handle(app, request) {
      const result = await recordExpense(app, request.body);
      // 201: a new expense. 200: a replay of a request that already recorded its expense.
      return { status: result.replayed ? 200 : 201, body: result };
    },
  },

  // Level 3. A suggestion for the category. The graph gets a function that lists the categories,
  // a memory that can only read, the suggester and the budget (see suggestDepsOf). It gets no way
  // to write the ledger or the memory. The answer is 200 also when there is no suggestion.
  {
    method: 'POST',
    path: '/api/expenses/suggest',
    async handle(app, request) {
      return { status: 200, body: await suggestCategory(suggestDepsOf(app), request.body) };
    },
  },

  // Level 3. Import a statement, in steps. Step 1 proposes, or asks for a mapping when the layout is not known.
  // The mapping step gives the mapping. The last step records what the person decided.
  { method: 'POST', path: '/api/imports', handle: async (app, request) => ({ status: 200, body: await startImport(importDeps(app), request.body) }) },
  {
    method: 'POST',
    path: /^\/api\/imports\/([\w-]+)\/mapping$/,
    handle: async (app, request) => ({ status: 200, body: await mapImport(importDeps(app), request.params[0]!, request.body) }),
  },
  {
    method: 'POST',
    path: /^\/api\/imports\/([\w-]+)\/decide$/,
    handle: async (app, request) => ({ status: 200, body: await decideImport(importDeps(app), request.params[0]!, request.body) }),
  },

  // Level 3. The assist path. The first request asks the model and the action gate; it changes no data.
  // The second request is the decision of the person for one stored proposal. Only then the application executes.
  { method: 'POST', path: '/api/assist', handle: async (app, request) => ({ status: 200, body: await assist(assistDeps(app), request.body) }) },
  {
    method: 'POST',
    path: /^\/api\/assist\/([\w-]+)\/decide$/,
    handle: async (app, request) => ({ status: 200, body: await decide(assistDeps(app), request.params[0]!, request.body) }),
  },

  // Level 2. The trace of one run: each step, PASS or FAIL, the edge, and the state after the step.
  {
    method: 'GET',
    path: /^\/api\/runs\/([\w-]+)$/,
    handle(app, request) {
      const run = app.trace?.get(request.params[0]!);
      if (!run) throw new AppError('NOT_FOUND');
      return { status: 200, body: run };
    },
  },
];

/** Level 3. The ports of the import orchestrator, made from the parts of the application. */
function importDeps(app: App): ImportDeps {
  if (!app.batches) throw new AppError('NOT_FOUND');
  const suggestDeps = suggestDepsOf(app);
  return {
    clock: app.clock, ids: app.ids, trace: app.trace, batches: app.batches,
    ledger: app.ledger ?? ledgerReaderFromStores(app.stores),
    knows: (merchant_key) => app.memory?.recall(merchant_key) != null,
    suggestLine: (merchant_name, withModel, parent) => suggestWorker(suggestDeps, merchant_name, withModel, parent),
    recordLine: (row, category_id, key, suggest_run_id, parent, fileConfirms) => recordWorker(app, row, category_id, key, suggest_run_id, parent, fileConfirms),
    recordIncome: (row, key) => incomeWorker({ income: app.stores.income, clock: app.clock, ids: app.ids }, row, key),
    ...ledgerView(app.stores),
    // One import gets 20 model calls at most, and not more than what is left of the day. The calls are reserved now.
    reserveModelCalls: (n) => (app.suggester ? budgetOf(app).reserve(Math.min(n, app.importBudget ?? 20)) : 0),
  };
}

/** Level 3. What the assist service gets. The executors are services of the application: the suggest graph and the mapping step of the import. */
function assistDeps(app: App): AssistDeps {
  return {
    stores: app.stores, clock: app.clock, ids: app.ids, assist: assistStoreOf(app), interpreter: app.interpreter, budget: budgetOf(app), batches: app.batches,
    suggest: (merchant_name) => suggestCategory(suggestDepsOf(app), { merchant_name }),
    resumeMapping: (batch_id, mapping) => mapImport(importDeps(app), batch_id, { mapping }),
  };
}
