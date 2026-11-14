// The last step and the audit text. Only a PROPOSED result can execute; a change waits for the
// person; the services come from the caller; a service that throws gives a value.
import { describe, expect, test } from 'vitest';
import { checkRequest, execute, type Checks, type Executors, type GateResult } from './action-gate.ts';
import { MAX_SUMMARY, summariseInput } from './audit.ts';

const ctx = { now: '2026-03-14T08:00:00.000Z', request_id: 'req_2' };
const checks: Checks = {
  categoryExists: () => true,
  batchExists: () => true,
  mappingDryRun: () => [],
  allowanceConsequences: () => ({ ok: true, problems: [], consequences: { new_weekly_cents: 90000 } }),
};
const gate = (request: unknown) => checkRequest(request, checks, ctx);

/** Executors that record each call. */
function recorder() {
  const calls: Array<[string, object]> = [];
  const make = (name: string) => async (input: object) => (calls.push([name, input]), { done: name });
  const executors: Executors = { analyse_spending: make('analyse_spending'), recommend_allowance: make('recommend_allowance'), move_money_to_savings: make('move_money_to_savings') };
  return { calls, executors };
}

const allowance = () => gate({ capability: 'recommend_allowance', input: { change_percent: -10, reason: 'r' } });

describe('execute: only the application executes (R18), and a change waits for the person (R17)', () => {
  test('a read executes with no approval', async () => {
    const { calls, executors } = recorder();
    const result = gate({ capability: 'analyse_spending', input: { period: 'this_cycle' } });
    expect(await execute({ result, approved_by_person: false }, executors)).toEqual({ status: 'EXECUTED', output: { done: 'analyse_spending' }, problems: [] });
    expect(calls).toEqual([['analyse_spending', { period: 'this_cycle' }]]);
  });

  test('a proposal that needs approval does not execute without it', async () => {
    const { calls, executors } = recorder();
    const outcome = await execute({ result: allowance(), approved_by_person: false }, executors);
    expect(outcome).toEqual({ status: 'NOT_APPROVED', output: null, problems: [{ rule: 'R17', text: 'The action "recommend_allowance" waits for the approval of the person.' }] });
    expect(calls).toEqual([]);
  });

  test('a value that is not exactly true is not an approval', async () => {
    const { calls, executors } = recorder();
    for (const value of ['yes', 1, {}, null, undefined]) {
      expect((await execute({ result: allowance(), approved_by_person: value as unknown as boolean }, executors)).status).toBe('NOT_APPROVED');
    }
    expect(calls).toEqual([]);
  });

  test('with the approval of the person, the executor gets the input that the gate accepted', async () => {
    const { calls, executors } = recorder();
    expect((await execute({ result: allowance(), approved_by_person: true }, executors)).status).toBe('EXECUTED');
    expect(calls).toEqual([['recommend_allowance', { change_percent: -10, reason: 'r' }]]);
  });

  test('a rejected result cannot execute, also with approval and with an executor of that name', async () => {
    const { calls, executors } = recorder();
    const requests = [{ capability: 'move_money_to_savings', input: { amount_cents: 50000 } }, { capability: 'recommend_allowance', input: { change_percent: 99, reason: 'r' } }, 'pay now'];
    for (const request of requests) {
      const result = gate(request);
      expect(result.status).toBe('REJECTED');
      const outcome = await execute({ result, approved_by_person: true }, executors);
      expect(outcome.status).toBe('NOT_PROPOSED');
      expect(outcome.output).toBeNull();
      expect(outcome.problems.map((p) => p.rule)).toEqual(['R18']);
    }
    expect(calls).toEqual([]);
  });

  test('a PROPOSED result that the gate did not make gets nothing: the allowlist is asked again', async () => {
    const { calls, executors } = recorder();
    const audit = { request_id: 'x', at: ctx.now, capability: 'move_money_to_savings', status: 'PROPOSED' as const, reason: null, input_summary: '' };
    const forged: GateResult = { status: 'PROPOSED', capability: 'move_money_to_savings', input: { amount_cents: 50000 }, needs_approval: false, consequences: null, audit };
    expect((await execute({ result: forged, approved_by_person: true }, executors)).status).toBe('NOT_PROPOSED');
    // A forged result cannot remove the need for approval of a permitted capability.
    const noApproval: GateResult = { ...forged, capability: 'recommend_allowance', input: { change_percent: 50, reason: '' } };
    expect((await execute({ result: noApproval, approved_by_person: false }, executors)).status).toBe('NOT_APPROVED');
    expect(calls).toEqual([]);
  });

  test('a capability with no executor gives NO_EXECUTOR', async () => {
    const outcome = await execute({ result: allowance(), approved_by_person: true }, {});
    expect(outcome).toEqual({ status: 'NO_EXECUTOR', output: null, problems: [{ rule: 'R18', text: 'The application has no service for "recommend_allowance".' }] });
  });

  test('an executor that throws, now or later, gives FAILED and not an exception', async () => {
    const now: Executors = { recommend_allowance: () => { throw new Error('secret detail of the store'); } };
    const later: Executors = { recommend_allowance: async () => { throw new Error('secret detail of the store'); } };
    for (const executors of [now, later]) {
      const outcome = await execute({ result: allowance(), approved_by_person: true }, executors);
      expect(outcome.status).toBe('FAILED');
      expect(outcome.output).toBeNull();
      expect(JSON.stringify(outcome)).not.toContain('secret detail');
    }
  });
});

describe('the input summary of the audit record', () => {
  test('a long text of the person is cut: no value is longer than 80 characters', () => {
    const text = 'I had a hard month and '.repeat(20);
    const result = gate({ capability: 'recommend_allowance', input: { change_percent: -10, reason: text.slice(0, 200) } });
    expect(result.status).toBe('PROPOSED');
    const summary = result.audit.input_summary;
    expect(summary).toBe('change_percent=-10 reason="I had a hard month and I had a hard m..."');
    for (const quoted of summary.match(/"[^"]*"/g) ?? []) expect(quoted.length).toBeLessThanOrEqual(80);
  });

  test('a rejected input is summarised with the same limits, and the summary has a fixed largest size', () => {
    const big = Object.fromEntries(Array.from({ length: 30 }, (_, i) => ['field_' + i, 'v'.repeat(300)]));
    const summary = gate({ capability: 'unknown_thing', input: big }).audit.input_summary;
    expect(summary.length).toBeLessThanOrEqual(MAX_SUMMARY);
    expect(summary).not.toContain('v'.repeat(41));
  });

  test('values that are not text are named by kind; control characters do not go into the audit', () => {
    expect(summariseInput(undefined)).toBe('(no input)');
    expect(summariseInput('pay now')).toBe('(not an object: "pay now")');
    expect(summariseInput([1, 2])).toBe('(not an object: [list of 2])');
    expect(summariseInput({ a: [1, 2, 3], b: { c: { d: 1 } }, e: null, f: true })).toBe('a=[list of 3] b={c=(object)} e=null f=true');
    expect(summariseInput({ merchant_name: 'Corner\nBakery\u0000' })).toBe('merchant_name="Corner Bakery "');
  });
});
