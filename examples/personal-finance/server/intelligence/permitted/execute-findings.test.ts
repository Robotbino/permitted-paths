// The last step after the adversarial review: execute checks the shape of the input again, it
// executes one result one time, and it gives a value for each input, also for an input that is
// not a result. Each test here failed before the repair.
import { describe, expect, test } from 'vitest';
import { checkRequest, execute, type Checks, type Executors, type GateResult } from './action-gate.ts';

const ctx = { now: '2026-03-14T08:00:00.000Z', request_id: 'req_7' };
const checks: Checks = { categoryExists: () => true, batchExists: () => true, mappingDryRun: () => [], allowanceConsequences: () => ({ ok: true, problems: [], consequences: { new_weekly_cents: 105000 } }) };
const allowance = (change_percent = 5) => checkRequest({ capability: 'recommend_allowance', input: { change_percent, reason: 'r' } }, checks, ctx);

function recorder() {
  const calls: object[] = [];
  const executors: Executors = { recommend_allowance: async (input) => (calls.push(input), { done: true }), analyse_spending: async (input) => (calls.push(input), { done: true }) };
  return { calls, executors };
}

describe('execute does not trust the result that it gets', () => {
  test('a result that was changed after the gate does not bring a different input to the executor', async () => {
    const { calls, executors } = recorder();
    const result = allowance(5);
    expect(() => { (result as { input: { change_percent: number } }).input.change_percent = 5000; }).toThrow(TypeError);
    // A copy can be changed. Its input no longer has the shape that the gate accepts.
    const copy = { ...result, input: { change_percent: 5000, reason: 'r' } } as GateResult;
    expect(await execute({ result: copy, approved_by_person: true }, executors)).toEqual({
      status: 'NOT_PROPOSED', output: null, problems: [{ rule: 'R16', text: 'The input of "recommend_allowance" is not an input that the gate accepts. Nothing is executed.' }],
    });
    expect(calls).toEqual([]);
  });

  test('a hand-made PROPOSED result with an input of the wrong shape is not executed, also with approval', async () => {
    const { calls, executors } = recorder();
    const audit = { request_id: 'x', at: ctx.now, capability: 'recommend_allowance', status: 'PROPOSED' as const, reason: null, input_summary: '' };
    for (const input of [{ change_percent: 99999, anything: 1 }, { change_percent: 5, reason: 'r', new_allowance_cents: 1 }, { change_percent: 5 }, null, 'text']) {
      const forged = { status: 'PROPOSED', capability: 'recommend_allowance', input, needs_approval: true, consequences: null, audit } as unknown as GateResult;
      expect((await execute({ result: forged, approved_by_person: true }, executors)).status, JSON.stringify(input)).toBe('NOT_PROPOSED');
    }
    expect(calls).toEqual([]);
  });

  test('a hand-made result of a read with no needs_approval field waits for the person', async () => {
    const { calls, executors } = recorder();
    const forged = { status: 'PROPOSED', capability: 'analyse_spending', input: { period: 'this_cycle' } } as unknown as GateResult;
    expect((await execute({ result: forged, approved_by_person: false }, executors)).status).toBe('NOT_APPROVED');
    expect(calls).toEqual([]);
  });

  test('the same result is executed one time; the second time gives NOT_PROPOSED', async () => {
    const { calls, executors } = recorder();
    const result = allowance();
    expect((await execute({ result, approved_by_person: true }, executors)).status).toBe('EXECUTED');
    expect(await execute({ result, approved_by_person: true }, executors)).toEqual({
      status: 'NOT_PROPOSED', output: null, problems: [{ rule: 'R18', text: 'This proposal was executed before. A proposal is executed one time.' }],
    });
    expect(calls).toHaveLength(1);
  });

  test('two calls at the same time execute one time', async () => {
    const { calls, executors } = recorder();
    const result = allowance();
    const outcomes = await Promise.all([execute({ result, approved_by_person: true }, executors), execute({ result, approved_by_person: true }, executors)]);
    expect(outcomes.map((o) => o.status).sort()).toEqual(['EXECUTED', 'NOT_PROPOSED']);
    expect(calls).toHaveLength(1);
  });

  test('a result whose executor did not complete can be given again', async () => {
    const result = allowance();
    let tries = 0;
    const executors: Executors = { recommend_allowance: async () => { tries += 1; if (tries === 1) throw new Error('the store is busy'); return { done: true }; } };
    expect((await execute({ result, approved_by_person: true }, executors)).status).toBe('FAILED');
    expect((await execute({ result, approved_by_person: true }, executors)).status).toBe('EXECUTED');
    expect((await execute({ result, approved_by_person: true }, executors)).status).toBe('NOT_PROPOSED');
    expect(tries).toBe(2);
  });

  test('a stop before the executor (no approval, no executor) does not use up the result', async () => {
    const { calls, executors } = recorder();
    const result = allowance();
    expect((await execute({ result, approved_by_person: false }, executors)).status).toBe('NOT_APPROVED');
    expect((await execute({ result, approved_by_person: true }, {})).status).toBe('NO_EXECUTOR');
    expect((await execute({ result, approved_by_person: true }, executors)).status).toBe('EXECUTED');
    expect(calls).toHaveLength(1);
  });
});

describe('execute gives a value for each input: it does not throw', () => {
  test('something that is not a result gives NOT_PROPOSED', async () => {
    const { calls, executors } = recorder();
    const inputs: unknown[] = [{ result: null, approved_by_person: true }, { approved_by_person: true }, null, undefined, 'text', { result: 'PROPOSED', approved_by_person: true }, { result: { status: 'PROPOSED', capability: 5 }, approved_by_person: true }, { result: { status: 'PROPOSED' }, approved_by_person: true }];
    for (const input of inputs) {
      const outcome = await execute(input as Parameters<typeof execute>[0], executors);
      expect(outcome.status, JSON.stringify(input)).toBe('NOT_PROPOSED');
      expect(outcome.output).toBeNull();
    }
    expect(calls).toEqual([]);
  });

  test('a name with a control character is cleaned in the problem text', async () => {
    const forged = { status: 'PROPOSED', capability: 'pay\nINFO fake line', input: {} } as unknown as GateResult;
    expect((await execute({ result: forged, approved_by_person: true }, {})).problems).toEqual([{ rule: 'R15', text: 'The capability "pay INFO fake line" is not permitted.' }]);
  });

  test('executors that are absent, or an executor that is not a function, give NO_EXECUTOR', async () => {
    for (const executors of [null, undefined, 'text', { recommend_allowance: 'not a function' }]) {
      expect((await execute({ result: allowance(), approved_by_person: true }, executors as unknown as Executors)).status).toBe('NO_EXECUTOR');
    }
  });

  test('an executor that gives no object gives EXECUTED with the output null', async () => {
    for (const value of [undefined, 'done', 7]) {
      const executors = { recommend_allowance: async () => value } as unknown as Executors;
      expect(await execute({ result: allowance(), approved_by_person: true }, executors)).toEqual({ status: 'EXECUTED', output: null, problems: [] });
    }
  });
});
