// The allowlist: the complete list of what a model is permitted to request.
// A model can interpret the text of a person in a different way on each run. The application
// cannot control that. It controls this list, and it checks each request against it (rule R15).
//
// The list has no capability that moves money, changes a balance, changes or removes a
// transaction, or runs code. That which is not in the list cannot be requested.
// One capability (recommend_allowance) can, after the approval of the person, change one setting
// of the plan. The application calculates the new figures; the model gives only a percentage.
// Four different things stay different: the model RECOMMENDS, the application VALIDATES,
// the person APPROVES, the application EXECUTES.
// The list is frozen. Code that runs later cannot add a capability or remove a need for approval.
import type { z } from 'zod';
import { AnalyseSpendingInput, ProposeColumnMappingInput, RecommendAllowanceInput, SuggestCategoryInput } from './inputs.ts';

export * from './inputs.ts';

export const CAPABILITY_NAMES = Object.freeze(['analyse_spending', 'suggest_category', 'propose_column_mapping', 'recommend_allowance'] as const);
export type CapabilityName = (typeof CAPABILITY_NAMES)[number];

/** One entry of the allowlist. No field can be changed: not in the types, and not at run time. */
export type Capability = Readonly<{
  name: CapabilityName;
  /** One sentence. The model reads it. */
  purpose: string;
  /** The check of shape. strictObject: a field that is not in the schema is a problem. */
  input: z.ZodType<object>;
  /** true: the application does nothing before the person says yes (rule R17). */
  needs_approval: boolean;
  /** true: the action changes stored data when the application executes it. */
  changes_data: boolean;
  model_does: string;
  application_does: string;
}>;

const entry = (capability: Capability): Capability => Object.freeze(capability);

export const CAPABILITIES: Readonly<Record<CapabilityName, Capability>> = Object.freeze({
  analyse_spending: entry({
    name: 'analyse_spending',
    purpose: 'Show where the money of one pay cycle went, for all categories or for one category.',
    input: AnalyseSpendingInput,
    needs_approval: false,
    changes_data: false,
    model_does: 'The model selects the pay cycle and, if the person named one, the category.',
    application_does: 'The application reads its own ledger and calculates each total.',
  }),
  suggest_category: entry({
    name: 'suggest_category',
    purpose: 'Propose a category for one merchant name.',
    input: SuggestCategoryInput,
    needs_approval: false,
    changes_data: false,
    model_does: 'The model gives the merchant name that the person wrote.',
    application_does: 'The application runs its suggest graph and shows the proposal in the form, where the person accepts or changes it.',
  }),
  propose_column_mapping: entry({
    name: 'propose_column_mapping',
    purpose: 'Propose which column of an imported statement is the date, the description and the amount.',
    input: ProposeColumnMappingInput,
    needs_approval: true,
    changes_data: true,
    model_does: 'The model proposes a column for each meaning, a date format and a decimal mark.',
    application_does: 'The application tries the mapping on the lines of the batch and applies it only after the person approves.',
  }),
  recommend_allowance: entry({
    name: 'recommend_allowance',
    purpose: 'Recommend a change of the weekly allowance, as a percentage.',
    input: RecommendAllowanceInput,
    needs_approval: true,
    changes_data: true,
    model_does: 'The model recommends a percentage and gives a short reason.',
    application_does: 'The application calculates the new allowance and its consequences in cents and shows them before the person approves.',
  }),
});

/** The capability with this name, or null. Only own names of the allowlist count: "constructor" is not a capability. */
export function findCapability(name: string): Capability | null {
  return typeof name === 'string' && Object.hasOwn(CAPABILITIES, name) ? CAPABILITIES[name as CapabilityName] : null;
}

/** What the interpreter gets: the name and the purpose of each capability, and nothing more. */
export function capabilityList(): Array<{ name: string; purpose: string }> {
  return CAPABILITY_NAMES.map((name) => ({ name, purpose: CAPABILITIES[name].purpose }));
}
