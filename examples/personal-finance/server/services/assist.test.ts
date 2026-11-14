// The assist path as a service: the stand-in interpreter, the stores in memory, no network.
// Each test also proves what did NOT happen: the ledger has the same rows after each request.
import { expect, test } from 'vitest';
import type { AllowanceConsequences, AssistResponse, SpendingAnalysis } from '../../shared/contracts.assist.ts';
import type { Expense } from '../../shared/contracts.ts';
import { MAIN } from '../../shared/planning/plan-example.ts';
import { fixedClock, sequentialIds } from '../clock.ts';
import { AppError, StorageUnavailable } from '../errors.ts';
import { modelBudget } from '../intelligence/model-budget.ts';
import { fakeInterpreter, type FakeInterpreterBehaviour } from '../intelligence/permitted/fake-interpreter.ts';
import type { IntentInterpreter } from '../intelligence/permitted/interpreter.ts';
import { memoryAssistStore } from '../repositories/assist-store.ts';
import { memoryStores } from '../repositories/memory.ts';
import { seed } from '../repositories/seed.ts';
import { assist, decide, WITHOUT_AI, type AssistDeps } from './assist.ts';
import { planCycle } from './plan-cycle.ts';

const TODAY = '2026-02-03'; // in the pay cycle 2026-01-25 to 2026-02-24
const expense = (n: number, occurred_on: string, category_id: string, amount_cents: number): Expense => ({
  id: 'exp_' + n, idempotency_key: 'key-000' + n, occurred_on, amount_cents, currency: 'ZAR', merchant_name: 'Shop ' + n, merchant_key: 'shop ' + n,
  category_id, note: null, account: 'main', created_at: occurred_on + 'T10:00:0' + n + '.000Z',
});

function world(behaviour: FakeInterpreterBehaviour | 'off' = 'answer', cap = 50) {
  const stores = memoryStores();
  seed(stores, '2026-02');
  stores.income.insert({ id: 'inc_1', idempotency_key: 'pay-0001', occurred_on: '2026-01-25', amount_cents: 3_200_000, source: 'Salary', account: MAIN, created_at: '2026-01-25T06:00:00.000Z' });
  stores.expenses.insert(expense(1, '2026-02-02', 'eating-out', 12_000));
  stores.expenses.insert(expense(2, '2026-02-02', 'groceries', 45_000));
  stores.expenses.insert(expense(3, '2026-01-30', 'entertainment', 8_000));
  stores.expenses.insert(expense(4, '2026-01-28', 'groceries', 5_500));
  stores.expenses.insert(expense(5, '2026-01-10', 'groceries', 30_000)); // the cycle before
  const interpreter = behaviour === 'off' ? undefined : fakeInterpreter(behaviour);
  const clock = fixedClock(TODAY);
  const deps: AssistDeps = {
    stores, clock, ids: sequentialIds(), assist: memoryAssistStore(), interpreter, budget: modelBudget(cap, clock),
    suggest: async () => ({ suggestion: null }), resumeMapping: async () => ({}),
  };
  const ledger = () => JSON.stringify([stores.expenses.listBetween('0000-01-01', '9999-12-31'), stores.income.listBetween('0000-01-01', '9999-12-31')]);
  return { deps, stores, interpreter, ledger, before: ledger(), settings: stores.plan.getSettings()! };
}
/** The member of the answer that has this status. */
type Member<R, S> = R extends { status: infer T } ? (S extends T ? R : never) : never;
type Of<S extends AssistResponse['status']> = Member<AssistResponse, S>;
const lastAudit = (deps: AssistDeps) => deps.assist.listAudit().at(-1)!;

test('a vague text gets a question, and nothing is written', async () => {
  const w = world();
  const answer = (await assist(w.deps, { text: 'I want more control over my money' })) as Of<'CLARIFY'>;
  expect(answer.status).toBe('CLARIFY');
  expect(answer.question).toBe('What do you want to do first?');
  expect(answer.options).toHaveLength(4);
  expect([w.ledger(), w.stores.plan.getSettings(), w.deps.assist.listProposals()]).toEqual([w.before, w.settings, []]);
  expect(lastAudit(w.deps)).toEqual({ request_id: answer.request_id, at: TODAY + 'T10:00:00.000Z', capability: null, status: 'CLARIFY', reason: null, input_summary: 'text of 33 characters', model: 'stand-in' });
});

