// Level 3. The real Checks of the action gate: the facts of the application (rule R16).
// The gate asks these functions; it reads no store itself. Each function only reads.
// The model gives a percentage or a mapping. The application calculates what that means, from
// its own stores and with its own pure functions (shared/planning, shared/pipeline).
import type { AllowanceConsequences } from '../../shared/contracts.assist.ts';
import type { Problem } from '../../shared/contracts.ts';
import { formatMoney, percentOf } from '../../shared/money.ts';
import { inspect, validateMapping, type MappingProfile } from '../../shared/pipeline/index.ts';
import { buildPlan } from '../../shared/planning/plan.ts';
import type { Clock } from '../clock.ts';
import type { ImportStore } from '../import/import-state.ts';
import type { Checks } from '../intelligence/permitted/action-gate.ts';
import { toMappingProfile, type ColumnMapping } from '../intelligence/permitted/capabilities.ts';
import type { Stores } from '../repositories/ports.ts';
import { planCycle } from './plan-cycle.ts';

/** What the checks read. The batch store gives only its read method. */
export type AssistFacts = { stores: Stores; clock: Clock; batches?: Pick<ImportStore, 'get'> };

type AllowanceAnswer = { ok: boolean; problems: Problem[]; consequences: object };
const no = (rule: string, text: string): AllowanceAnswer => ({ ok: false, problems: [{ rule, text }], consequences: {} });

/** The flat mapping of the gate in the form of the import pipeline, with an id that names the batch. */
export function mappingProfileFor(batch_id: string, mapping: ColumnMapping): MappingProfile {
  return toMappingProfile(mapping, 'assist-' + batch_id, 'A mapping that the model proposed');
}

/**
 * What a change of the free spending amount by a percentage does, in the pay cycle of today.
 * The headroom of the cycle is fixed, thus more free spending is less savings, by the same amount.
 * Rule BR4 is the limit: the savings cannot be below 0, and not above what each cycle on record can carry.
 */
export function allowanceConsequences(facts: AssistFacts, change_percent: number): AllowanceAnswer {
  let view;
  try {
    view = planCycle(facts);
  } catch {
    return no('BR1', 'The plan of this pay cycle cannot be read, thus the application cannot calculate the change.');
  }
  const before = view.plan;
  if (!before) return no('BR1', 'The plan of this pay cycle cannot be made, thus the application cannot calculate the change.');

  const free = before.discretionary_cents;
  // Integers only. Half a cent goes away from 0, thus +10% and -10% change the amount by the same number of cents.
  if (!Number.isSafeInteger(change_percent)) return no('R16', 'The percentage must be a whole number.');
  const delta = percentOf(free, change_percent);
  if (delta === 0) return no('BR7', 'The free spending amount of this cycle is ' + formatMoney(free) + '. A change of ' + change_percent + '% is less than 1 cent.');
  const saved = before.sizing.chosen_cents;
  const request_after = saved - delta;
  if (request_after < 0) {
    return no('BR4', 'A free spending amount of ' + formatMoney(free + delta) + ' needs ' + formatMoney(delta) + ' from the savings, and the savings of this cycle are ' + formatMoney(saved) + '. The savings cannot be below ' + formatMoney(0) + '.');
  }
  if (request_after > before.sizing.sustainable_cents) {
    return no('BR4', 'A free spending amount of ' + formatMoney(free + delta) + ' makes the savings ' + formatMoney(request_after) + '. The limit of the savings is ' + formatMoney(before.sizing.sustainable_cents) + ': ' + before.sizing.reason);
  }
  // The plan is made again with the new savings request. The figures of the consequences come from that plan.
  const after = buildPlan({ ...view.input, savings_request_cents: request_after });
  if (after.sizing.chosen_cents !== request_after || after.discretionary_cents !== free + delta) {
    return no('BR4', 'The plan cannot give a free spending amount of ' + formatMoney(free + delta) + ' in this cycle.');
  }
  const consequences: AllowanceConsequences = {
    cycle_id: view.cycle.id,
    change_percent,
    free_spending_before_cents: free,
    free_spending_after_cents: after.discretionary_cents,
    weekly_caps: before.weeks.map((week, i) => ({ index: week.index, start: week.start, end: week.end, before_cents: week.cap_cents, after_cents: after.weeks[i]!.cap_cents })),
    savings_before_cents: saved,
    savings_after_cents: after.sizing.chosen_cents,
    savings_request_before_cents: view.input.savings_request_cents,
    savings_request_after_cents: request_after,
    text:
      'Free spending of the cycle ' + view.cycle.start + ' to ' + view.cycle.end + ' goes from ' + formatMoney(free) + ' to ' + formatMoney(after.discretionary_cents)
      + ' (' + (change_percent > 0 ? '+' : '') + change_percent + '%). The savings of the cycle go from ' + formatMoney(saved) + ' to ' + formatMoney(after.sizing.chosen_cents) + '.',
  };
  return { ok: true, problems: [], consequences };
}

/** The Checks that the gate gets. A check that cannot answer gives a problem or false: the gate does not trust the value. */
export function assistChecks(facts: AssistFacts): Checks {
  return {
    categoryExists: (id) => facts.stores.categories.get(id) !== null,
    batchExists: (id) => (facts.batches ? facts.batches.get(id) !== null : false),
    mappingDryRun(batch_id, mapping) {
      const batch = facts.batches?.get(batch_id);
      if (!batch) return [{ rule: 'R16', text: 'The import batch is not in the store.' }];
      if (batch.status !== 'WAITING_FOR_MAPPING') return [{ rule: 'R14', text: 'This import does not wait for a mapping.' }];
      const csv = (batch.checkpoint as { csv?: unknown } | null)?.csv;
      if (typeof csv !== 'string') return [{ rule: 'R16', text: 'The stored file of the import batch cannot be read.' }];
      // The same gate as each mapping: a dry run on the stored file.
      return validateMapping(mappingProfileFor(batch_id, mapping), inspect(csv));
    },
    allowanceConsequences: (change_percent) => allowanceConsequences(facts, change_percent),
  };
}
