// The stand-in interpreter after the adversarial review: it asks when a text is not clear, it
// answers a question about spending that has the word "pay" or "share" in it, it declines what
// the application does not do, and it gives a value for each input. Each test failed before the repair.
import { describe, expect, test } from 'vitest';
import { capabilityList } from './capabilities.ts';
import { fakeInterpreter } from './fake-interpreter.ts';
import type { InterpreterInput, InterpreterOutput } from './interpreter.ts';

const categories = [{ id: 'groceries', name: 'Groceries' }, { id: 'rent', name: 'Rent' }, { id: 'transport', name: 'Transport' }];
const ask = (text: string, list = categories): InterpreterInput => ({ text, capabilities: capabilityList(), categories: list });
const fake = fakeInterpreter();
const said = (text: string, list = categories): Promise<InterpreterOutput> => fake.interpret(ask(text, list));
const spending = (input: object) => ({ status: 'ACTION', request: { capability: 'analyse_spending', input } });
const allowance = (change_percent: number) => ({ status: 'ACTION', request: { capability: 'recommend_allowance', input: { change_percent } } });

describe('the stand-in asks; it does not guess', () => {
  test.each([
    'I want more control over my weekly spending',
    'I want more control over my weekly money',
    'Do not lower my weekly allowance',
    'Please never raise my allowance',
    'Should my allowance be lower or higher?',
  ])('"%s" gives a question', async (text) => {
    const out = await said(text);
    expect(out).toMatchObject({ status: 'CLARIFY', question: 'Do you want a lower or a higher weekly allowance?' });
    expect(out.status === 'CLARIFY' && out.options.length).toBe(3);
  });

  test('a clear wish gives a recommendation, also with the word "move" in it', async () => {
    expect(await said('I want to move to a lower weekly allowance')).toMatchObject(allowance(-10));
    expect(await said('Give me more allowance, please')).toMatchObject(allowance(10));
    expect(await said('I want to spend less each week from my allowance')).toMatchObject(allowance(-10));
  });
});

describe('a question about spending is analyse_spending', () => {
  test('the words "pay", "share" and "funds" in a question do not make it a decline', async () => {
    expect(await said('Where did my pay go this cycle?')).toEqual(spending({ period: 'this_cycle' }));
    expect(await said('How much did I pay for groceries?')).toEqual(spending({ period: 'this_cycle', category_id: 'groceries' }));
    expect(await said('How much did I pay my landlord for rent?')).toEqual(spending({ period: 'this_cycle', category_id: 'rent' }));
    expect(await said('What share of my money went to groceries?')).toEqual(spending({ period: 'this_cycle', category_id: 'groceries' }));
    expect(await said('Where did my funds go?')).toEqual(spending({ period: 'this_cycle' }));
  });

  test('a category is named by a whole word: "current" does not name the category Rent', async () => {
    expect(await said('Where did my money go in the current cycle?')).toEqual(spending({ period: 'this_cycle' }));
    expect(await said('Where did my money go? Rent?')).toEqual(spending({ period: 'this_cycle', category_id: 'rent' }));
  });

  test('a category with an empty name, or a name that is not text, names nothing', async () => {
    const odd = [{ id: 'empty', name: '' }, { id: 'spaces', name: '   ' }, { id: 'none', name: undefined as unknown as string }, ...categories];
    expect(await said('Where does my money go?', odd)).toEqual(spending({ period: 'this_cycle' }));
    expect(await said('Where does my money go?', undefined as unknown as typeof categories)).toEqual(spending({ period: 'this_cycle' }));
  });

  test('the order of the categories does not change the answer: the longest name wins', async () => {
    const list = [{ id: 'eat', name: 'Eating' }, { id: 'eat_out', name: 'Eating out' }];
    const text = 'What did I spend on eating out?';
    expect(await said(text, list)).toEqual(spending({ period: 'this_cycle', category_id: 'eat_out' }));
    expect(await said(text, [...list].reverse())).toEqual(spending({ period: 'this_cycle', category_id: 'eat_out' }));
    const same = [{ id: 'b', name: 'Food' }, { id: 'a', name: 'food' }];
    expect(await said('What did I spend on food?', same)).toEqual(await said('What did I spend on food?', [...same].reverse()));
  });

  test('more than one space or a line end in the text does not change the period', async () => {
    expect(await said('Where did my money go last  month?')).toEqual(spending({ period: 'last_cycle' }));
    expect(await said('Where did my money go in the previous\npay cycle?')).toEqual(spending({ period: 'last_cycle' }));
  });
});

describe('the stand-in declines what the application does not do', () => {
  test.each(['Wire R500 to Harbour Bank', 'Send R200 to my account at Northbank', 'How do I transfer money?', 'Pay R350 to the landlord'])('"%s" is declined: the application moves no money', async (text) => {
    expect(await said(text)).toEqual({ status: 'DECLINE', reason: 'This application moves no money. It can show your spending and recommend an allowance.' });
  });

  test.each(['Should I buy bitcoin?', 'Which funds must I buy?', 'Is it time to sell my shares?'])('"%s" is declined: no investment advice', async (text) => {
    expect(await said(text)).toEqual({ status: 'DECLINE', reason: 'This application gives no investment advice. It can show where your money went.' });
  });

  test.each(['Delete all my transactions', 'Set my balance to R1 000 000', 'Remove the transaction of yesterday'])('"%s" is declined: a request in words changes no record', async (text) => {
    expect(await said(text)).toEqual({ status: 'DECLINE', reason: 'This application changes no balance and removes no transaction from a request in words. It can show where your money went.' });
  });
});

describe('in the normal behaviour the stand-in does not throw', () => {
  test('a text that is absent or not text gives an ERROR value', async () => {
    for (const text of [undefined, null, 5, {}]) {
      expect(await fake.interpret(ask(text as unknown as string))).toEqual({ status: 'ERROR', detail: 'The request had no text.' });
    }
    expect(await fake.interpret(undefined as unknown as InterpreterInput)).toMatchObject({ status: 'ERROR' });
  });
});