test('the model gets the text, the capability names and the active categories, and nothing more', async () => {
  const w = world();
  await assist(w.deps, { text: '  where does my money go  ' });
  const [call] = w.interpreter!.calls;
  expect(Object.keys(call!).sort()).toEqual(['capabilities', 'categories', 'text']);
  expect(call!.text).toBe('where does my money go');
  expect(call!.capabilities.map((c) => c.name)).toEqual(['analyse_spending', 'suggest_category', 'propose_column_mapping', 'recommend_allowance']);
  expect(call!.categories.every((c) => Object.keys(c).sort().join() === 'id,name')).toBe(true);
  expect(call!.categories.map((c) => c.id)).not.toContain('gym'); // not active
  expect(JSON.stringify(call)).not.toMatch(/cents|12000|Shop/);
});

test('"where does my money go": DONE, with totals that equal a direct query of the ledger', async () => {
  const w = world();
  const answer = (await assist(w.deps, { text: 'where does my money go' })) as Of<'DONE'>;
  expect([answer.status, answer.capability]).toEqual(['DONE', 'analyse_spending']);
  const output = answer.output as SpendingAnalysis;
  const direct = new Map<string, number>();
  for (const row of w.stores.expenses.listBetween('2026-01-25', '2026-02-24')) direct.set(row.category_id, (direct.get(row.category_id) ?? 0) + row.amount_cents);
  expect(Object.fromEntries(output.categories.map((c) => [c.category_id, c.total_cents]))).toEqual(Object.fromEntries(direct));
  expect(output.categories.map((c) => [c.category_id, c.total_cents, c.rows])).toEqual([['groceries', 50_500, 2], ['eating-out', 12_000, 1], ['entertainment', 8_000, 1]]);
  expect([output.total_cents, output.cycle.id, output.period, output.category_id]).toEqual([70_500, '2026-01-25', 'this_cycle', null]);
  expect([w.ledger(), w.stores.plan.getSettings(), w.deps.assist.listProposals()]).toEqual([w.before, w.settings, []]);
  expect(lastAudit(w.deps)).toMatchObject({ capability: 'analyse_spending', status: 'DONE', input_summary: 'period=(text of 10)' });
});

test('a category and the last cycle in the text: the totals of that category in that cycle', async () => {
  const w = world();
  const answer = (await assist(w.deps, { text: 'where did my groceries money go in the last cycle' })) as Of<'DONE'>;
  const output = answer.output as SpendingAnalysis;
  expect([output.period, output.cycle.id, output.category_id, output.total_cents]).toEqual(['last_cycle', '2025-12-25', 'groceries', 30_000]);
  expect(output.categories).toEqual([{ category_id: 'groceries', name: 'Groceries', kind: 'consumption', class: 'variable', total_cents: 30_000, rows: 1 }]);
});

test('"lower my weekly allowance": NEEDS_APPROVAL with the consequences in cents, and nothing changes', async () => {
  const w = world();
  const answer = (await assist(w.deps, { text: 'lower my weekly allowance' })) as Of<'NEEDS_APPROVAL'>;
  expect([answer.status, answer.capability]).toEqual(['NEEDS_APPROVAL', 'recommend_allowance']);
  const c = answer.consequences as AllowanceConsequences;
  // Headroom R10 251.00, savings R7 000.00, thus free spending R3 251.00. 10% of it is R325.10.
  expect([c.change_percent, c.free_spending_before_cents, c.free_spending_after_cents]).toEqual([-10, 325_100, 292_590]);
  expect([c.savings_before_cents, c.savings_after_cents, c.savings_request_before_cents, c.savings_request_after_cents]).toEqual([700_000, 732_510, 700_000, 732_510]);
  expect(c.weekly_caps).toHaveLength(5);
  expect(c.weekly_caps.every((week) => week.after_cents < week.before_cents)).toBe(true);
  expect(answer.description).toContain('from R3 251.00 to R2 925.90');
  expect(answer.description).toContain('Nothing changes before you approve.');
  expect([w.ledger(), w.stores.plan.getSettings()]).toEqual([w.before, w.settings]);
  expect(w.deps.assist.getProposal(answer.proposal_id)).toMatchObject({ status: 'PENDING', outcome: null, capability: 'recommend_allowance', input: { change_percent: -10 }, consequences: c });
});

