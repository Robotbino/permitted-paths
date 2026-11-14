// The trace: the history of the runs. Tested on the two stores, and through the API.
import { describe, expect, test, vi } from 'vitest';
import { makeWorld, send } from '../../scripts/scenarios.ts';
import { fixedClock, sequentialIds } from '../clock.ts';
import { memoryStores } from '../repositories/memory.ts';
import { seed } from '../repositories/seed.ts';
import { openDatabase } from '../repositories/sqlite.ts';
import { recordExpense } from '../services/record-expense.ts';
import { memoryTrace, sqliteTrace, type TraceStore } from './trace.ts';

const request = { idempotency_key: 'key-0001', amount_cents: 18500, currency: 'ZAR', occurred_on: '2026-03-14', merchant_name: 'Woolworths', category_id: 'groceries' };
function deps(trace: TraceStore) {
  const stores = memoryStores();
  seed(stores, '2026-03');
  return { stores, clock: fixedClock('2026-03-14'), ids: sequentialIds(), trace, sleep: async () => {} };
}

describe.each([['memory', () => memoryTrace()], ['sqlite', () => sqliteTrace(openDatabase(':memory:'))]] as Array<[string, () => TraceStore]>)('the trace store: %s', (_name, make) => {
  test('a run goes in and comes out the same, with a sequence that has no hole', async () => {
    const trace = make();
    const result = await recordExpense(deps(trace), request);
    const run = trace.get(result.run_id!)!;
    expect(run).toMatchObject({ id: 'run_0001', graph: 'record-expense', result: 'PASS', subject_id: 'exp_0001', parent_run_id: null });
    expect(run.events.map((e) => e.seq)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(run.events[0]).toMatchObject({ node: 'gate1', type: 'code', result: 'PASS', edge: 'gate1>dedupe' });
  });

  test('the checkpoint of the last step is the final state', async () => {
    const trace = make();
    const result = await recordExpense(deps(trace), request);
    const last = trace.get(result.run_id!)!.events.at(-1)!.state_after as { response: unknown; budget_after: unknown };
    expect(last.response).toEqual(result);
    expect(last.budget_after).toEqual(result.budget);
  });

  test('a refused request has a trace too: the trace says what did not happen', async () => {
    const trace = make();
    await expect(recordExpense(deps(trace), { ...request, category_id: 'gym' })).rejects.toThrow('RULE');
    const run = trace.get('run_0001')!;
    expect([run.result, run.subject_id]).toEqual(['FAIL', null]);
    expect(run.events.at(-1)).toMatchObject({ node: 'reject', result: 'FAIL', edge: null });
  });

  test('the runs of one expense: the record, then the replay', async () => {
    const trace = make();
    const d = deps(trace);
    await recordExpense(d, request);
    await recordExpense(d, request);
    expect(trace.forSubject('exp_0001').map((r) => r.events.map((e) => e.node).join(' '))).toEqual(['gate1 dedupe load_facts gate2 commit project verify respond', 'gate1 dedupe respond']);
  });
});

test('a trace store that fails does not fail the expense', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const broken: TraceStore = { save: () => { throw new Error('disk full'); }, get: () => null, forSubject: () => [], countSteps: () => 0 };
  const d = deps(broken);
  const result = await recordExpense(d, request);
  expect(result.expense.id).toBe('exp_0001');
  expect(d.stores.expenses.findByKey('key-0001')).not.toBeNull();
  expect(warn).toHaveBeenCalledOnce();
  warn.mockRestore();
});

test('GET /api/runs/<id> gives the trace of the run that the response names', async () => {
  const world = await makeWorld();
  try {
    const created = await send(world, '/api/expenses', request);
    const run = (await (await fetch(world.base + '/api/runs/' + created.body.run_id)).json()) as { events: { node: string }[] };
    expect(run.events.map((e) => e.node).at(-1)).toBe('respond');
    expect((await fetch(world.base + '/api/runs/run_9999')).status).toBe(404);
  } finally {
    await world.close();
  }
});
