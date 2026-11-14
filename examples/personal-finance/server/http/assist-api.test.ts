// POST /api/assist and POST /api/assist/:id/decide: a real HTTP request, the real handlers and services,
// SQLite in memory, and a stand-in for the model. No network outside this computer.
// The stand-in can also give one prepared answer, for the capabilities that its keyword rules do not have.
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, expect, test } from 'vitest';
import type { PlanView } from '../../shared/contracts.plan.ts';
import { HARBOUR_ACCOUNT, UNKNOWN_SAMPLE } from '../../shared/pipeline/samples.ts';
import { MAIN } from '../../shared/planning/plan-example.ts';
import { fixedClock, sequentialIds } from '../clock.ts';
import { memoryTrace } from '../graph/trace.ts';
import { memoryImportStore } from '../import/line-worker.ts';
import { fakeInterpreter } from '../intelligence/permitted/fake-interpreter.ts';
import type { IntentInterpreter, InterpreterOutput } from '../intelligence/permitted/interpreter.ts';
import { sqliteAssistStore } from '../repositories/assist-store.ts';
import { seed } from '../repositories/seed.ts';
import { openDatabase, sqliteStores } from '../repositories/sqlite.ts';
import { createHttpServer } from './server.ts';

const db = openDatabase(':memory:');
const stores = sqliteStores(db);
seed(stores, '2026-03');
stores.income.insert({ id: 'inc_1', idempotency_key: 'pay-0001', occurred_on: '2026-03-25', amount_cents: 3_200_000, source: 'Salary', account: MAIN, created_at: '2026-03-25T06:00:00.000Z' });

const standIn = fakeInterpreter();
let prepared: InterpreterOutput | null = null;
const interpreter: IntentInterpreter = {
  model: standIn.model,
  async interpret(input) {
    const next = prepared;
    prepared = null;
    return next ?? standIn.interpret(input);
  },
};
const assistStore = sqliteAssistStore(db);
const server = createHttpServer({ stores, clock: fixedClock('2026-03-28'), ids: sequentialIds(), trace: memoryTrace(), batches: memoryImportStore(), interpreter, assistStore });
let base = '';

beforeAll(async () => {
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  base = 'http://127.0.0.1:' + (server.address() as AddressInfo).port;
});
afterAll(() => {
  server.close();
  db.close();
});

async function post(path: string, body: unknown): Promise<{ status: number; body: any }> {
  const response = await fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { status: response.status, body: await response.json() };
}
const plan = async () => (await (await fetch(base + '/api/plan')).json()) as PlanView;
const count = (table: string) => Number((db.prepare('SELECT COUNT(*) AS n FROM ' + table).get() as { n: number }).n);
const ledgerRows = () => [count('expenses'), count('income')];

test('a question about spending is answered at once, and it writes no row of the ledger', async () => {
  const answer = await post('/api/assist', { text: 'where does my money go' });
  expect([answer.status, answer.body.status, answer.body.capability]).toEqual([200, 'DONE', 'analyse_spending']);
  expect(answer.body.output).toMatchObject({ period: 'this_cycle', cycle: { id: '2026-03-25' }, total_cents: 0, categories: [] });
  expect(ledgerRows()).toEqual([0, 1]);
});

test('a lower allowance: the proposal, the approval in a second request, and GET /api/plan shows the new caps', async () => {
  const before = await plan();
  const proposed = await post('/api/assist', { text: 'lower my weekly allowance' });
  expect([proposed.status, proposed.body.status]).toEqual([200, 'NEEDS_APPROVAL']);
  const c = proposed.body.consequences;
  expect(c.weekly_caps.map((w: { before_cents: number }) => w.before_cents)).toEqual(before.weeks.map((w) => w.cap_cents));
  // Nothing changed yet.
  expect(await plan()).toEqual(before);

  const decided = await post('/api/assist/' + proposed.body.proposal_id + '/decide', { approve: true });
  expect([decided.status, decided.body.status]).toEqual([200, 'EXECUTED']);
  const after = await plan();
  expect(after.weeks.map((w) => w.cap_cents)).toEqual(c.weekly_caps.map((w: { after_cents: number }) => w.after_cents));
  expect(after.input.savings_request_cents).toBe(c.savings_request_after_cents);
  expect(after.plan?.discretionary_cents).toBe(c.free_spending_after_cents);
  expect(before.input.savings_request_cents - after.input.savings_request_cents).toBe(c.free_spending_after_cents - c.free_spending_before_cents);

  // The same decision again: the stored outcome, and the plan stays as it is.
  expect((await post('/api/assist/' + proposed.body.proposal_id + '/decide', { approve: true })).body).toEqual(decided.body);
  expect(await plan()).toEqual(after);
  expect(ledgerRows()).toEqual([0, 1]);
});

