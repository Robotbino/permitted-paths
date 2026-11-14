// The allowlist is the control of the application over the model. These tests fix it:
// a new capability cannot arrive without a change to this file that a person reviews.
import { describe, expect, test } from 'vitest';
import { CAPABILITIES, CAPABILITY_NAMES, ColumnMapping, capabilityList, findCapability } from './capabilities.ts';

const FORBIDDEN = /transfer|pay|delete|execute|sql|balance|write/;

describe('the allowlist of capabilities', () => {
  test('the allowlist has exactly four capabilities, with these names', () => {
    expect(Object.keys(CAPABILITIES)).toEqual(['analyse_spending', 'suggest_category', 'propose_column_mapping', 'recommend_allowance']);
    expect([...CAPABILITY_NAMES]).toEqual(Object.keys(CAPABILITIES));
  });

  test('no name is about moving money, a balance, a removal, or running code', () => {
    for (const name of Object.keys(CAPABILITIES)) expect(name, name).not.toMatch(FORBIDDEN);
  });

  test('each capability has its own name, one sentence for each text, and a schema', () => {
    for (const [key, capability] of Object.entries(CAPABILITIES)) {
      expect(capability.name).toBe(key);
      for (const text of [capability.purpose, capability.model_does, capability.application_does]) {
        expect(text.length, key).toBeGreaterThan(10);
        expect(text.endsWith('.'), key).toBe(true);
      }
      expect(typeof capability.input.safeParse, key).toBe('function');
    }
  });

  test('the two capabilities that change data need the approval of the person; the two that only read do not', () => {
    const flags = Object.fromEntries(Object.values(CAPABILITIES).map((c) => [c.name, [c.needs_approval, c.changes_data]]));
    expect(flags).toEqual({
      analyse_spending: [false, false],
      suggest_category: [false, false],
      propose_column_mapping: [true, true],
      recommend_allowance: [true, true],
    });
    for (const c of Object.values(CAPABILITIES)) if (c.changes_data) expect(c.needs_approval, c.name).toBe(true);
  });

  test('a name that every object has is not a capability', () => {
    expect(findCapability('recommend_allowance')?.name).toBe('recommend_allowance');
    for (const name of ['constructor', 'toString', '__proto__', 'hasOwnProperty', 'Recommend_Allowance', '']) expect(findCapability(name), name).toBeNull();
  });

  test('the interpreter gets only the name and the purpose of each capability', () => {
    expect(capabilityList().map((c) => Object.keys(c))).toEqual(Array(4).fill(['name', 'purpose']));
    expect(capabilityList().map((c) => c.name)).toEqual([...CAPABILITY_NAMES]);
  });
});

describe('the input schemas', () => {
  const ok = (name: keyof typeof CAPABILITIES, input: unknown) => CAPABILITIES[name].input.safeParse(input).success;

  test('analyse_spending permits two periods and an optional category', () => {
    expect(ok('analyse_spending', { period: 'this_cycle' })).toBe(true);
    expect(ok('analyse_spending', { period: 'last_cycle', category_id: 'groceries' })).toBe(true);
    expect(ok('analyse_spending', { period: 'next_cycle' })).toBe(false);
    expect(ok('analyse_spending', {})).toBe(false);
    expect(ok('analyse_spending', { period: 'this_cycle', category_id: '' })).toBe(false);
  });

  test('suggest_category permits a merchant name of 1 to 80 characters', () => {
    expect(ok('suggest_category', { merchant_name: 'Corner Bakery' })).toBe(true);
    expect(ok('suggest_category', { merchant_name: 'x'.repeat(80) })).toBe(true);
    expect(ok('suggest_category', { merchant_name: 'x'.repeat(81) })).toBe(false);
    expect(ok('suggest_category', { merchant_name: '' })).toBe(false);
  });

  test('recommend_allowance permits an integer from -50 to 50 and a reason of 200 characters at most', () => {
    expect(ok('recommend_allowance', { change_percent: -50, reason: '' })).toBe(true);
    expect(ok('recommend_allowance', { change_percent: 50, reason: 'x'.repeat(200) })).toBe(true);
    expect(ok('recommend_allowance', { change_percent: 51, reason: 'r' })).toBe(false);
    expect(ok('recommend_allowance', { change_percent: -51, reason: 'r' })).toBe(false);
    expect(ok('recommend_allowance', { change_percent: 7.5, reason: 'r' })).toBe(false);
    expect(ok('recommend_allowance', { change_percent: '10', reason: 'r' })).toBe(false);
    expect(ok('recommend_allowance', { change_percent: 10, reason: 'x'.repeat(201) })).toBe(false);
    expect(ok('recommend_allowance', { change_percent: 10 })).toBe(false);
  });

  test('a column mapping has one amount column, or a debit and a credit column, and never the two forms together', () => {
    const base = { date: 'Date', description: 'Details', date_format: 'DD/MM/YYYY', decimal: ',' };
    expect(ColumnMapping.safeParse({ ...base, amount: 'Amount' }).success).toBe(true);
    expect(ColumnMapping.safeParse({ ...base, debit: 'Money out', credit: 'Money in' }).success).toBe(true);
    expect(ColumnMapping.safeParse(base).success).toBe(false);
    expect(ColumnMapping.safeParse({ ...base, debit: 'Money out' }).success).toBe(false);
    expect(ColumnMapping.safeParse({ ...base, amount: 'Amount', debit: 'Money out', credit: 'Money in' }).success).toBe(false);
    expect(ColumnMapping.safeParse({ ...base, amount: 'Amount', date_format: 'D MMM YYYY' }).success).toBe(false);
    expect(ColumnMapping.safeParse({ ...base, amount: 'Amount', decimal: ';' }).success).toBe(false);
  });

  test('each schema is strict: a field that is not in it is a problem', () => {
    expect(ok('analyse_spending', { period: 'this_cycle', amount_cents: 5 })).toBe(false);
    expect(ok('suggest_category', { merchant_name: 'Corner Bakery', category_id: 'groceries' })).toBe(false);
    expect(ok('recommend_allowance', { change_percent: 10, reason: 'r', new_allowance_cents: 90000 })).toBe(false);
    const mapping = { date: 'Date', description: 'Details', amount: 'Amount', date_format: 'YYYY-MM-DD', decimal: '.' };
    expect(ok('propose_column_mapping', { batch_id: 'batch_1', mapping })).toBe(true);
    expect(ok('propose_column_mapping', { batch_id: 'batch_1', mapping: { ...mapping, balance: 'Balance' } })).toBe(false);
    expect(ok('propose_column_mapping', { batch_id: 'batch_1', mapping, apply_now: true })).toBe(false);
  });
});
