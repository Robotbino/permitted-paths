// The input schemas and the registry after the adversarial review: the date formats are those of
// the import pipeline, a text is plain text, one column has one meaning, and the allowlist is frozen.
import { describe, expect, test } from 'vitest';
import { DATE_FORMATS as PIPELINE_DATE_FORMATS, parseDate } from '../../../shared/pipeline/values.ts';
import { CAPABILITIES, CAPABILITY_NAMES, ColumnMapping, DATE_FORMATS, findCapability, toMappingProfile } from './capabilities.ts';
import { checkRequest, execute, type Checks } from './action-gate.ts';

const ok = (name: keyof typeof CAPABILITIES, input: unknown) => CAPABILITIES[name].input.safeParse(input).success;
const base = { date: 'Date', description: 'Details', date_format: 'DD/MM/YYYY', decimal: ',' };
const checks: Checks = { categoryExists: () => true, batchExists: () => true, mappingDryRun: () => [], allowanceConsequences: () => ({ ok: true, problems: [], consequences: {} }) };
const ctx = { now: '2026-03-14T08:00:00.000Z', request_id: 'req_5' };
const chars = (...codes: number[]) => String.fromCharCode(...codes);

describe('the date formats of a mapping are the date formats of the import pipeline', () => {
  test('the gate has the same list as the pipeline: it is one list, not a copy', () => {
    expect(DATE_FORMATS).toBe(PIPELINE_DATE_FORMATS);
  });

  test('each format that the pipeline reads is accepted, and a format that it does not read is rejected', () => {
    for (const date_format of PIPELINE_DATE_FORMATS) expect(ColumnMapping.safeParse({ ...base, amount: 'Amount', date_format }).success, date_format).toBe(true);
    expect(ColumnMapping.safeParse({ ...base, amount: 'Amount', date_format: 'YYYYMMDD' }).success).toBe(true);
    expect(ColumnMapping.safeParse({ ...base, amount: 'Amount', date_format: 'YYYY/MM/DD' }).success).toBe(false);
  });

  test('an accepted mapping becomes a mapping profile of the pipeline, and the pipeline reads a date with it', () => {
    const mapping = ColumnMapping.parse({ ...base, debit: 'Money out', credit: 'Money in', date_format: 'YYYYMMDD' });
    const profile = toMappingProfile(mapping, 'imp-1', 'A proposal');
    expect(profile).toEqual({ id: 'imp-1', name: 'A proposal', columns: { date: 'Date', description: 'Details', debit: 'Money out', credit: 'Money in' }, date_format: 'YYYYMMDD', decimal: ',' });
    expect(parseDate('20260314', profile.date_format)).toBe('2026-03-14');
    expect(toMappingProfile(ColumnMapping.parse({ ...base, amount: 'Amount' }), 'imp-2', 'n').columns).toEqual({ date: 'Date', description: 'Details', amount: 'Amount' });
  });
});

