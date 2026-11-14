// The gate after the adversarial review. An answer of a check is not trusted without a look, a
// result cannot be changed, a problem text has a largest size, and no control character of a
// request goes into a problem or the audit. Each test here failed before the repair.
import { describe, expect, test } from 'vitest';
import { checkRequest, type Checks, type GateResult } from './action-gate.ts';
import { cutText, shortText } from './audit.ts';

const ctx = { now: '2026-03-14T08:00:00.000Z', request_id: 'req_6' };
const mapping = { date: 'Date', description: 'Details', amount: 'Amount', date_format: 'DD/MM/YYYY', decimal: ',' };
const good: Checks = { categoryExists: () => true, batchExists: () => true, mappingDryRun: () => [], allowanceConsequences: () => ({ ok: true, problems: [], consequences: { new_weekly_cents: 90000 } }) };
/** A check with an answer of the wrong type, as a caller with a cast can give. */
const gate = (request: unknown, over: Record<string, unknown> = {}) => checkRequest(request, { ...good, ...over } as unknown as Checks, ctx);
const CANNOT = [{ rule: 'R16', text: 'The application could not verify the request. It is not accepted.' }];
const spending = { capability: 'analyse_spending', input: { period: 'this_cycle', category_id: 'groceries' } };
const columns = { capability: 'propose_column_mapping', input: { batch_id: 'batch_1', mapping } };
const allowance = { capability: 'recommend_allowance', input: { change_percent: 5, reason: 'r' } };
const proposed = (result: GateResult) => {
  if (result.status !== 'PROPOSED') throw new Error('expected PROPOSED, got ' + result.status);
  return result;
};

describe('an answer of a check that is not the exact answer is "cannot verify"', () => {
  const cases: Array<[name: string, request: unknown, over: Record<string, unknown>]> = [
    ['categoryExists gives a promise', spending, { categoryExists: async () => false }],
    ['categoryExists gives a promise of true', spending, { categoryExists: async () => true }],
    ['categoryExists gives a text', spending, { categoryExists: () => 'yes' }],
    ['categoryExists gives nothing', spending, { categoryExists: () => undefined }],
    ['categoryExists is absent', spending, { categoryExists: undefined }],
    ['batchExists gives a promise', columns, { batchExists: async () => false }],
    ['batchExists gives 1', columns, { batchExists: () => 1 }],
    ['mappingDryRun gives a promise', columns, { mappingDryRun: async () => [{ rule: 'X', text: 'a problem' }] }],
    ['mappingDryRun gives nothing', columns, { mappingDryRun: () => undefined }],
    ['mappingDryRun gives a list of texts', columns, { mappingDryRun: () => ['a problem'] }],
    ['allowanceConsequences gives ok as a text', allowance, { allowanceConsequences: () => ({ ok: 'no', problems: [], consequences: {} }) }],
    ['allowanceConsequences gives no consequences', allowance, { allowanceConsequences: () => ({ ok: true, problems: [] }) }],
    ['allowanceConsequences gives consequences that are a list', allowance, { allowanceConsequences: () => ({ ok: true, problems: [], consequences: [] }) }],
    ['allowanceConsequences gives no list of problems', allowance, { allowanceConsequences: () => ({ ok: true, consequences: {} }) }],
    ['allowanceConsequences gives a promise', allowance, { allowanceConsequences: async () => ({ ok: true, problems: [], consequences: {} }) }],
    ['allowanceConsequences gives null', allowance, { allowanceConsequences: () => null }],
  ];
  test.each(cases)('%s: REJECTED as NOT_VERIFIABLE, and the gate does not throw', (_name, request, over) => {
    const result = gate(request, over);
    expect(result).toMatchObject({ status: 'REJECTED', reason: 'NOT_VERIFIABLE', problems: CANNOT });
    expect(result.audit).toMatchObject({ status: 'REJECTED', reason: 'NOT_VERIFIABLE', capability: (request as { capability: string }).capability });
  });

  test('a check that fails later (a rejected promise) does not stop the program', async () => {
    expect(gate(spending, { categoryExists: async () => { throw new Error('late'); } }).status).toBe('REJECTED');
    await new Promise((done) => setTimeout(done, 5)); // an unhandled rejection here would fail the test run
  });

  test('the problems of a check are limited in number and in size, and have no control character', () => {
    const many = Array.from({ length: 500 }, (_, i) => ({ rule: 'MAP-DATE', text: 'Line ' + i + ': the text "' + 'x'.repeat(5000) + '\nINFO forged" is not a date.' }));
    const result = gate(columns, { mappingDryRun: () => many });
    if (result.status !== 'REJECTED') throw new Error('expected REJECTED');
    expect(result.problems).toHaveLength(11);
    expect(result.problems[10]).toEqual({ rule: 'R16', text: 'And 490 more problems.' });
    for (const problem of result.problems) expect(problem.text.length).toBeLessThanOrEqual(300);
    expect(JSON.stringify(gate(columns, { mappingDryRun: () => [{ rule: 'X', text: 'a\nb' }] }))).not.toContain('\\n');
  });
});

