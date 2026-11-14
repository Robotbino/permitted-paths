// The client of the API. This is the only file of the web application that calls fetch.
// The types come from shared/contracts.ts, the same file that the server uses.
import type { ApiError, Category, MonthSummary, Problem, RecordExpenseRequest, RecordExpenseResult } from '../../shared/contracts.ts';
import type { DecideRequest, ImportProposal, ImportResult, MappingNeeded } from '../../shared/contracts.import.ts';
import type { SuggestResponse } from '../../shared/contracts.suggest.ts';

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

/** Level 3. Asks for a suggestion. It never records anything. A failure is "no suggestion", not an error for the person. */
export const postSuggest = (merchant_name: string) =>
  call<SuggestResponse>('/api/expenses/suggest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ merchant_name }) });

/** Level 3. The steps of an import: the proposal (or the answer "a mapping is necessary"), the mapping, then the decisions of the person. */
const json = (body: unknown): RequestInit => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
export const postImport = (csv: string, account: string) => call<ImportProposal | MappingNeeded>('/api/imports', json({ csv, account }));
export const postMapping = (batch_id: string, mapping: unknown) => call<ImportProposal | MappingNeeded>('/api/imports/' + batch_id + '/mapping', json({ mapping }));
export const postDecisions = (batch_id: string, decisions: DecideRequest['decisions'], export_profile: string) =>
  call<ImportResult>('/api/imports/' + batch_id + '/decide', json({ decisions, export_profile }));
