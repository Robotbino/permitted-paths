// The client of the API. This is the only file of the web application that calls fetch.
// The types come from shared/contracts.ts, the same file that the server uses.
import type { ApiError, Category, MonthSummary, Problem, RecordExpenseRequest, RecordExpenseResult } from '../../shared/contracts.ts';

export type ApiResult<T> = { ok: true; value: T } | { ok: false; status: number; code: string; problems: Problem[] };

async function call<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  let response: Response;
  try {
    response = await fetch(path, init);
  } catch {
    return { ok: false, status: 0, code: 'NETWORK', problems: [{ rule: 'NET', text: 'The server did not answer. Your expense is not lost: try again.' }] };
  }
  const body: unknown = await response.json().catch(() => null);
  if (response.ok) return { ok: true, value: body as T };
  const error = (body as ApiError | null)?.error;
  return {
    ok: false,
    status: response.status,
    code: error?.code ?? 'INTERNAL',
    problems: error?.problems.length ? error.problems : [{ rule: 'HTTP', text: 'The server gave the status ' + response.status + '.' }],
  };
}

export const getCategories = () => call<Category[]>('/api/categories');
export const getSummary = (period: string) => call<MonthSummary>('/api/summary?period=' + period);
export const postExpense = (request: RecordExpenseRequest) =>
  call<RecordExpenseResult>('/api/expenses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request) });
