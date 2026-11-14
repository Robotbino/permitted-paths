// A stand-in for the model. It has the same port as the real suggester, and it is fully predictable.
// The tests and the recordings use it, thus they need no network, no key and no money.
// It can also behave badly on command: time out, or answer with a category that does not exist.
import { UNKNOWN, type CategorySuggester, type SuggesterInput, type SuggesterOutput } from './suggester.ts';

export type FakeBehaviour = 'answer' | 'timeout' | 'not_permitted' | 'throw';

const KEYWORDS: Array<[word: string, category_id: string]> = [
  ['woolworths', 'groceries'], ['checkers', 'groceries'], ['pick n pay', 'groceries'], ['spar', 'groceries'],
  ['engen', 'transport'], ['shell', 'transport'], ['uber', 'transport'], ['gautrain', 'transport'],
  ['nando', 'eating-out'], ['steers', 'eating-out'], ['cafe', 'eating-out'],
  ['eskom', 'utilities'], ['city power', 'utilities'], ['telkom', 'utilities'],
  ['dis-chem', 'health'], ['clicks', 'health'], ['pharmacy', 'health'],
  ['ster-kinekor', 'entertainment'], ['showmax', 'entertainment'],
];

export function fakeSuggester(behaviour: FakeBehaviour = 'answer'): CategorySuggester & { calls: SuggesterInput[] } {
  const calls: SuggesterInput[] = [];
  return {
    model: 'stand-in',
    calls,
    async suggest(input): Promise<SuggesterOutput> {
      calls.push(input);
      if (behaviour === 'throw') throw new Error('the stand-in was told to throw');
      if (behaviour === 'timeout') return { status: 'TIMEOUT', detail: 'No answer in the permitted time.' };
      if (behaviour === 'not_permitted') return { status: 'OK', category_id: 'crypto-investments', input_tokens: 60, output_tokens: 8 };
      const name = input.merchant_name.toLowerCase();
      const hit = KEYWORDS.find(([word]) => name.includes(word));
      return { status: 'OK', category_id: hit ? hit[1] : UNKNOWN, input_tokens: 60, output_tokens: 8 };
    },
  };
}
