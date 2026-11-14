// A stand-in for the model that reads a request. It has the same port as the real interpreter,
// and it is fully predictable: keyword rules for the fictional scenarios.
// The tests and the recordings use it, thus they need no network, no key and no money.
// It can also behave badly on command: time out, give an input of the wrong shape, ask for a
// capability that is outside the allowlist, or throw.
// The rules are narrow on purpose. A text that does not clearly fit one rule gets a question.
import type { IntentInterpreter, InterpreterInput, InterpreterOutput } from './interpreter.ts';

export type FakeInterpreterBehaviour = 'answer' | 'timeout' | 'invalid' | 'outside' | 'throw';

/** The modest change that the stand-in recommends, in percent. */
export const FAKE_CHANGE_PERCENT = 10;

// What the application does not do.
const INVESTMENT = /\binvest\w*\b|\b(buy|sell|purchase)\b.*\b(shares?|stocks?|funds?|bonds?|etfs?|bitcoin|crypto\w*)\b|\b(shares?|stocks?|funds?|bonds?|etfs?|bitcoin|crypto\w*)\b.*\b(buy|sell|purchase)\b/;
const CHANGES_RECORDS = /\b(delete|remove|erase|wipe)\b|\b(set|change|edit|update|correct)\b.*\b(balance|transactions?)\b/;
// "move" and "pay" are an order only with money after them: "my pay" and "move to a lower allowance" are not.
const MOVES_MONEY = /\b(transfer|wire|deposit|withdraw)\b|\b(move|send)\b.*\b(money|funds|cash|savings|r ?\d+)/;
const PAYS = /\bpay (my|the|off|back|r ?\d+)/;
const ASKS_ABOUT_THE_PAST = /\b(did|have) (i|we)\b/;
// What the application does.
const ALLOWANCE = /\b(allowance|weekly)\b/;
const LOWER = /\b(lower|reduce|decrease|cut|smaller)\b|\b(less|spend less) (allowance|each week|per week|a week)\b/;
const RAISE = /\b(raise|increase|higher|larger|bigger)\b|\b(more|spend more) (allowance|each week|per week|a week)\b/;
const NOT = /\b(not|never|no|don't|dont|without)\b/;
const WHERE_IT_GOES = /\bwhere\b.*\b(go|goes|going|went)\b|\b(how much|what)\b.*\b(spend|spent|pay|paid|go|goes|went)\b|\b(show|see|analyse)\b.*\b(spending|spent)\b/;
const LAST_CYCLE = /\b(last|previous) (pay )?(cycle|month)\b/;

const DECLINE_INVESTMENT = 'This application gives no investment advice. It can show where your money went.';
const DECLINE_RECORDS = 'This application changes no balance and removes no transaction from a request in words. It can show where your money went.';
const DECLINE_MOVE = 'This application moves no money. It can show your spending and recommend an allowance.';

/** The category that the text names as a whole word. The longest name wins, then the smallest id: the order of the list does not count. */
function namedCategory(text: string, categories: InterpreterInput['categories']): string | null {
  const words = ' ' + text.replace(/[^\p{L}\p{N}]+/gu, ' ') + ' ';
  const named = (Array.isArray(categories) ? categories : [])
    .filter((c) => typeof c?.id === 'string' && typeof c?.name === 'string')
    .map((c) => ({ id: c.id, key: c.name.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim() }))
    .filter((c) => c.key !== '' && words.includes(' ' + c.key + ' '))
    .sort((a, b) => b.key.length - a.key.length || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return named[0]?.id ?? null;
}

function answer(input: InterpreterInput): InterpreterOutput {
  if (typeof input?.text !== 'string') return { status: 'ERROR', detail: 'The request had no text.' };
  const text = input.text.toLowerCase().replace(/\s+/g, ' ').trim();
  // What the application does not do comes first: no keyword after it can change the answer.
  if (INVESTMENT.test(text)) return { status: 'DECLINE', reason: DECLINE_INVESTMENT };
  if (CHANGES_RECORDS.test(text)) return { status: 'DECLINE', reason: DECLINE_RECORDS };
  if (MOVES_MONEY.test(text) || (PAYS.test(text) && !ASKS_ABOUT_THE_PAST.test(text))) return { status: 'DECLINE', reason: DECLINE_MOVE };
  // A clear wish: one direction, and no "not". "Do not lower it" gets a question, not a guess.
  const lower = LOWER.test(text);
  const raise = RAISE.test(text);
  if (ALLOWANCE.test(text) && lower !== raise && !NOT.test(text)) {
    const change_percent = lower ? -FAKE_CHANGE_PERCENT : FAKE_CHANGE_PERCENT;
    const reason = lower ? 'The person asked for a lower weekly allowance.' : 'The person asked for a higher weekly allowance.';
    return { status: 'ACTION', request: { capability: 'recommend_allowance', input: { change_percent, reason } } };
  }
  if (WHERE_IT_GOES.test(text)) {
    const category_id = namedCategory(text, input.categories);
    const period = LAST_CYCLE.test(text) ? 'last_cycle' : 'this_cycle';
    return { status: 'ACTION', request: { capability: 'analyse_spending', input: category_id === null ? { period } : { period, category_id } } };
  }
  if (ALLOWANCE.test(text)) {
    return { status: 'CLARIFY', question: 'Do you want a lower or a higher weekly allowance?', options: ['A lower allowance', 'A higher allowance', 'Show my spending first'] };
  }
  // A vague text, for example "I want more control over my money": ask, do not guess.
  return {
    status: 'CLARIFY',
    question: 'What do you want to do first?',
    options: [
      'See where my money went in this pay cycle',
      'See where my money went in the last pay cycle',
      'Get a recommendation for a lower weekly allowance',
      'Get a recommendation for a higher weekly allowance',
    ],
  };
}

export function fakeInterpreter(behaviour: FakeInterpreterBehaviour = 'answer', latencyMs = 0): IntentInterpreter & { calls: InterpreterInput[] } {
  const calls: InterpreterInput[] = [];
  return {
    model: 'stand-in',
    calls,
    async interpret(input): Promise<InterpreterOutput> {
      calls.push(input);
      if (latencyMs > 0) await new Promise((done) => setTimeout(done, latencyMs));
      // Only this behaviour throws. Each other behaviour gives a value, as the port says.
      if (behaviour === 'throw') throw new Error('the stand-in was told to throw');
      if (behaviour === 'timeout') return { status: 'TIMEOUT', detail: 'No answer in the permitted time.' };
      // A permitted capability, but the input does not have its shape.
      if (behaviour === 'invalid') return { status: 'ACTION', request: { capability: 'recommend_allowance', input: { change_percent: 'ten', reason: 7 } } };
      // A capability that the allowlist does not have.
      if (behaviour === 'outside') return { status: 'ACTION', request: { capability: 'move_money_to_savings', input: { amount_cents: 50000 } } };
      try {
        return answer(input);
      } catch {
        return { status: 'ERROR', detail: 'The stand-in could not read the request.' };
      }
    },
  };
}
