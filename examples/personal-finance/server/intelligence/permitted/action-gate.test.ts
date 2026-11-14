// The gate, check by check. Each case also states its audit record.
// The model recommends, the application validates, the person approves, the application executes.
import { describe, expect, test } from 'vitest';
import type { Problem } from '../../../shared/contracts.ts';
import { GATE_RULES, checkRequest, type Checks, type GateResult } from './action-gate.ts';

const ctx = { now: '2026-03-14T08:00:00.000Z', request_id: 'req_1' };
const mapping = { date: 'Date', description: 'Details', amount: 'Amount', date_format: 'DD/MM/YYYY', decimal: ',' };

/** The facts of a fictional application. Each test can change one answer. */
const checksWith = (over: Partial<Checks> = {}): Checks => ({
  categoryExists: (id) => id === 'groceries',
  batchExists: (id) => id === 'batch_1',
  mappingDryRun: () => [],
  allowanceConsequences: (percent) => ({ ok: true, problems: [], consequences: { old_weekly_cents: 100000, new_weekly_cents: 100000 + percent * 1000 } }),
  ...over,
});
const gate = (request: unknown, over: Partial<Checks> = {}) => checkRequest(request, checksWith(over), ctx);
const rejected = (result: GateResult) => {
  if (result.status !== 'REJECTED') throw new Error('expected REJECTED, got ' + result.status);
  return result;
};
const proposed = (result: GateResult) => {
  if (result.status !== 'PROPOSED') throw new Error('expected PROPOSED, got ' + result.status);
  return result;
};

test('the gate has four rules, R15 to R18', () => {
  expect(Object.keys(GATE_RULES)).toEqual(['R15', 'R16', 'R17', 'R18']);
});

describe('check 1: the request is an object with a capability name and an input', () => {
  test.each([['a text', 'analyse_spending'], ['null', null], ['a list', [{ capability: 'analyse_spending', input: {} }]], ['a number', 7], ['nothing', undefined]])('%s is REJECTED as NOT_AN_OBJECT', (_name, request) => {
    const result = rejected(gate(request));
    expect(result.reason).toBe('NOT_AN_OBJECT');
    expect(result.problems.map((p) => p.rule)).toEqual(['R15']);
    expect(result.audit).toEqual({ request_id: 'req_1', at: ctx.now, capability: null, status: 'REJECTED', reason: 'NOT_AN_OBJECT', input_summary: '(no input)' });
  });

  test('an object with no capability name, a name that is not text, or no input is REJECTED', () => {
    expect(rejected(gate({ input: { period: 'this_cycle' } })).reason).toBe('NOT_AN_OBJECT');
    expect(rejected(gate({ capability: 42, input: {} })).reason).toBe('NOT_AN_OBJECT');
    expect(rejected(gate({ capability: ['analyse_spending'], input: {} })).reason).toBe('NOT_AN_OBJECT');
    expect(rejected(gate({ capability: 'analyse_spending' })).reason).toBe('NOT_AN_OBJECT');
    expect(rejected(gate({})).audit.capability).toBeNull();
  });
});

describe('check 2: the capability is in the allowlist (R15)', () => {
  test('an unknown capability is REJECTED by name, and the problem lists what is permitted', () => {
    const result = rejected(gate({ capability: 'move_money_to_savings', input: { amount_cents: 50000 } }));
    expect(result.reason).toBe('UNKNOWN_CAPABILITY');
    expect(result.problems).toEqual([
      { rule: 'R15', text: 'The capability "move_money_to_savings" is not permitted. The permitted capabilities are: analyse_spending, suggest_category, propose_column_mapping, recommend_allowance.' },
    ]);
    expect(result.audit).toEqual({ request_id: 'req_1', at: ctx.now, capability: 'move_money_to_savings', status: 'REJECTED', reason: 'UNKNOWN_CAPABILITY', input_summary: 'amount_cents=50000' });
  });

  test('a name of a different case, a name with a space, and a name that every object has are unknown', () => {
    for (const capability of ['Analyse_Spending', 'analyse_spending ', 'constructor', '__proto__', '']) {
      expect(rejected(gate({ capability, input: { period: 'this_cycle' } })).reason, capability).toBe('UNKNOWN_CAPABILITY');
    }
  });

  test('a very long unknown name is cut in the problem text and in the audit', () => {
    const result = rejected(gate({ capability: 'x'.repeat(500), input: {} }));
    expect(result.audit.capability).toBe('x'.repeat(40));
    expect(result.problems[0]!.text).not.toContain('x'.repeat(41));
  });
});

