// The handlers: one small function for each operation of the API.
// A handler changes an HTTP request into a call of a service, and the result into a reply.
// It contains no business rule.
import { periodOf } from '../domain/expense.ts';
import { AppError } from '../errors.ts';
import { ledgerReaderFromStores } from '../graph/verifier.ts';
import { decideImport, startImport, type ImportDeps } from '../import/import.graph.ts';
import { recordWorker, suggestWorker, type ImportStore } from '../import/line-worker.ts';
import { suggestCategory, type SuggestDeps } from '../intelligence/suggest-category.graph.ts';
import { monthSummary } from '../services/month-summary.ts';
import { recordExpense, type RecordExpenseDeps } from '../services/record-expense.ts';

/** All that the handlers can use. main.ts makes it one time. */
export type App = RecordExpenseDeps & Pick<SuggestDeps, 'suggester'> & { dailyCap?: number; batches?: ImportStore; importBudget?: number };

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

  // Level 3. A suggestion for the category. This handler gives the graph a function that lists the
  // categories, the memory and the suggester. It gives no store that can write, thus the suggest
  // graph cannot change the ledger. The answer is 200 also when there is no suggestion.
  {
    method: 'POST',
    path: '/api/expenses/suggest',
    async handle(app, request) {
      const body = await suggestCategory(
        { listCategories: () => app.stores.categories.list(), clock: app.clock, ids: app.ids, memory: app.memory, suggester: app.suggester, trace: app.trace, dailyCap: app.dailyCap ?? 50 },
        request.body,
      );
      return { status: 200, body };
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
  const suggestDeps = { listCategories: () => app.stores.categories.list(), clock: app.clock, ids: app.ids, memory: app.memory, suggester: app.suggester, trace: app.trace, dailyCap: app.dailyCap ?? 50 };
  // The budget of one import: not more than 20 model calls, and not more than what is left of the day.
  const usedToday = app.trace ? app.trace.countSteps('ask_model', app.clock.now().slice(0, 10)) : suggestDeps.dailyCap;
  return {
    clock: app.clock, ids: app.ids, trace: app.trace, batches: app.batches,
    ledger: app.ledger ?? ledgerReaderFromStores(app.stores),
    knows: (merchant_key) => app.memory?.recall(merchant_key) != null,
    suggestLine: (merchant_name, withModel, parent) => suggestWorker(suggestDeps, merchant_name, withModel, parent),
    recordLine: (line, category_id, key, suggest_run_id, parent) => recordWorker(app, line, category_id, key, suggest_run_id, parent),
    modelBudget: app.suggester ? Math.max(0, Math.min(app.importBudget ?? 20, suggestDeps.dailyCap - usedToday)) : 0,
  };
}
