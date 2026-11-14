// Level 3. The executors of the assist path: the services of the application, one for each capability (rule R18).
// No model code is here. An executor gets an input that passed the gate two times (action-gate.ts, execute.ts).
// Three executors only read or start an existing path of the application that has its own gates.
// One executor writes: recommend_allowance changes one number of the plan settings. It writes the
// value that the application calculated and the person saw, and it runs only after the person approved.
import type { AllowanceConsequences, SpendingAnalysis } from '../../shared/contracts.assist.ts';
import type { MappingProfile } from '../../shared/pipeline/index.ts';
import { cycleContaining, previousCycle } from '../../shared/planning/pay-cycle.ts';
import type { Executors } from '../intelligence/permitted/action-gate.ts';
import type { AnalyseSpendingInput, ProposeColumnMappingInput, SuggestCategoryInput } from '../intelligence/permitted/capabilities.ts';
import { mappingProfileFor, type AssistFacts } from './assist-checks.ts';
import { ledgerRowsUpTo } from './plan-ledger.ts';

export type ExecutorDeps = AssistFacts & {
  /** The suggest graph of level 3, with its own gate. It writes nothing. */
  suggest(merchant_name: string): Promise<object>;
  /** The mapping step of the import graph. The mapping passes the mapping gate there again. */
  resumeMapping(batch_id: string, mapping: MappingProfile): Promise<object>;
};

/** The totals of one pay cycle, by category, from the ledger. Code calculates each number. */
export function analyseSpending(facts: AssistFacts, input: AnalyseSpendingInput): SpendingAnalysis {
  const settings = facts.stores.plan.getSettings();
  if (!settings) throw new Error('no plan settings are on record');
  const now = cycleContaining(facts.clock.today(), settings.payday);
  const cycle = input.period === 'last_cycle' ? previousCycle(now, settings.payday) : now;
  const wanted = input.category_id ?? null;
  const rows = ledgerRowsUpTo(facts.stores, cycle.end).filter((row) => row.occurred_on >= cycle.start && (wanted === null || row.category_id === wanted));
  const names = new Map(facts.stores.categories.list().map((c) => [c.id, c.name]));
  const totals = new Map<string, SpendingAnalysis['categories'][number]>();
  for (const row of rows) {
    const entry = totals.get(row.category_id) ?? { category_id: row.category_id, name: names.get(row.category_id) ?? row.category_id, kind: row.kind, class: row.class, total_cents: 0, rows: 0 };
    entry.total_cents += row.amount_cents;
    entry.rows += 1;
    totals.set(row.category_id, entry);
  }
  return {
    period: input.period,
    cycle: { id: cycle.id, start: cycle.start, end: cycle.end },
    category_id: wanted,
    total_cents: rows.reduce((sum, row) => sum + row.amount_cents, 0),
    categories: [...totals.values()].sort((a, b) => b.total_cents - a.total_cents || a.category_id.localeCompare(b.category_id)),
  };
}

/** The one write of the assist path: the savings request of the plan settings gets the value of the consequences. */
function applyAllowance(facts: AssistFacts, consequences: object | null): object {
  const c = consequences as Partial<AllowanceConsequences> | null;
  const value = c?.savings_request_after_cents;
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new Error('the consequences have no savings request');
  const settings = facts.stores.plan.getSettings();
  if (!settings) throw new Error('no plan settings are on record');
  facts.stores.plan.setSettings({ ...settings, savings_request_cents: value });
  return { savings_request_cents: value, free_spending_cents: c?.free_spending_after_cents ?? null, weekly_caps: c?.weekly_caps ?? [] };
}

/**
 * The executors for one result of the gate. `consequences` are those of that result: the executor of
 * recommend_allowance writes the number that the gate calculated, not a number from the model.
 */
export function assistExecutors(deps: ExecutorDeps, consequences: object | null): Executors {
  return {
    analyse_spending: async (input) => analyseSpending(deps, input as AnalyseSpendingInput),
    suggest_category: (input) => deps.suggest((input as SuggestCategoryInput).merchant_name),
    propose_column_mapping: (input) => {
      const { batch_id, mapping } = input as ProposeColumnMappingInput;
      return deps.resumeMapping(batch_id, mappingProfileFor(batch_id, mapping));
    },
    recommend_allowance: async () => applyAllowance(deps, consequences),
  };
}