describe('check 3: the input has the shape of the capability (R16)', () => {
  test('a wrong type, an absent field and a value out of range are REJECTED as INVALID_INPUT', () => {
    const wrongType = rejected(gate({ capability: 'recommend_allowance', input: { change_percent: 'ten', reason: 7 } }));
    expect(wrongType.reason).toBe('INVALID_INPUT');
    expect(wrongType.problems).toEqual([
      { rule: 'R16', text: 'The field "change_percent" of the input is absent or not correct.' },
      { rule: 'R16', text: 'The field "reason" of the input is absent or not correct.' },
    ]);
    expect(wrongType.audit).toMatchObject({ capability: 'recommend_allowance', status: 'REJECTED', reason: 'INVALID_INPUT', input_summary: 'change_percent="ten" reason=7' });
    expect(rejected(gate({ capability: 'recommend_allowance', input: { change_percent: 80, reason: 'r' } })).reason).toBe('INVALID_INPUT');
    expect(rejected(gate({ capability: 'analyse_spending', input: {} })).problems[0]!.text).toContain('"period"');
    expect(rejected(gate({ capability: 'propose_column_mapping', input: { batch_id: 'batch_1', mapping: { ...mapping, date_format: 'D MMM' } } })).problems[0]!.text).toContain('"mapping.date_format"');
  });

  test('an input that is not an object is REJECTED', () => {
    for (const input of [null, 'this_cycle', 5, [], undefined]) {
      const result = rejected(gate({ capability: 'analyse_spending', input }));
      expect(result.reason).toBe('INVALID_INPUT');
      expect(result.problems).toHaveLength(1);
    }
  });

  test('an extra field is REJECTED, and the problem names the field', () => {
    const result = rejected(gate({ capability: 'recommend_allowance', input: { change_percent: 10, reason: 'r', new_allowance_cents: 90000 } }));
    expect(result.reason).toBe('INVALID_INPUT');
    expect(result.problems).toEqual([{ rule: 'R16', text: 'The input has a field that "recommend_allowance" does not permit: "new_allowance_cents".' }]);
    expect(rejected(gate({ capability: 'analyse_spending', input: { period: 'this_cycle', sql: 'select 1' } })).reason).toBe('INVALID_INPUT');
  });
});

describe('check 4: the application verifies the input against its own facts (R16)', () => {
  const failing: Array<[name: string, request: unknown, over: Partial<Checks>, text: string]> = [
    ['a category that the store does not have', { capability: 'analyse_spending', input: { period: 'this_cycle', category_id: 'crypto' } }, {}, 'The category "crypto" is not a category of the store.'],
    ['a batch that the store does not have', { capability: 'propose_column_mapping', input: { batch_id: 'batch_9', mapping } }, {}, 'The import batch "batch_9" is not in the store.'],
    ['a mapping that does not read the lines', { capability: 'propose_column_mapping', input: { batch_id: 'batch_1', mapping } }, { mappingDryRun: (): Problem[] => [{ rule: 'R16', text: 'The column "Amount" is not in the statement.' }] }, 'The column "Amount" is not in the statement.'],
    ['an allowance change with a problem', { capability: 'recommend_allowance', input: { change_percent: -40, reason: 'r' } }, { allowanceConsequences: () => ({ ok: false, problems: [{ rule: 'R16', text: 'The new allowance is less than the fixed costs of a week.' }], consequences: {} }) }, 'The new allowance is less than the fixed costs of a week.'],
    ['an allowance change that is not ok and has no problem text', { capability: 'recommend_allowance', input: { change_percent: 5, reason: 'r' } }, { allowanceConsequences: () => ({ ok: false, problems: [], consequences: {} }) }, 'The application cannot calculate the consequences of this change.'],
    ['a check that throws', { capability: 'analyse_spending', input: { period: 'this_cycle', category_id: 'groceries' } }, { categoryExists: () => { throw new Error('the store is closed'); } }, 'The application could not verify the request. It is not accepted.'],
  ];
  test.each(failing)('%s is REJECTED as NOT_VERIFIABLE', (_name, request, over, text) => {
    const result = rejected(gate(request, over));
    expect(result.reason).toBe('NOT_VERIFIABLE');
    expect(result.problems).toEqual([{ rule: 'R16', text }]);
    expect(result.audit).toMatchObject({ request_id: 'req_1', at: ctx.now, status: 'REJECTED', reason: 'NOT_VERIFIABLE', capability: (request as { capability: string }).capability });
  });

  test('the dry run of a mapping gets the batch and the mapping that the schema accepted', () => {
    const seen: unknown[] = [];
    gate({ capability: 'propose_column_mapping', input: { batch_id: 'batch_1', mapping } }, { mappingDryRun: (...args) => (seen.push(args), []) });
    expect(seen).toEqual([['batch_1', mapping]]);
  });
});

describe('a request that passes the four checks is PROPOSED, and no more', () => {
  test('a read needs no approval and has no consequences', () => {
    const result = proposed(gate({ capability: 'analyse_spending', input: { period: 'last_cycle', category_id: 'groceries' } }));
    expect(result).toEqual({
      status: 'PROPOSED', capability: 'analyse_spending', input: { period: 'last_cycle', category_id: 'groceries' }, needs_approval: false, consequences: null,
      audit: { request_id: 'req_1', at: ctx.now, capability: 'analyse_spending', status: 'PROPOSED', reason: null, input_summary: 'period="last_cycle" category_id="groceries"' },
    });
    expect(proposed(gate({ capability: 'suggest_category', input: { merchant_name: 'Corner Bakery' } })).needs_approval).toBe(false);
  });

  test('an allowance change needs approval, and the application calculated the consequences', () => {
    const result = proposed(gate({ capability: 'recommend_allowance', input: { change_percent: -10, reason: 'A lower allowance for four weeks.' } }));
    expect(result.needs_approval).toBe(true);
    expect(result.consequences).toEqual({ old_weekly_cents: 100000, new_weekly_cents: 90000 });
    expect(result.audit.input_summary).toBe('change_percent=-10 reason="A lower allowance for four weeks."');
  });

  test('a column mapping needs approval', () => {
    const result = proposed(gate({ capability: 'propose_column_mapping', input: { batch_id: 'batch_1', mapping } }));
    expect(result.needs_approval).toBe(true);
    expect(result.audit.input_summary).toBe('batch_id="batch_1" mapping={date="Date" description="Details" amount="Amount" date_format="DD/MM/YYYY" decimal=","}');
  });

  test('the same request gives the same result each time: the gate has no clock and no chance', () => {
    const request = { capability: 'recommend_allowance', input: { change_percent: 5, reason: 'r' } };
    expect(gate(request)).toEqual(gate(request));
  });
});
