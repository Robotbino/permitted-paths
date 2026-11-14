// The suggestion gate: a deterministic check of what the model (or the memory) proposed.
// The structured output already asks the model for a permitted id. The gate still checks, for three reasons:
// the stand-in and a future model adapter can be wrong, a category can become inactive after it was
// remembered, and a check that code does costs nothing. Rule R12.
import type { Category, Problem } from '../../shared/contracts.ts';
import { UNKNOWN } from './suggester.ts';

export type GateVerdict = { accepted: Category | null; problems: Problem[] };

export function suggestionGate(proposed_id: string, categories: Category[]): GateVerdict {
  if (proposed_id === UNKNOWN) return { accepted: null, problems: [] }; // "I do not know" is a permitted answer
  const category = categories.find((c) => c.id === proposed_id);
  if (!category) return { accepted: null, problems: [{ rule: 'R12', text: 'The suggestion "' + proposed_id.slice(0, 40) + '" is not a category of the store.' }] };
  if (!category.active) return { accepted: null, problems: [{ rule: 'R12', text: 'The suggested category "' + category.name + '" is not active.' }] };
  return { accepted: category, problems: [] };
}
