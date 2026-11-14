// The handlers: one small function for each operation of the API.
// A handler changes an HTTP request into a call of a service, and the result into a reply.
// It contains no business rule.
import type { Clock, IdGen } from '../clock.ts';
import { periodOf } from '../domain/expense.ts';
import type { Stores } from '../repositories/ports.ts';
import { monthSummary } from '../services/month-summary.ts';
import { recordExpense } from '../services/record-expense.ts';

/** All that the handlers can use. main.ts makes it one time. */
export type App = { stores: Stores; clock: Clock; ids: IdGen };

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
];