test('the person declines: it is recorded, nothing is executed, and a later approval changes nothing', async () => {
  const w = world();
  const answer = (await assist(w.deps, { text: 'lower my weekly allowance' })) as Of<'NEEDS_APPROVAL'>;
  const declined = await decide(w.deps, answer.proposal_id, { approve: false });
  expect(declined).toMatchObject({ proposal_id: answer.proposal_id, status: 'DECLINED_BY_PERSON', output: null, problems: [] });
  expect(await decide(w.deps, answer.proposal_id, { approve: true })).toEqual(declined);
  expect([w.ledger(), w.stores.plan.getSettings()]).toEqual([w.before, w.settings]);
  expect(w.deps.assist.getProposal(answer.proposal_id)?.status).toBe('DECLINED_BY_PERSON');
  expect(lastAudit(w.deps)).toMatchObject({ status: 'DECLINED_BY_PERSON', capability: 'recommend_allowance', model: null });
});

test('the person approves: the settings change by exactly the consequence, the plan has the new caps, and the ledger is the same', async () => {
  const w = world();
  const answer = (await assist(w.deps, { text: 'lower my weekly allowance' })) as Of<'NEEDS_APPROVAL'>;
  const c = answer.consequences as AllowanceConsequences;
  const done = await decide(w.deps, answer.proposal_id, { approve: true });
  expect(done).toMatchObject({ status: 'EXECUTED', output: { savings_request_cents: 732_510, free_spending_cents: 292_590 }, problems: [] });
  // The only write: one number of the plan settings.
  expect(w.stores.plan.getSettings()).toEqual({ ...w.settings, savings_request_cents: 732_510 });
  expect(w.ledger()).toBe(w.before);
  const view = planCycle(w.deps);
  expect(view.weeks.map((week) => week.cap_cents)).toEqual(c.weekly_caps.map((week) => week.after_cents));
  expect([view.plan?.discretionary_cents, view.plan?.sizing.chosen_cents]).toEqual([292_590, 732_510]);

  // A second decision gets the stored outcome and changes nothing, also if it says no.
  const calls = w.interpreter!.calls.length;
  expect(await decide(w.deps, answer.proposal_id, { approve: true })).toEqual(done);
  expect(await decide(w.deps, answer.proposal_id, { approve: false })).toEqual(done);
  expect(w.stores.plan.getSettings()?.savings_request_cents).toBe(732_510);
  expect(w.interpreter!.calls.length).toBe(calls); // a decision asks no model
});

test('two approvals that arrive together execute one time', async () => {
  const w = world();
  const answer = (await assist(w.deps, { text: 'lower my weekly allowance' })) as Of<'NEEDS_APPROVAL'>;
  const [a, b] = await Promise.all([decide(w.deps, answer.proposal_id, { approve: true }), decide(w.deps, answer.proposal_id, { approve: true })]);
  expect(a).toEqual(b);
  expect(w.deps.assist.listAudit().filter((r) => r.status === 'EXECUTED')).toHaveLength(1);
});

test('the write was made, but the outcome was not stored: a second approval says EXECUTED and does not write again', async () => {
  const w = world();
  const answer = (await assist(w.deps, { text: 'lower my weekly allowance' })) as Of<'NEEDS_APPROVAL'>;
  let fail = true;
  const assistStore = { ...w.deps.assist, decideProposal: (id: string, outcome: Parameters<typeof w.deps.assist.decideProposal>[1]) => {
    if (fail) { fail = false; throw new StorageUnavailable('disk'); }
    return w.deps.assist.decideProposal(id, outcome);
  } };
  const deps = { ...w.deps, assist: assistStore };
  await expect(decide(deps, answer.proposal_id, { approve: true })).rejects.toBeInstanceOf(StorageUnavailable);
  expect(w.stores.plan.getSettings()?.savings_request_cents).toBe(732_510); // the write was made
  let writes = 0;
  const plan = { ...w.stores.plan, setSettings: (s: Parameters<typeof w.stores.plan.setSettings>[0]) => { writes += 1; w.stores.plan.setSettings(s); } };
  const again = await decide({ ...deps, stores: { ...w.stores, plan } }, answer.proposal_id, { approve: true });
  expect([again.status, again.problems, writes]).toEqual(['EXECUTED', [], 0]);
  expect(w.deps.assist.getProposal(answer.proposal_id)?.status).toBe('EXECUTED');
  expect(lastAudit(w.deps)).toMatchObject({ status: 'EXECUTED' });
});

