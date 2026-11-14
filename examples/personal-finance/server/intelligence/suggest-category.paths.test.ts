// Path tests of the suggest graph, and the structural rules of level 3:
// a suggestion never writes, a known merchant never calls the model, a failed model never fails the application.
import { describe, expect, test } from 'vitest';
import { SCENARIOS, makeWorld, runScenario, send } from '../../scripts/scenarios.ts';
import { describeGraph } from '../graph/engine.ts';
import { suggestCategoryGraph } from './suggest-category.graph.ts';

const suggests = SCENARIOS.filter((s) => s.endpoint === '/api/expenses/suggest');

describe.each(suggests)('scenario $id', (scenario) => {
  test(scenario.title, async () => {
    const { http, run, rows, memory_rows } = await runScenario(scenario);
    expect(http.status).toBe(200); // "no suggestion" is a normal answer
    expect(http.body.reason).toBe(scenario.expect.reason);
    expect(run?.events.map((e) => e.node)).toEqual(scenario.expect.path);
    expect([rows, memory_rows]).toEqual([0, 0]); // R13: a suggestion changes nothing
  });
});

test('a suggestion is shown only for the two reasons that have one', async () => {
  for (const scenario of suggests) {
    const { http } = await runScenario(scenario);
    expect(http.body.suggestion !== null, scenario.id).toBe(['FROM_MEMORY', 'FROM_MODEL'].includes(http.body.reason));
  }
});

test('a merchant that the memory knows makes zero model calls', async () => {
  expect((await runScenario(suggests.find((s) => s.id === 'suggest_from_memory')!)).model_calls).toBe(0);
  expect((await runScenario(suggests.find((s) => s.id === 'suggest_from_model')!)).model_calls).toBe(1);
});

test('the model gets the merchant text and the active categories, and nothing more', async () => {
  const world = await makeWorld({ memory: true, ai: 'answer' });
  try {
    await send(world, '/api/expenses', { idempotency_key: 'key-0001', amount_cents: 99900, currency: 'ZAR', occurred_on: '2026-03-14', merchant_name: 'Makro', category_id: 'groceries' });
    await send(world, '/api/expenses/suggest', { merchant_name: 'Engen Garage' });
    const call = (world.app.suggester as unknown as { calls: unknown[] }).calls[0];
    expect(Object.keys(call as object).sort()).toEqual(['categories', 'merchant_name']);
    expect(JSON.stringify(call)).not.toMatch(/99900|Makro|gym/); // no amount, no history, no inactive category
  } finally {
    await world.close();
  }
});

test('the daily limit: the second unknown merchant gets no model call', async () => {
  const { http, model_calls } = await runScenario(suggests.find((s) => s.id === 'suggest_daily_cap')!);
  expect([http.body.reason, model_calls]).toEqual(['DAILY_CAP', 0]);
});

test('a suggester that throws is still only "no suggestion"', async () => {
  const world = await makeWorld({ memory: true, ai: 'throw' });
  try {
    const { status, body } = await send(world, '/api/expenses/suggest', { merchant_name: 'Engen Garage' });
    expect([status, body.suggestion, body.reason]).toEqual([200, null, 'MODEL_UNAVAILABLE']);
  } finally {
    await world.close();
  }
});

test('a wrong shape is refused before the memory or the model', async () => {
  const world = await makeWorld({ memory: true, ai: 'answer' });
  try {
    expect((await send(world, '/api/expenses/suggest', { merchant_name: 'Engen', amount_cents: 5 })).status).toBe(400);
    expect(world.modelCalls()).toBe(0);
  } finally {
    await world.close();
  }
});

test('the learning loop: suggest, the person records, the next suggestion comes from the memory, and the trace connects the runs', async () => {
  const world = await makeWorld({ memory: true, ai: 'answer' });
  try {
    const first = await send(world, '/api/expenses/suggest', { merchant_name: 'Engen Garage' });
    expect(first.body).toMatchObject({ suggestion: { category_id: 'transport', source: 'model' } });
    // The person does not agree with the model and selects a different category.
    const recorded = await send(world, '/api/expenses', { idempotency_key: 'key-0001', amount_cents: 65000, currency: 'ZAR', occurred_on: '2026-03-14', merchant_name: 'Engen Garage', category_id: 'eating-out', suggest_run_id: first.body.run_id });
    expect(recorded.status).toBe(201);
    const second = await send(world, '/api/expenses/suggest', { merchant_name: 'ENGEN  garage' });
    expect(second.body).toMatchObject({ suggestion: { category_id: 'eating-out', source: 'memory' }, reason: 'FROM_MEMORY' });
    expect(world.modelCalls()).toBe(1);
    expect(world.app.trace!.get(recorded.body.run_id)!.parent_run_id).toBe(first.body.run_id);
  } finally {
    await world.close();
  }
});

test('the suggest graph has one model node, and no node that owns a field of the ledger', () => {
  const graph = describeGraph(suggestCategoryGraph);
  expect(graph.nodes.filter((n) => n.type === 'model').map((n) => n.id)).toEqual(['ask_model']);
  expect(graph.nodes.flatMap((n) => n.owns).sort()).toEqual(['allowance', 'gate1_problems', 'merchant', 'model_output', 'recall', 'rejection', 'response', 'verdict']);
});