describe('a text of an input is plain text', () => {
  test('a merchant name of only spaces is rejected, and spaces at the two ends do not count', () => {
    expect(ok('suggest_category', { merchant_name: '   ' })).toBe(false);
    expect(CAPABILITIES.suggest_category.input.parse({ merchant_name: '  Corner Bakery ' })).toEqual({ merchant_name: 'Corner Bakery' });
  });

  test('a control character, a line end and a character that changes the direction of text are rejected', () => {
    for (const bad of ['Corner\nBakery', 'Corner' + chars(0) + 'Bakery', 'Corner' + chars(0x202e) + 'Bakery', 'Corner' + chars(0x200b) + 'Bakery', 'Corner' + chars(0xd83d)]) {
      expect(ok('suggest_category', { merchant_name: bad }), JSON.stringify(bad)).toBe(false);
      expect(ok('recommend_allowance', { change_percent: 5, reason: bad }), JSON.stringify(bad)).toBe(false);
      expect(ColumnMapping.safeParse({ ...base, amount: bad }).success, JSON.stringify(bad)).toBe(false);
    }
    expect(ok('suggest_category', { merchant_name: 'Caf' + chars(0xe9) + ' ' + String.fromCodePoint(0x1f600) })).toBe(true);
  });

  test('an id has only letters, digits and . : _ -', () => {
    expect(ok('analyse_spending', { period: 'this_cycle', category_id: 'cat_0001' })).toBe(true);
    expect(ok('propose_column_mapping', { batch_id: 'imp-3f9a12c0de41', mapping: { ...base, amount: 'Amount' } })).toBe(true);
    for (const id of [' ', 'a b', 'a\nb', 'x"; drop', '']) {
      expect(ok('analyse_spending', { period: 'this_cycle', category_id: id }), JSON.stringify(id)).toBe(false);
      expect(ok('propose_column_mapping', { batch_id: id, mapping: { ...base, amount: 'Amount' } }), JSON.stringify(id)).toBe(false);
    }
  });

  test('a column name of only spaces is rejected', () => {
    expect(ColumnMapping.safeParse({ ...base, date: ' ', amount: 'Amount' }).success).toBe(false);
    expect(ColumnMapping.safeParse({ ...base, description: '\n', amount: 'Amount' }).success).toBe(false);
    expect(ColumnMapping.safeParse({ ...base, amount: '\t' }).success).toBe(false);
  });

  test('one column cannot have two meanings; case and spaces do not make a different column', () => {
    expect(ColumnMapping.safeParse({ ...base, date: 'A', description: 'A', amount: 'B' }).success).toBe(false);
    expect(ColumnMapping.safeParse({ ...base, amount: 'date' }).success).toBe(false);
    expect(ColumnMapping.safeParse({ ...base, debit: 'C', credit: 'C' }).success).toBe(false);
    expect(ColumnMapping.safeParse({ ...base, debit: 'Money Out', credit: 'moneyout' }).success).toBe(false);
    const result = checkRequest({ capability: 'propose_column_mapping', input: { batch_id: 'batch_1', mapping: { ...base, debit: 'C', credit: 'C' } } }, checks, ctx);
    expect(result).toMatchObject({ status: 'REJECTED', reason: 'INVALID_INPUT', problems: [{ rule: 'R16', text: 'The field "mapping" of the input is not correct. One column cannot have two meanings.' }] });
  });
});

describe('the allowlist cannot be changed at run time', () => {
  test('the registry, each capability and the list of names are frozen', () => {
    expect(Object.isFrozen(CAPABILITIES)).toBe(true);
    expect(Object.isFrozen(CAPABILITY_NAMES)).toBe(true);
    for (const capability of Object.values(CAPABILITIES)) expect(Object.isFrozen(capability), capability.name).toBe(true);
  });

  test('code cannot remove the need for approval of a capability', async () => {
    expect(() => {
      // @ts-expect-error the type also does not permit it
      CAPABILITIES.recommend_allowance.needs_approval = false;
    }).toThrow(TypeError);
    expect(CAPABILITIES.recommend_allowance.needs_approval).toBe(true);
    const result = checkRequest({ capability: 'recommend_allowance', input: { change_percent: 5, reason: 'r' } }, checks, ctx);
    let ran = false;
    expect((await execute({ result, approved_by_person: false }, { recommend_allowance: async () => ((ran = true), {}) })).status).toBe('NOT_APPROVED');
    expect(ran).toBe(false);
  });

  test('code cannot add a capability', () => {
    const open = CAPABILITIES as unknown as Record<string, unknown>;
    expect(() => { open.move_money = { ...CAPABILITIES.analyse_spending, name: 'move_money' }; }).toThrow(TypeError);
    expect(() => { (CAPABILITY_NAMES as unknown as string[]).push('move_money'); }).toThrow(TypeError);
    expect(findCapability('move_money')).toBeNull();
    expect(checkRequest({ capability: 'move_money', input: { period: 'this_cycle' } }, checks, ctx)).toMatchObject({ status: 'REJECTED', reason: 'UNKNOWN_CAPABILITY' });
    expect(Object.keys(CAPABILITIES)).toHaveLength(4);
  });
});
