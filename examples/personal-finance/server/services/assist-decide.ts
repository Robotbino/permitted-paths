// Level 3. Steps 3 and 4 of the assist path: the person approves or declines, then the application executes.
// The decision is a request of the person with the id of a stored proposal. The model is not here:
// this file does not import the interpreter, and a request that the gate rejected has no proposal.
// A proposal is decided one time. A second request gets the stored outcome and changes nothing.
// Before it executes, the application asks its own facts again (the gate, a second time): a proposal
// can wait a long time, and the person approved the consequences that were shown, not different ones.
// Two failures are not final. If the service of the application did not complete, the proposal still
// waits, and the person can approve again. If the write was made but its outcome was not stored, a
// second approval finds the approved value in the settings and records EXECUTED; it does not write again.
import { AssistDecideRequest, type AllowanceConsequences, type AssistDecision, type AssistProposal } from '../../shared/contracts.assist.ts';
import type { Problem } from '../../shared/contracts.ts';
import { AppError } from '../errors.ts';
import { checkRequest, execute } from '../intelligence/permitted/action-gate.ts';
import type { AssistStore } from '../repositories/assist-store.ts';
import { assistChecks } from './assist-checks.ts';
import { assistExecutors } from './assist-executors.ts';
import type { AssistDeps } from './assist.ts';

export type DecideDeps = Omit<AssistDeps, 'interpreter' | 'budget'>;

// The decisions that run now, for each store. Two requests that arrive together get the same outcome.
const running = new WeakMap<AssistStore, Map<string, Promise<AssistDecision>>>();

type Outcome = Pick<AssistDecision, 'status' | 'output' | 'problems'> & { again?: true };

/**
 * The approved allowance change is already in the settings: the write of an earlier approval was made,
 * but its outcome was not stored. Then the outcome is EXECUTED, with no second write.
 */
function writtenBefore(deps: DecideDeps, proposal: AssistProposal): Outcome | null {
  if (proposal.capability !== 'recommend_allowance') return null;
  const c = proposal.consequences as Partial<AllowanceConsequences> | null;
  const now = deps.stores.plan.getSettings()?.savings_request_cents;
  if (typeof c?.savings_request_after_cents !== 'number' || now !== c.savings_request_after_cents || now === c.savings_request_before_cents) return null;
  return { status: 'EXECUTED', output: { savings_request_cents: now, free_spending_cents: c.free_spending_after_cents ?? null, weekly_caps: c.weekly_caps ?? [], written_before: true }, problems: [] };
}

async function outcomeOf(deps: DecideDeps, proposal: AssistProposal, approve: boolean): Promise<Outcome> {
  const failed = (problems: Problem[]) => ({ status: 'FAILED' as const, output: null, problems });
  // 3 the person declined: it is recorded, and nothing is executed.
  if (!approve) return { status: 'DECLINED_BY_PERSON', output: null, problems: [] };

  const before = writtenBefore(deps, proposal);
  if (before) return before;
  // The gate again, with the stored input and the facts of now.
  const gate = checkRequest({ capability: proposal.capability, input: proposal.input }, assistChecks(deps), { now: deps.clock.now(), request_id: proposal.request_id });
  if (gate.status === 'REJECTED') {
    return failed([{ rule: 'R16', text: 'The facts of the application changed after the proposal. Nothing is changed. Ask again.' }, ...gate.problems.map((p) => ({ ...p }))]);
  }
  if (JSON.stringify(gate.consequences) !== JSON.stringify(proposal.consequences)) {
    return failed([{ rule: 'R17', text: 'The consequences are not those that you saw when you approved. Nothing is changed. Ask again.' }]);
  }
  // 4 the application executes, with its own services.
  const result = await execute({ result: gate, approved_by_person: true }, assistExecutors(deps, gate.consequences));
  if (result.status === 'EXECUTED') return { status: 'EXECUTED', output: result.output ?? {}, problems: [] };
  // FAILED: the service threw. Nothing is decided, thus the person can approve again.
  return result.status === 'FAILED' ? { ...failed(result.problems), again: true } : failed(result.problems);
}

async function decideNow(deps: DecideDeps, proposal: AssistProposal, approve: boolean): Promise<AssistDecision> {
  const decided_at = deps.clock.now();
  const { again, ...result } = await outcomeOf(deps, proposal, approve);
  const outcome: AssistDecision = { proposal_id: proposal.id, capability: proposal.capability, decided_at, ...result };
  const audit = (reason: string | null) => deps.assist.addAudit({ request_id: deps.ids('ast'), at: decided_at, capability: proposal.capability, status: outcome.status, reason, input_summary: 'decision for the proposal ' + proposal.id, model: null });
  // The service did not complete: the proposal stays PENDING, and only the audit has a record.
  if (again) {
    audit('NOT_COMPLETED');
    return outcome;
  }
  // The store changes PENDING one time. If a different process decided first, its outcome is the answer.
  if (!deps.assist.decideProposal(proposal.id, outcome)) return deps.assist.getProposal(proposal.id)?.outcome ?? outcome;
  audit(null);
  return outcome;
}

/** The decision of the person for one proposal. An id that is not a stored proposal is NOT_FOUND: an approval cannot be made from nothing. */
export async function decide(deps: DecideDeps, proposal_id: string, input: unknown): Promise<AssistDecision> {
  const parsed = AssistDecideRequest.safeParse(input);
  if (!parsed.success) throw new AppError('SHAPE', [{ rule: 'ASSIST', text: 'The request must have one field "approve": true or false.' }]);
  const proposal = deps.assist.getProposal(proposal_id);
  if (!proposal) throw new AppError('NOT_FOUND', [{ rule: 'R17', text: 'No proposal with this id waits for a decision.' }]);
  if (proposal.outcome) return proposal.outcome;

  let ofStore = running.get(deps.assist);
  if (!ofStore) running.set(deps.assist, (ofStore = new Map()));
  const first = ofStore.get(proposal_id);
  if (first) return first;
  const work = decideNow(deps, proposal, parsed.data.approve).finally(() => ofStore.delete(proposal_id));
  ofStore.set(proposal_id, work);
  return work;
}
