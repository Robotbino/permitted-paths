// One suite, two implementations, for the store of the assist path: the audit records and the proposals.
// If memory and SQLite both pass, a test of the assist service with the store in memory tells the truth.
import { describe, expect, test } from 'vitest';
import type { AssistAudit, AssistDecision, AssistProposal } from '../../shared/contracts.assist.ts';
import { DuplicateKey } from '../errors.ts';
import { memoryAssistStore, sqliteAssistStore, type AssistStore } from './assist-store.ts';
import { openDatabase } from './sqlite.ts';

const audit = (n: number, over: Partial<AssistAudit> = {}): AssistAudit => ({
  request_id: 'ast_000' + n, at: '2026-02-03T10:00:0' + n + '.000Z', capability: null, status: 'CLARIFY', reason: null, input_summary: 'text of 12 characters', model: 'stand-in', ...over,
});
const proposal = (n: number, over: Partial<AssistProposal> = {}): AssistProposal => ({
  id: 'prop_000' + n, request_id: 'ast_000' + n, capability: 'recommend_allowance', input: { change_percent: -10, reason: 'The person asked.' },
  consequences: { savings_request_after_cents: 732_510, weekly_caps: [{ index: 1, after_cents: 66_073 }] }, description: 'Free spending goes down.',
  created_at: '2026-02-03T10:00:0' + n + '.000Z', status: 'PENDING', outcome: null, ...over,
});
const outcome = (n: number, status: AssistDecision['status']): AssistDecision => ({
  proposal_id: 'prop_000' + n, capability: 'recommend_allowance', status, output: status === 'EXECUTED' ? { savings_request_cents: 732_510 } : null,
  problems: status === 'FAILED' ? [{ rule: 'R18', text: 'The service did not complete.' }] : [], decided_at: '2026-02-03T11:00:00.000Z',
});

const implementations: Array<[string, () => AssistStore]> = [
  ['memory', () => memoryAssistStore()],
  ['sqlite', () => sqliteAssistStore(openDatabase(':memory:'))],
];

describe.each(implementations)('the store of the assist path: %s', (_name, make) => {
  test('a new store has no record and no proposal', () => {
    const store = make();
    expect(store.listAudit()).toEqual([]);
    expect(store.listProposals()).toEqual([]);
    expect(store.getProposal('prop_0001')).toBeNull();
    expect(store.countModelCalls('2026-02-03')).toBe(0);
  });

  test('an audit record that goes in comes out the same, and the oldest is first', () => {
    const store = make();
    store.addAudit(audit(2, { capability: 'move_money_to_savings', status: 'REJECTED', reason: 'UNKNOWN_CAPABILITY', input_summary: 'amount_cents=50000' }));
    store.addAudit(audit(1, { model: null, status: 'AI_OFF' }));
    expect(store.listAudit()).toEqual([
      audit(1, { model: null, status: 'AI_OFF' }),
      audit(2, { capability: 'move_money_to_savings', status: 'REJECTED', reason: 'UNKNOWN_CAPABILITY', input_summary: 'amount_cents=50000' }),
    ]);
  });

  test('a second audit record with the same request id is refused', () => {
    const store = make();
    store.addAudit(audit(1));
    expect(() => store.addAudit(audit(1, { status: 'DONE' }))).toThrow(DuplicateKey);
    expect(store.listAudit()).toEqual([audit(1)]);
  });

  test('the count of model calls: only the records of that day that have a model', () => {
    const store = make();
    store.addAudit(audit(1));
    store.addAudit(audit(2, { status: 'MODEL_UNAVAILABLE', reason: 'TIMEOUT' }));
    store.addAudit(audit(3, { model: null, status: 'DAILY_CAP' }));
    store.addAudit(audit(4, { at: '2026-02-04T00:00:01.000Z' }));
    expect(store.countModelCalls('2026-02-03')).toBe(2);
    expect(store.countModelCalls('2026-02-04')).toBe(1);
    expect(store.countModelCalls('2026-02-05')).toBe(0);
  });

  test('a proposal that goes in comes out the same, also with no consequences', () => {
    const store = make();
    store.insertProposal(proposal(2, { capability: 'propose_column_mapping', input: { batch_id: 'imp-1', mapping: { date: 'When' } }, consequences: null }));
    store.insertProposal(proposal(1));
    expect(store.getProposal('prop_0001')).toEqual(proposal(1));
    expect(store.getProposal('prop_0002')?.consequences).toBeNull();
    expect(store.listProposals().map((p) => p.id)).toEqual(['prop_0001', 'prop_0002']);
    expect(() => store.insertProposal(proposal(1))).toThrow(DuplicateKey);
  });

  test('what the store gives is a copy: a change of it does not change the stored proposal', () => {
    const store = make();
    store.insertProposal(proposal(1));
    (store.getProposal('prop_0001')!.input as { change_percent: number }).change_percent = 50;
    expect(store.getProposal('prop_0001')).toEqual(proposal(1));
  });

  test('a proposal is decided one time: the second decision changes nothing', () => {
    const store = make();
    store.insertProposal(proposal(1));
    expect(store.decideProposal('prop_0001', outcome(1, 'EXECUTED'))).toBe(true);
    expect(store.decideProposal('prop_0001', outcome(1, 'DECLINED_BY_PERSON'))).toBe(false);
    expect(store.getProposal('prop_0001')).toEqual(proposal(1, { status: 'EXECUTED', outcome: outcome(1, 'EXECUTED') }));
  });

  test('a decision for an id that is not in the store is refused', () => {
    const store = make();
    expect(store.decideProposal('prop_0009', outcome(9, 'EXECUTED'))).toBe(false);
    expect(store.listProposals()).toEqual([]);
  });

  test('each status of a decision is stored with its outcome', () => {
    const store = make();
    for (const [n, status] of [[1, 'DECLINED_BY_PERSON'], [2, 'FAILED']] as const) {
      store.insertProposal(proposal(n));
      expect(store.decideProposal('prop_000' + n, outcome(n, status))).toBe(true);
      expect(store.getProposal('prop_000' + n)).toMatchObject({ status, outcome: outcome(n, status) });
    }
  });
});