test('a capability that is not in the allowlist: 200 with REJECTED, and an approval for it is 404', async () => {
  prepared = { status: 'ACTION', request: { capability: 'move_money_to_savings', input: { amount_cents: 50_000 } } };
  const proposals = count('assist_proposals');
  const answer = await post('/api/assist', { text: 'put R500 in my savings' });
  expect([answer.status, answer.body.status, answer.body.reason, answer.body.problems[0].rule]).toEqual([200, 'REJECTED', 'UNKNOWN_CAPABILITY', 'R15']);
  expect(count('assist_proposals')).toBe(proposals);
  expect(assistStore.listAudit().at(-1)).toMatchObject({ request_id: answer.body.request_id, status: 'REJECTED', capability: 'move_money_to_savings' });
  for (const id of [answer.body.request_id, 'prop_9999']) {
    const forged = await post('/api/assist/' + id + '/decide', { approve: true });
    expect([forged.status, forged.body.error.code]).toEqual([404, 'NOT_FOUND']);
  }
  expect(ledgerRows()).toEqual([0, 1]);
});

test('a request that has no text, or a decision that has no answer, is 400', async () => {
  const noText = await post('/api/assist', { words: 'lower my weekly allowance' });
  expect([noText.status, noText.body.error.code]).toEqual([400, 'SHAPE']);
  const noAnswer = await post('/api/assist/prop_0001/decide', {});
  expect([noAnswer.status, noAnswer.body.error.code]).toEqual([400, 'SHAPE']);
});

test('a suggestion for a merchant runs the suggest graph of the application', async () => {
  prepared = { status: 'ACTION', request: { capability: 'suggest_category', input: { merchant_name: 'Greenleaf Market' } } };
  const answer = await post('/api/assist', { text: 'which category is Greenleaf Market' });
  expect([answer.status, answer.body.status, answer.body.capability]).toEqual([200, 'DONE', 'suggest_category']);
  // This server has no suggester and no merchant memory: the graph answers that the AI is off.
  expect(answer.body.output).toMatchObject({ suggestion: null, reason: 'AI_OFF' });
});

test('a mapping for an import: the dry run on the stored file, the approval, then the mapping step of the import', async () => {
  const started = await post('/api/imports', { csv: UNKNOWN_SAMPLE, account: HARBOUR_ACCOUNT });
  expect(started.body.step).toBe('mapping');
  const batch_id: string = started.body.batch_id;
  const mapping = { date: 'When', description: 'What', debit: 'Money out', credit: 'Money in', date_format: 'MM/DD/YYYY', decimal: '.' };

  // A column that is not in the file: the gate says no, with the problem of the mapping gate.
  prepared = { status: 'ACTION', request: { capability: 'propose_column_mapping', input: { batch_id, mapping: { ...mapping, date: 'Day' } } } };
  const wrong = await post('/api/assist', { text: 'map the columns of my statement' });
  expect([wrong.body.status, wrong.body.reason, wrong.body.problems[0].rule]).toEqual(['REJECTED', 'NOT_VERIFIABLE', 'MAP-COLUMN']);

  // A batch that is not in the store.
  prepared = { status: 'ACTION', request: { capability: 'propose_column_mapping', input: { batch_id: 'imp-000000000000', mapping } } };
  expect((await post('/api/assist', { text: 'map the columns of my statement' })).body).toMatchObject({ status: 'REJECTED', reason: 'NOT_VERIFIABLE' });

  prepared = { status: 'ACTION', request: { capability: 'propose_column_mapping', input: { batch_id, mapping } } };
  const proposed = await post('/api/assist', { text: 'map the columns of my statement' });
  expect([proposed.body.status, proposed.body.consequences]).toEqual(['NEEDS_APPROVAL', null]);
  expect(proposed.body.description).toContain('date = "When"');

  const decided = await post('/api/assist/' + proposed.body.proposal_id + '/decide', { approve: true });
  expect(decided.body.status).toBe('EXECUTED');
  expect(decided.body.output).toMatchObject({ step: 'review', batch_id });
  expect(decided.body.output.lines).toHaveLength(5);
  // The import now waits for the person. No line is recorded.
  expect(ledgerRows()).toEqual([0, 1]);

  // The batch does not wait for a mapping now: the same request is rejected by the gate.
  prepared = { status: 'ACTION', request: { capability: 'propose_column_mapping', input: { batch_id, mapping } } };
  expect((await post('/api/assist', { text: 'map the columns of my statement' })).body).toMatchObject({ status: 'REJECTED', reason: 'NOT_VERIFIABLE', problems: [{ rule: 'R14' }] });
});