test('the service did not complete: FAILED, the proposal still waits, and a second approval executes', async () => {
  const w = world();
  const answer = (await assist(w.deps, { text: 'lower my weekly allowance' })) as Of<'NEEDS_APPROVAL'>;
  let fail = true;
  const plan = { ...w.stores.plan, setSettings: (s: Parameters<typeof w.stores.plan.setSettings>[0]) => {
    if (fail) { fail = false; throw new StorageUnavailable('disk'); }
    w.stores.plan.setSettings(s);
  } };
  const deps = { ...w.deps, stores: { ...w.stores, plan } };
  const first = await decide(deps, answer.proposal_id, { approve: true });
  expect([first.status, first.problems[0]?.rule, first.problems[0]?.text]).toEqual(['FAILED', 'R18', 'The service for "recommend_allowance" did not complete. Try again, or do the step by hand.']);
  expect(w.deps.assist.getProposal(answer.proposal_id)).toMatchObject({ status: 'PENDING', outcome: null });
  expect(lastAudit(w.deps)).toMatchObject({ status: 'FAILED', reason: 'NOT_COMPLETED' });
  const second = await decide(deps, answer.proposal_id, { approve: true });
  expect(second.status).toBe('EXECUTED');
  expect(w.stores.plan.getSettings()?.savings_request_cents).toBe(732_510);
});

test('the facts changed after the proposal: the approval executes nothing', async () => {
  const w = world();
  const answer = (await assist(w.deps, { text: 'lower my weekly allowance' })) as Of<'NEEDS_APPROVAL'>;
  w.stores.plan.setSettings({ ...w.settings, savings_request_cents: 600_000 });
  const done = await decide(w.deps, answer.proposal_id, { approve: true });
  expect([done.status, done.output, done.problems[0]?.rule]).toEqual(['FAILED', null, 'R17']);
  expect(w.stores.plan.getSettings()?.savings_request_cents).toBe(600_000);
});

