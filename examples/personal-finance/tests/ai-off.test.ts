// The application must work without the AI. This file runs the scenarios of level 2 again,
// in three worlds: no model, a model that times out, and a model that throws.
// The result of each scenario must be the same as in the world of level 2.
import { describe, expect, test } from 'vitest';
import { SCENARIOS, makeWorld, runScenario, send, type WorldOptions } from '../scripts/scenarios.ts';

const level2 = SCENARIOS.filter((s) => s.level === 2);
const worlds: Array<[string, WorldOptions]> = [
  ['no model (AI off)', { memory: true, ai: 'off' }],
  ['a model that times out', { memory: true, ai: 'timeout' }],
  ['a model that throws', { memory: true, ai: 'throw' }],
];

describe.each(worlds)('record an expense with %s', (_name, world) => {
  test('each scenario of level 2 gives the same status, the same rows, and never calls the model', async () => {
    for (const scenario of level2) {
      const result = await runScenario({ ...scenario, world: { ...scenario.world, ...world } });
      expect(result.http.status, scenario.id).toBe(scenario.expect.status);
      expect(result.rows, scenario.id).toBe(scenario.expect.rows);
      expect(result.model_calls, scenario.id).toBe(0); // the record graph has no model node
      // The only difference in the path: the node `remember`, after a verified save.
      expect(result.run!.events.map((e) => e.node).filter((n) => n !== 'remember'), scenario.id).toEqual(scenario.expect.path);
    }
  });

  test('the person can record an expense when the suggestion gives nothing', async () => {
    const w = await makeWorld(world);
    try {
      const suggestion = await send(w, '/api/expenses/suggest', { merchant_name: 'Engen Garage' });
      expect([suggestion.status, suggestion.body.suggestion]).toEqual([200, null]);
      const recorded = await send(w, '/api/expenses', { idempotency_key: 'key-0001', amount_cents: 65000, currency: 'ZAR', occurred_on: '2026-03-14', merchant_name: 'Engen Garage', category_id: 'transport' });
      expect(recorded.status).toBe(201);
    } finally {
      await w.close();
    }
  });
});

test('with the AI off, the memory still gives suggestions', async () => {
  const w = await makeWorld({ memory: true, ai: 'off', remembered: [['Woolworths', 'groceries']] });
  try {
    expect((await send(w, '/api/expenses/suggest', { merchant_name: 'Woolworths' })).body).toMatchObject({ suggestion: { category_id: 'groceries', source: 'memory' } });
  } finally {
    await w.close();
  }
});

test('a memory that fails does not fail the expense', async () => {
  const w = await makeWorld({ memory: true, ai: 'off' });
  try {
    w.app.memory!.remember = () => { throw new Error('disk'); };
    const recorded = await send(w, '/api/expenses', { idempotency_key: 'key-0001', amount_cents: 65000, currency: 'ZAR', occurred_on: '2026-03-14', merchant_name: 'Engen Garage', category_id: 'transport' });
    expect(recorded.status).toBe(201);
    expect(w.app.trace!.get(recorded.body.run_id)!.events.find((e) => e.node === 'remember')).toMatchObject({ result: 'FAIL' });
  } finally {
    await w.close();
  }
});