describe('a result of the gate cannot be changed', () => {
  test('a PROPOSED result is frozen, with its input, its consequences and its audit record', () => {
    const result = proposed(gate(columns));
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.input)).toBe(true);
    expect(Object.isFrozen((result.input as { mapping: object }).mapping)).toBe(true);
    expect(Object.isFrozen(result.audit)).toBe(true);
    const changed = proposed(gate(allowance));
    expect(() => { (changed.input as { change_percent: number }).change_percent = 5000; }).toThrow(TypeError);
    expect(() => { (changed as { needs_approval: boolean }).needs_approval = false; }).toThrow(TypeError);
    expect(Object.isFrozen(changed.consequences)).toBe(true);
    expect(Object.isFrozen(gate({ capability: 'x', input: {} }).audit)).toBe(true);
  });

  test('the consequences are a copy: a later change in the application does not change what the person saw', () => {
    const own = { new_weekly_cents: 90000 };
    const result = proposed(gate(allowance, { allowanceConsequences: () => ({ ok: true, problems: [], consequences: own }) }));
    own.new_weekly_cents = 1;
    expect(result.consequences).toEqual({ new_weekly_cents: 90000 });
    expect(Object.isFrozen(own)).toBe(false);
  });
});

describe('a text of a request is cleaned and limited before it goes into a problem or the audit', () => {
  test('100 000 extra fields give one short problem: the first five names and the number of the others', () => {
    const input = Object.fromEntries([['period', 'this_cycle'], ...Array.from({ length: 100_000 }, (_, i) => ['extra_field_with_a_long_name_' + i, 1])]);
    const result = gate({ capability: 'analyse_spending', input });
    if (result.status !== 'REJECTED') throw new Error('expected REJECTED');
    expect(result.reason).toBe('INVALID_INPUT');
    expect(result.problems).toHaveLength(1);
    expect(result.problems[0]!.text).toMatch(/^The input has a field that "analyse_spending" does not permit: "extra_field_with_a_long_name_0", .* and 99995 more\.$/);
    expect(result.problems[0]!.text.length).toBeLessThan(300);
  });

  test('a capability name with a line end and a NUL is cleaned in the problem text and in the audit', () => {
    const result = gate({ capability: 'pay\nINFO fake line\u0000', input: {} });
    expect(result).toMatchObject({ status: 'REJECTED', reason: 'UNKNOWN_CAPABILITY', audit: { capability: 'pay INFO fake line ' } });
    expect(JSON.stringify(result)).not.toMatch(/\\n|\\u0000/);
  });

  test('a cut is never in the middle of a character pair', () => {
    const face = String.fromCodePoint(0x1f600);
    const result = gate({ capability: 'x'.repeat(39) + face, input: {} });
    expect(result.audit.capability).toBe('x'.repeat(39));
    expect(cutText('ab' + face, 3)).toBe('ab');
    expect(cutText('ab' + face, 4)).toBe('ab' + face);
    expect(shortText('a' + face[0], 5)).toBe('a?'); // one half alone is not a character
    expect(gate({ capability: 'x', input: { note: 'y'.repeat(36) + face + 'zzzz' } }).audit.input_summary).toBe('note="' + 'y'.repeat(36) + '..."');
  });

  test('a request with a name and no input keeps the name in the audit', () => {
    expect(gate({ capability: 'move_money' })).toMatchObject({ status: 'REJECTED', reason: 'NOT_AN_OBJECT', audit: { capability: 'move_money', input_summary: '(no input)' } });
  });
});

describe('the request itself is strict', () => {
  test('a field that is not the capability or the input is REJECTED by name', () => {
    const result = gate({ ...allowance, needs_approval: false, approved_by_person: true });
    expect(result).toMatchObject({ status: 'REJECTED', reason: 'NOT_AN_OBJECT', audit: { capability: 'recommend_allowance' } });
    expect(result.status === 'REJECTED' && result.problems).toEqual([{ rule: 'R15', text: 'The request has a field that is not permitted: "needs_approval", "approved_by_person". A request has only a capability and an input.' }]);
  });

  test('a request that throws when it is read is REJECTED, not an exception', () => {
    const request = { get capability(): string { throw new Error('a trap'); }, input: {} };
    expect(gate(request)).toMatchObject({ status: 'REJECTED', reason: 'NOT_AN_OBJECT', problems: [{ rule: 'R15', text: 'The request could not be read. It is not accepted.' }] });
  });
});