test('a capability outside the allowlist is REJECTED by name with rule R15: no proposal, no ledger row, one audit record', async () => {
  const w = world('outside');
  const answer = (await assist(w.deps, { text: 'put R500 in my savings' })) as Of<'REJECTED'>;
  expect([answer.status, answer.capability, answer.reason]).toEqual(['REJECTED', 'move_money_to_savings', 'UNKNOWN_CAPABILITY']);
  expect(answer.problems[0]?.rule).toBe('R15');
  expect(answer.problems[0]?.text).toContain('"move_money_to_savings" is not permitted');
  expect([w.ledger(), w.stores.plan.getSettings(), w.deps.assist.listProposals()]).toEqual([w.before, w.settings, []]);
  expect(w.deps.assist.listAudit()).toEqual([
    { request_id: answer.request_id, at: TODAY + 'T10:00:00.000Z', capability: 'move_money_to_savings', status: 'REJECTED', reason: 'UNKNOWN_CAPABILITY', input_summary: 'amount_cents=50000', model: 'stand-in' },
  ]);
  // An approval cannot be made from a rejected request, or from nothing.
  for (const id of [answer.request_id, 'prop_0001', 'move_money_to_savings']) {
    await expect(decide(w.deps, id, { approve: true })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  }
  expect([w.ledger(), w.stores.plan.getSettings()]).toEqual([w.before, w.settings]);
});

test('an input of the wrong shape is REJECTED with INVALID_INPUT', async () => {
  const w = world('invalid');
  const answer = (await assist(w.deps, { text: 'lower my weekly allowance' })) as Of<'REJECTED'>;
  expect([answer.status, answer.capability, answer.reason]).toEqual(['REJECTED', 'recommend_allowance', 'INVALID_INPUT']);
  expect(answer.problems.every((p) => p.rule === 'R16')).toBe(true);
  expect([w.ledger(), w.stores.plan.getSettings(), w.deps.assist.listProposals()]).toEqual([w.before, w.settings, []]);
});

test.each([['timeout', 'TIMEOUT'], ['throw', 'THREW']] as const)('a model that gives no answer (%s): MODEL_UNAVAILABLE, and the person hears what works without it', async (behaviour, reason) => {
  const w = world(behaviour);
  const answer = (await assist(w.deps, { text: 'lower my weekly allowance' })) as Of<'MODEL_UNAVAILABLE'>;
  expect([answer.status, answer.without_ai]).toEqual(['MODEL_UNAVAILABLE', WITHOUT_AI]);
  expect(lastAudit(w.deps)).toMatchObject({ status: 'MODEL_UNAVAILABLE', reason, model: 'stand-in' });
  expect([w.ledger(), w.stores.plan.getSettings(), w.deps.assist.listProposals()]).toEqual([w.before, w.settings, []]);
});

test('an answer that has no form of the port is MODEL_UNAVAILABLE, not a defect', async () => {
  const w = world();
  const odd: IntentInterpreter = { model: 'odd', interpret: async () => null as never };
  const answer = await assist({ ...w.deps, interpreter: odd }, { text: 'lower my weekly allowance' });
  expect(answer.status).toBe('MODEL_UNAVAILABLE');
  expect(lastAudit(w.deps)).toMatchObject({ reason: 'NOT_AN_ANSWER', model: 'odd' });
});

test('no interpreter: AI_OFF, with a plain message and the list of what works without it', async () => {
  const w = world('off');
  const answer = (await assist(w.deps, { text: 'lower my weekly allowance' })) as Of<'AI_OFF'>;
  expect([answer.status, answer.without_ai]).toEqual(['AI_OFF', WITHOUT_AI]);
  expect(answer.message).toContain('The AI is off');
  expect(w.deps.budget.usedToday()).toBe(0);
  expect(lastAudit(w.deps)).toMatchObject({ status: 'AI_OFF', model: null });
});

test('the cap of the day is used: DAILY_CAP, and the model is not asked', async () => {
  const none = world('answer', 0);
  expect((await assist(none.deps, { text: 'where does my money go' })).status).toBe('DAILY_CAP');
  expect(none.interpreter!.calls).toHaveLength(0);

  const one = world('answer', 1);
  expect((await assist(one.deps, { text: 'where does my money go' })).status).toBe('DONE');
  expect((await assist(one.deps, { text: 'where does my money go' })).status).toBe('DAILY_CAP');
  expect(one.interpreter!.calls).toHaveLength(1);
  expect(one.deps.assist.listAudit().map((r) => [r.status, r.model])).toEqual([['DONE', 'stand-in'], ['DAILY_CAP', null]]);
  expect(one.deps.assist.countModelCalls(TODAY)).toBe(1);
});

test('a higher allowance that needs more than the savings is REJECTED with NOT_VERIFIABLE and rule BR4', async () => {
  const w = world();
  const small = { ...w.settings, savings_request_cents: 10_000 };
  w.stores.plan.setSettings(small);
  const answer = (await assist(w.deps, { text: 'raise my weekly allowance' })) as Of<'REJECTED'>;
  expect([answer.status, answer.capability, answer.reason]).toEqual(['REJECTED', 'recommend_allowance', 'NOT_VERIFIABLE']);
  expect(answer.problems).toHaveLength(1);
  expect(answer.problems[0]?.rule).toBe('BR4');
  expect(answer.problems[0]?.text).toContain('The savings cannot be below R0.00.');
  expect([w.ledger(), w.stores.plan.getSettings(), w.deps.assist.listProposals()]).toEqual([w.before, small, []]);
});

test('a lower allowance that puts the savings above the limit of rule BR4 is REJECTED', async () => {
  const w = world();
  // A complete cycle on record with a headroom of R4 700.00: the savings of each cycle are R4 700.00 at most.
  w.stores.income.insert({ id: 'inc_0', idempotency_key: 'pay-0000', occurred_on: '2025-12-25', amount_cents: 3_200_000, source: 'Salary', account: MAIN, created_at: '2025-12-25T06:00:00.000Z' });
  w.stores.expenses.insert(expense(6, '2026-01-02', 'rent', 2_700_000));
  expect(planCycle(w.deps).plan?.sizing).toMatchObject({ sustainable_cents: 470_000, chosen_cents: 470_000, worst_cycle_id: '2025-12-25' });
  const answer = (await assist(w.deps, { text: 'lower my weekly allowance' })) as Of<'REJECTED'>;
  expect([answer.status, answer.reason, answer.problems[0]?.rule]).toEqual(['REJECTED', 'NOT_VERIFIABLE', 'BR4']);
  expect(answer.problems[0]?.text).toContain('The limit of the savings is R4 700.00');
  expect([w.stores.plan.getSettings(), w.deps.assist.listProposals()]).toEqual([w.settings, []]);
});

test.each(['move R500 to my savings account', 'which shares should I buy'])('"%s" is DECLINED: the application does not do it', async (text) => {
  const w = world();
  const answer = (await assist(w.deps, { text })) as Of<'DECLINED'>;
  expect(answer.status).toBe('DECLINED');
  expect(answer.reason).toMatch(/moves no money|no investment advice/);
  expect([w.ledger(), w.stores.plan.getSettings(), w.deps.assist.listProposals()]).toEqual([w.before, w.settings, []]);
  expect(lastAudit(w.deps)).toMatchObject({ status: 'DECLINED', capability: null });
});

test('a request with no valid text is refused with SHAPE, the model is not asked, and the audit has a record', async () => {
  const w = world();
  for (const input of [{}, { text: '   ' }, { text: 'x'.repeat(501) }, { text: 'where does my money go', extra: 1 }, null]) {
    const error = await assist(w.deps, input).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe('SHAPE');
  }
  expect(w.interpreter!.calls).toHaveLength(0);
  expect(w.deps.assist.listAudit().map((r) => [r.status, r.input_summary])).toEqual(new Array(5).fill(['SHAPE', '(no valid text)']));
  await expect(decide(w.deps, 'prop_0001', { approve: 'yes' })).rejects.toMatchObject({ code: 'SHAPE' });
});

test('the audit keeps no text of the person, also when the model copies the text into the input', async () => {
  const w = world();
  const secret = 'Sam of 12 Harbour Road';
  const copier = (capability: string, input: object): IntentInterpreter => ({ model: 'copier', interpret: async () => ({ status: 'ACTION', request: { capability, input } }) });
  const run = (capability: string, input: object) => assist({ ...w.deps, interpreter: copier(capability, input) }, { text: secret });
  expect((await run('suggest_category', { merchant_name: secret })).status).toBe('DONE');
  expect((await run('no_such_capability', { a: secret, b: secret })).status).toBe('REJECTED');
  const audit = w.deps.assist.listAudit();
  expect(audit.map((r) => r.input_summary)).toEqual(['merchant_name=(text of 22)', 'a=(text of 22) b=(text of 22)']);
  expect(JSON.stringify(audit)).not.toMatch(/Harbour|Sam/);
});

test('a question with no text, or with fewer than two answers, is not a question: MODEL_UNAVAILABLE', async () => {
  const w = world();
  const said = (output: object): IntentInterpreter => ({ model: 'odd', interpret: async () => output as never });
  const bad = [
    { status: 'CLARIFY', question: '', options: ['a', 'b'] },
    { status: 'CLARIFY', question: '  ', options: ['a', 'b'] },
    { status: 'CLARIFY', question: 'Which one?', options: 'abc' },
    { status: 'CLARIFY', question: 'Which one?', options: ['only one'] },
    { status: 'CLARIFY', question: 'Which one?', options: ['a', ' '] },
  ];
  for (const output of bad) {
    const answer = await assist({ ...w.deps, interpreter: said(output) }, { text: 'help me' });
    expect(answer.status, JSON.stringify(output)).toBe('MODEL_UNAVAILABLE');
    expect(lastAudit(w.deps)).toMatchObject({ status: 'MODEL_UNAVAILABLE', reason: 'NOT_AN_ANSWER' });
  }
  // Five answers: the first four are shown.
  const five = (await assist({ ...w.deps, interpreter: said({ status: 'CLARIFY', question: 'Which one?', options: ['a', 'b', 'c', 'd', 'e'] }) }, { text: 'help me' })) as Of<'CLARIFY'>;
  expect(five.options).toEqual(['a', 'b', 'c', 'd']);
});

test('a hidden character from the model does not reach the person', async () => {
  const w = world();
  // Word joiner, Arabic letter mark, soft hyphen, Mongolian vowel separator, Hangul filler, variation selector, interlinear annotation, a tag character.
  const hidden = [0x2060, 0x061c, 0x00ad, 0x180e, 0x3164, 0xfe0f, 0xfff9, 0xe0041].map((code) => String.fromCodePoint(code));
  const question = 'Approve' + hidden.join('') + '?';
  const interpreter: IntentInterpreter = { model: 'odd', interpret: async () => ({ status: 'CLARIFY', question, options: ['yes' + hidden[0], 'no'] }) };
  const answer = (await assist({ ...w.deps, interpreter }, { text: 'help me' })) as Of<'CLARIFY'>;
  expect(answer.status).toBe('CLARIFY');
  expect([...answer.question].every((c) => c >= ' ' && c <= '~')).toBe(true);
  expect(answer.options).toEqual(['yes', 'no']);
});

test('the audit never keeps the text of the person', async () => {
  const w = world();
  const secret = 'where does my money go, asks Sam of 12 Harbour Road';
  await assist(w.deps, { text: secret });
  await assist(w.deps, { text: 'lower my weekly allowance please, says Sam of 12 Harbour Road' });
  expect(JSON.stringify([w.deps.assist.listAudit(), w.deps.assist.listProposals()])).not.toMatch(/Harbour Road|Sam/);
});
