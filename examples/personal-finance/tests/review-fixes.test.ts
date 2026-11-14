// One test for each defect that an adversarial review found after level 4.
// Each test failed before its fix. The 155 tests that existed then did not see these defects:
// they tested the paths that the author thought about.
import { expect, test } from 'vitest';
import { STATEMENT, makeWorld, send } from '../scripts/scenarios.ts';
import { fixedClock } from '../server/clock.ts';
import { merchantKey } from '../server/domain/expense.ts';
import { modelBudget } from '../server/intelligence/model-budget.ts';
import { initialState, reduce } from '../web/src/state.ts';

const expense = { idempotency_key: 'key-0001', amount_cents: 18500, currency: 'ZAR', occurred_on: '2026-03-14', merchant_name: 'Woolworths', category_id: 'groceries' };

test('a malformed address does not stop the server', async () => {
  const world = await makeWorld();
  try {
    // Before the fix, each of these threw outside the error handler and the process ended.
    for (const path of ['/%', '/a%ff', '/%E0%A4%A', '//']) {
      const response = await fetch(world.base + path);
      expect(response.status, path).toBeLessThan(500);
    }
    expect((await fetch(world.base + '/api/health')).status).toBe(200); // the server is still there
  } finally {
    await world.close();
  }
});

test('an Origin that is not a URL is a different site (403), not a defect (500)', async () => {
  const world = await makeWorld();
  try {
    for (const origin of ['null', 'not a url']) {
      const response = await fetch(world.base + '/api/expenses', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify(expense) });
      expect(response.status, origin).toBe(403);
    }
    expect(world.rows()).toBe(0);
  } finally {
    await world.close();
  }
});

test('the daily limit holds when ten requests arrive together', async () => {
  const world = await makeWorld({ memory: true, ai: 'answer', dailyCap: 2, latencyMs: 30 });
  try {
    const answers = await Promise.all(Array.from({ length: 10 }, (_, i) => send(world, '/api/expenses/suggest', { merchant_name: 'Engen Garage ' + i })));
    expect(world.modelCalls()).toBe(2); // before the fix: 10
    expect(answers.filter((a) => a.body.reason === 'DAILY_CAP')).toHaveLength(8);
  } finally {
    await world.close();
  }
});

test('the daily limit holds when the trace cannot be saved', async () => {
  const world = await makeWorld({ memory: true, ai: 'answer', dailyCap: 2 });
  try {
    world.app.trace!.save = () => { throw new Error('disk full'); };
    for (let i = 0; i < 6; i += 1) await send(world, '/api/expenses/suggest', { merchant_name: 'Shell ' + i });
    expect(world.modelCalls()).toBe(2); // before the fix: 6, because a call that is not in the trace was not counted
  } finally {
    await world.close();
  }
});

test('an import and the form share one budget', async () => {
  const world = await makeWorld({ memory: true, ai: 'answer', dailyCap: 5, importBudget: 4 });
  try {
    const proposal = await send(world, '/api/imports', { csv: STATEMENT });
    expect(proposal.body.budget.model_calls_allowed).toBe(4);
    const one = await send(world, '/api/expenses/suggest', { merchant_name: 'Gautrain' });
    const two = await send(world, '/api/expenses/suggest', { merchant_name: 'Telkom' });
    expect([one.body.reason, two.body.reason, world.modelCalls()]).toEqual(['FROM_MODEL', 'DAILY_CAP', 5]);
  } finally {
    await world.close();
  }
});

test('the budget: a reservation is counted immediately; a new day starts again; a limit that is not a number gives no calls', () => {
  let today = '2026-03-14';
  const clock = { ...fixedClock('2026-03-14'), today: () => today };
  const budget = modelBudget(3, clock, () => 1); // the trace says: 1 call already today
  expect([budget.reserve(1), budget.reserve(5), budget.reserve(1), budget.usedToday()]).toEqual([1, 1, 0, 3]);
  today = '2026-03-15';
  expect(budget.reserve(2)).toBe(2);
  expect(modelBudget(Number.NaN, clock).reserve(1)).toBe(0);
  expect(modelBudget(3, clock, () => { throw new Error('no trace'); }).reserve(1)).toBe(0); // the count cannot be read: no calls
});

test('the suggest graph gets a memory that can only read', async () => {
  const world = await makeWorld({ memory: true, ai: 'answer' });
  try {
    let wrote = 0;
    const remember = world.app.memory!.remember;
    world.app.memory!.remember = (...args) => { wrote += 1; remember(...args); };
    await send(world, '/api/expenses/suggest', { merchant_name: 'Engen Garage' });
    expect(wrote).toBe(0);
    await send(world, '/api/expenses', { ...expense, merchant_name: 'Engen Garage', category_id: 'transport' });
    expect(wrote).toBe(1); // only a recorded expense teaches the memory
  } finally {
    await world.close();
  }
});

