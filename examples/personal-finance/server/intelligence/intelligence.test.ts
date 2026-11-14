// The small parts of the intelligence layer, each alone: the gate, the memory, the adapter of the real model.
// The adapter is tested with a stand-in client. No test calls the real API.
import Anthropic from '@anthropic-ai/sdk';
import { describe, expect, test } from 'vitest';
import { seed } from '../repositories/seed.ts';
import { openDatabase, sqliteStores } from '../repositories/sqlite.ts';
import { buildSystemPrompt, claudeSuggester, type MessagesClient } from './claude-suggester.ts';
import { memoryMerchantMemory, sqliteMerchantMemory, type MerchantMemory } from './merchant-memory.ts';
import { suggestionGate } from './suggestion-gate.ts';

const categories = [{ id: 'groceries', name: 'Groceries', active: true }, { id: 'gym', name: 'Gym (closed)', active: false }];

describe('the suggestion gate (R12)', () => {
  test('an active category is accepted', () => {
    expect(suggestionGate('groceries', categories)).toEqual({ accepted: categories[0], problems: [] });
  });
  test('UNKNOWN is a permitted answer with no suggestion and no problem', () => {
    expect(suggestionGate('UNKNOWN', categories)).toEqual({ accepted: null, problems: [] });
  });
  test('a category that does not exist, or that is not active, is FAIL', () => {
    expect(suggestionGate('crypto-investments', categories).problems.map((p) => p.rule)).toEqual(['R12']);
    expect(suggestionGate('gym', categories).problems.map((p) => p.rule)).toEqual(['R12']);
    expect(suggestionGate('Groceries', categories).accepted).toBeNull(); // the name is not the id
  });
});

const sqliteMemory = () => {
  const db = openDatabase(':memory:');
  seed(sqliteStores(db), '2026-03');
  return sqliteMerchantMemory(db);
};
describe.each([['memory', memoryMerchantMemory], ['sqlite', sqliteMemory]] as Array<[string, () => MerchantMemory]>)('the merchant memory: %s', (_name, make) => {
  test('it remembers, counts the confirmations, and starts again when the person changes the category', () => {
    const memory = make();
    expect(memory.recall('engen garage')).toBeNull();
    memory.remember('engen garage', 'transport', '2026-03-01', 'run_1');
    memory.remember('engen garage', 'transport', '2026-03-08', 'run_2');
    expect(memory.recall('engen garage')).toEqual({ merchant_key: 'engen garage', category_id: 'transport', times_confirmed: 2, last_confirmed_on: '2026-03-08', source_run_id: 'run_2' });
    memory.remember('engen garage', 'eating-out', '2026-03-14', 'run_3');
    expect(memory.recall('engen garage')).toMatchObject({ category_id: 'eating-out', times_confirmed: 1 });
  });
});

describe('the adapter of the real model, with a stand-in client', () => {
  const settings = { apiKey: 'test-key-not-real', model: 'claude-haiku-5-5', timeoutMs: 4000 };
  const input = { merchant_name: 'Engen Garage', categories: [{ id: 'transport', name: 'Transport' }, { id: 'groceries', name: 'Groceries' }] };
  const clientThat = (parse: (params: any, options: any) => unknown): MessagesClient => ({ messages: { parse: parse as MessagesClient['messages']['parse'] } });
  const answer = (category_id: string | null, stop_reason = 'end_turn') => ({ parsed_output: category_id === null ? null : { category_id }, stop_reason, usage: { input_tokens: 210, output_tokens: 9 } });

  test('the request: the configured model, a time limit, no second try, and only the merchant text', async () => {
    let seen: { params: any; options: any } | null = null;
    const suggester = claudeSuggester(settings, clientThat((params, options) => { seen = { params, options }; return answer('transport'); }));
    expect(await suggester.suggest(input)).toEqual({ status: 'OK', category_id: 'transport', input_tokens: 210, output_tokens: 9 });
    expect(seen!.params.model).toBe('claude-haiku-5-5');
    expect(seen!.params.messages).toEqual([{ role: 'user', content: 'Merchant: Engen Garage' }]);
    expect(seen!.params.system).toContain('- transport (Transport)');
    expect(seen!.params.output_config.effort).toBe('low');
    expect(seen!.params.output_config.format.type).toBe('json_schema');
    expect(seen!.options).toEqual({ timeout: 4000, maxRetries: 0 });
    expect(JSON.stringify(seen)).not.toContain('test-key-not-real'); // the key is in the client, never in a request body
  });

  test('the structured output permits only the ids of this request, and UNKNOWN', async () => {
    let schema: any = null;
    await claudeSuggester(settings, clientThat((params) => { schema = params.output_config.format.schema; return answer('UNKNOWN'); })).suggest(input);
    expect(schema.properties.category_id.enum).toEqual(['UNKNOWN', 'transport', 'groceries']);
  });

  test('each failure of the model is a value; the adapter does not throw', async () => {
    const failing = (error: unknown) => claudeSuggester(settings, clientThat(() => { throw error; })).suggest(input);
    expect((await failing(new Anthropic.APIConnectionTimeoutError())).status).toBe('TIMEOUT');
    expect((await failing(new Error('socket closed'))).status).toBe('ERROR');
    expect((await claudeSuggester(settings, clientThat(() => answer(null, 'refusal'))).suggest(input)).status).toBe('REFUSED');
    expect((await claudeSuggester(settings, clientThat(() => answer(null, 'max_tokens'))).suggest(input)).status).toBe('ERROR');
  });

  test('the prompt is a file: the list of categories goes into it, and it says that the merchant text is data', () => {
    const prompt = buildSystemPrompt('A\r\n{{categories}}\r\nB', input.categories);
    expect(prompt).toBe('A\n- transport (Transport)\n- groceries (Groceries)\nB');
  });
});
