// The handlers: one small function for each operation of the API.
// A handler changes an HTTP request into a call of a service, and the result into a reply.
// It contains no business rule.
import { periodOf } from '../domain/expense.ts';
import { AppError } from '../errors.ts';
import { ledgerReaderFromStores } from '../graph/verifier.ts';
import { decideImport, startImport, type ImportDeps } from '../import/import.graph.ts';
import { recordWorker, suggestWorker, type ImportStore } from '../import/line-worker.ts';
import { modelBudget, type ModelBudget } from '../intelligence/model-budget.ts';
import { suggestCategory, type SuggestDeps } from '../intelligence/suggest-category.graph.ts';
import { monthSummary } from '../services/month-summary.ts';
import { recordExpense, type RecordExpenseDeps } from '../services/record-expense.ts';

/** All that the handlers can use. main.ts makes it one time. */
export type App = RecordExpenseDeps & Pick<SuggestDeps, 'suggester'> & { dailyCap?: number; budget?: ModelBudget; batches?: ImportStore; importBudget?: number };

/** The one budget of model calls of the application. It is made at the first use. */
function budgetOf(app: App): ModelBudget {
  const trace = app.trace;
  return (app.budget ??= modelBudget(app.dailyCap ?? 50, app.clock, trace ? (day) => trace.countSteps('ask_model', day) : undefined));
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

  // Level 4. Import a statement, in two steps. Step 1 proposes; step 2 records what the person decided.
  { method: 'POST', path: '/api/imports', handle: async (app, request) => ({ status: 200, body: await startImport(importDeps(app), request.body) }) },
  {
    method: 'POST',
    path: /^\/api\/imports\/([\w-]+)\/decide$/,
    handle: async (app, request) => ({ status: 200, body: await decideImport(importDeps(app), request.params[0]!, request.body) }),
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

/** Level 4. The ports of the import orchestrator, made from the parts of the application. */
function importDeps(app: App): ImportDeps {
  if (!app.batches) throw new AppError('NOT_FOUND');
  const suggestDeps = suggestDepsOf(app);
  return {
    clock: app.clock, ids: app.ids, trace: app.trace, batches: app.batches,
    ledger: app.ledger ?? ledgerReaderFromStores(app.stores),
    knows: (merchant_key) => app.memory?.recall(merchant_key) != null,
    suggestLine: (merchant_name, withModel, parent) => suggestWorker(suggestDeps, merchant_name, withModel, parent),
    recordLine: (line, category_id, key, suggest_run_id, parent) => recordWorker(app, line, category_id, key, suggest_run_id, parent),
    // One import gets 20 model calls at most, and not more than what is left of the day. The calls are reserved now.
    reserveModelCalls: (n) => (app.suggester ? budgetOf(app).reserve(Math.min(n, app.importBudget ?? 20)) : 0),
  };
}