test('a merchant name in each script has its own key', () => {
  const keys = ['寿司屋', 'مطعم', 'Аптека №5', '***', 'Müller', 'Muller', 'MULLER  '].map(merchantKey);
  expect(keys).toEqual(['寿司屋', 'مطعم', 'аптека no5', '***', 'muller', 'muller', 'muller']);
  expect(keys.every((k) => k !== '')).toBe(true); // before the fix, the first four were '' or wrong, and thus one merchant
});

test('a memory of one merchant is not suggested for a different merchant', async () => {
  const world = await makeWorld({ memory: true, ai: 'off' });
  try {
    await send(world, '/api/expenses', { ...expense, merchant_name: '寿司屋', category_id: 'eating-out' });
    expect((await send(world, '/api/expenses/suggest', { merchant_name: 'Аптека' })).body.suggestion).toBeNull();
    expect((await send(world, '/api/expenses/suggest', { merchant_name: '寿司屋' })).body.suggestion.category_id).toBe('eating-out');
  } finally {
    await world.close();
  }
});

const statementOf = (lines: number, merchant = 'Shop') => 'Date,Description,Amount\n' + Array.from({ length: lines }, (_, i) => '2026-03-0' + ((i % 9) + 1) + ',' + merchant + ' ' + i + ',-' + (i + 1) + '.00').join('\n');

test('a statement that the application accepts can also be decided: 100 lines', async () => {
  const world = await makeWorld({ memory: true, ai: 'off' });
  try {
    const proposal = await send(world, '/api/imports', { csv: statementOf(100) });
    expect([proposal.status, proposal.body.lines.length]).toEqual([200, 100]);
    const result = await send(world, '/api/imports/' + proposal.body.batch_id + '/decide', { decisions: proposal.body.lines.map((l: { line_no: number }) => ({ line_no: l.line_no, category_id: 'groceries' })) });
    expect([result.status, result.body.counts.RECORDED, result.body.reconciliation.ok]).toEqual([200, 100, true]);
  } finally {
    await world.close();
  }
});

test('a statement that is too long is refused at the first step, with a message that says what to do', async () => {
  const world = await makeWorld({ memory: true, ai: 'off' });
  try {
    const refused = await send(world, '/api/imports', { csv: statementOf(101) });
    expect(refused.status).toBe(400);
    expect(refused.body.error.problems[0].text).toContain('101 lines');
    // Characters of more than one byte: 7 000 characters are more than 10 000 bytes, and still one request.
    const accents = await send(world, '/api/imports', { csv: statementOf(90, 'Café Zoë Müller Señor Crêpe Ñandú Åsa Örebro Ülker Éclair') });
    expect(accents.status).toBe(200);
  } finally {
    await world.close();
  }
});

test('a second decide request gets the stored result, and does not report a reconciliation that is not true', async () => {
  const world = await makeWorld({ memory: true, ai: 'off' });
  try {
    const proposal = await send(world, '/api/imports', { csv: statementOf(2) });
    const path = '/api/imports/' + proposal.body.batch_id + '/decide';
    const first = await send(world, path, { decisions: [{ line_no: 1, category_id: 'groceries' }, { line_no: 2, category_id: 'groceries' }] });
    const again = await send(world, path, { decisions: [{ line_no: 1, category_id: 'transport' }] }); // different decisions, after the batch is done
    expect(again.body).toEqual(first.body); // before the fix: reconciliation.ok was false, with "Line 2 is WAITING, but the ledger has a row"
    expect(world.rows()).toBe(2);
  } finally {
    await world.close();
  }
});

test('text with a control character is refused, thus a replay cannot look like a different request', async () => {
  const world = await makeWorld();
  try {
    expect((await send(world, '/api/expenses', { ...expense, note: 'a\u0000b' })).status).toBe(400);
    expect((await send(world, '/api/expenses', { ...expense, merchant_name: 'Shop\u0007' })).status).toBe(400);
  } finally {
    await world.close();
  }
});

test('the web form: after a failure, the same form keeps its key, and a changed form gets a new one', () => {
  const typed = reduce(reduce(initialState('2026-03-14', 'key-A'), { type: 'field', name: 'amount_text', value: '185.00' }), { type: 'field', name: 'merchant_name', value: 'Woolworths' });
  expect(typed.edited_after_attempt).toBe(false); // nothing was sent yet
  const failed = reduce(reduce(typed, { type: 'submit' }), { type: 'failed', problems: [{ rule: 'NET', text: 'no answer' }] });
  expect([failed.idempotency_key, failed.edited_after_attempt]).toEqual(['key-A', false]); // the same form again: the same key
  const changed = reduce(failed, { type: 'field', name: 'amount_text', value: '190.00' });
  expect(changed.edited_after_attempt).toBe(true); // a different expense: App.tsx sends a new key
  const sent = reduce(changed, { type: 'submit', key: 'key-B' });
  expect([sent.idempotency_key, sent.edited_after_attempt]).toEqual(['key-B', false]);
});
