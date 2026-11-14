// Level 3: the parts of an import alone, then the whole import through HTTP with the sample files.
// The sample files are synthetic (shared/pipeline/samples.ts): two fictional banks and one unknown layout.
import { describe, expect, test } from 'vitest';
import { SCENARIOS, makeWorld, runScenario, send, type World } from '../../scripts/scenarios.ts';
import type { ImportLine, LineOutcome } from '../../shared/contracts.import.ts';
import { textHash } from '../../shared/pipeline/index.ts';
import { HARBOUR_ACCOUNT, HARBOUR_SAMPLE, NORTHBANK_ACCOUNT, NORTHBANK_SAMPLE, UNKNOWN_PROFILE, UNKNOWN_SAMPLE } from '../../shared/pipeline/samples.ts';
import { describeGraph, runGraph } from '../graph/engine.ts';
import type { LedgerReader } from '../graph/verifier.ts';
import { openDatabase } from '../repositories/sqlite.ts';
import { batchIdOf, importGraph, rowKey } from './import.graph.ts';
import { HELD_TEXT } from './import-nodes.write.ts';
import { sqliteImportStore } from './line-worker.ts';
import { mapPool } from './pool.ts';
import { reconcile } from './reconciler.ts';

describe('the bounded pool', () => {
  test('not more than the limit runs at the same time, and the results keep the sequence of the items', async () => {
    let running = 0;
    let most = 0;
    const results = await mapPool([50, 10, 30, 5, 20, 1], 3, async (ms, index) => {
      running += 1;
      most = Math.max(most, running);
      await new Promise((done) => setTimeout(done, ms));
      running -= 1;
      return index * 10;
    });
    expect(most).toBe(3);
    expect(results).toEqual([0, 10, 20, 30, 40, 50]);
  });
  test('no item, and fewer items than the limit', async () => {
    expect(await mapPool([], 3, async () => 1)).toEqual([]);
    expect(await mapPool([7], 3, async (n) => n + 1)).toEqual([8]);
  });
});

describe('the reconciler (R14), by sabotage', () => {
  const lines = [1, 2, 3].map((n) => ({ line_no: n, amount_cents: n * 100 }));
  const ends = (...list: Array<[number, LineOutcome['end']]>): LineOutcome[] => list.map(([line_no, end]) => ({ line_no, end, expense_id: null, income_id: null, detail: '' }));
  const found = (rows: Record<string, number>, key: string) => (key in rows ? [{ amount_cents: rows[key] } as never] : []);
  const ledgerWith = (rows: Record<string, number>, income: Record<string, number> = {}): LedgerReader => ({ rowsForKey: (key) => found(rows, key), amountsInMonth: () => [], incomeRowsForKey: (key) => found(income, key) });
  const key = (n: number) => 'k' + n;
  const check = (outcomes: LineOutcome[], rows: Record<string, number>, income: Record<string, number> = {}) => reconcile(lines, outcomes, key, ledgerWith(rows, income));

  test('each line has one end and the ledger agrees: PASS', () => {
    expect(check(ends([1, 'RECORDED'], [2, 'WAITING'], [3, 'REJECTED']), { k1: 100 })).toEqual({ ok: true, problems: [] });
  });
  test('a line with no end, and a line with two ends', () => {
    expect(check(ends([1, 'RECORDED'], [2, 'WAITING']), { k1: 100 }).problems[0]!.text).toBe('Line 3 has 0 ends. It must have exactly 1.');
    expect(check(ends([1, 'RECORDED'], [1, 'WAITING'], [2, 'WAITING'], [3, 'WAITING']), { k1: 100 }).ok).toBe(false);
  });
  test('a line that says RECORDED with no row, and a line that says WAITING with a row', () => {
    expect(check(ends([1, 'RECORDED'], [2, 'WAITING'], [3, 'REJECTED']), {}).problems[0]!.text).toContain('the ledger has 0 rows');
    expect(check(ends([1, 'RECORDED'], [2, 'WAITING'], [3, 'REJECTED']), { k1: 100, k2: 200 }).problems[0]!.text).toContain('Line 2 is WAITING, but the ledger has a row');
  });
  test('a row with a different amount, and an end for a line that is not in the statement', () => {
    expect(check(ends([1, 'RECORDED'], [2, 'WAITING'], [3, 'REJECTED']), { k1: 999 }).problems[0]!.text).toContain('The ledger says 999');
    expect(check(ends([1, 'RECORDED'], [2, 'WAITING'], [3, 'REJECTED'], [9, 'RECORDED']), { k1: 100 }).ok).toBe(false);
  });
  test('an income row is a ledger row; a line with an expense and an income row has two; a PAIRED line has none', () => {
    expect(check(ends([1, 'RECORDED'], [2, 'DUPLICATE'], [3, 'PAIRED']), { k1: 100 }, { k2: 200 })).toEqual({ ok: true, problems: [] });
    expect(check(ends([1, 'RECORDED'], [2, 'WAITING'], [3, 'PAIRED']), { k1: 100 }, { k1: 100 }).problems[0]!.text).toContain('the ledger has 2 rows');
    expect(check(ends([1, 'RECORDED'], [2, 'WAITING'], [3, 'PAIRED']), { k1: 100 }, { k3: 300 }).problems[0]!.text).toContain('Line 3 is PAIRED, but the ledger has a row');
  });
});

// The person accepts each suggestion. `more` gives a category to lines that have no suggestion.
const accept = (proposal: { lines: ImportLine[] }, more: Record<number, string> = {}) => proposal.lines.map((l) => ({ line_no: l.line_no, category_id: more[l.line_no] ?? l.suggestion?.category_id ?? null }));
const propose = (world: World, csv: string, account: string) => send(world, '/api/imports', { csv, account });
const decide = (world: World, proposal: { batch_id: string }, body: unknown) => send(world, '/api/imports/' + proposal.batch_id + '/decide', body);
const endOf = (result: { outcomes: LineOutcome[] }, line_no: number) => result.outcomes.find((o) => o.line_no === line_no)!;
/** A category for each Northbank line that the stand-in model does not know: the move to savings, the transfer and the two fees. */
const ALL_NORTHBANK = { 4: 'savings', 7: 'own-transfer', 8: 'utilities', 15: 'utilities' };

async function inWorld<T>(options: Parameters<typeof makeWorld>[0], work: (world: World) => Promise<T>): Promise<T> {
  const world = await makeWorld(options);
  try {
    return await work(world);
  } finally {
    await world.close();
  }
}

describe('the two sample files, end to end', () => {
  test('Northbank: 14 rows, each with one end; the salary is income and not an expense; a proposal records nothing', () => inWorld({ memory: true, ai: 'answer' }, async (world) => {
    const proposal = await propose(world, NORTHBANK_SAMPLE, NORTHBANK_ACCOUNT);
    expect([proposal.status, proposal.body.step, proposal.body.profile.id, proposal.body.account]).toEqual([200, 'review', 'northbank', NORTHBANK_ACCOUNT]);
    expect(proposal.body.summary).toEqual({ new: 14, duplicate: 0, transfer: 0, held: 0, reversed: 0, problem: 0 });
    expect(proposal.body.problems).toEqual([]);
    expect([world.rows(), world.incomeRows()]).toEqual([0, 0]);
    // The row of the file, and how the pipeline changed it.
    expect(proposal.body.lines[3]).toMatchObject({ line_no: 5, status: 'new', note: null, occurred_on: '2026-03-01', amount_cents: 84235, direction: 'out', description_clean: 'GREENLEAF MARKET', kind: 'expense', problems: [], suggestion: { category_id: 'groceries', source: 'model' } });
    expect(proposal.body.lines[3].provenance).toContainEqual({ step: 'date', field: 'occurred_on', from: '01/03/2026', to: '2026-03-01' });
    expect(proposal.body.lines[0]).toMatchObject({ line_no: 2, direction: 'in', kind: 'income', suggestion: null }); // money in gets no suggestion

    const result = await decide(world, proposal.body, { decisions: accept(proposal.body) });
    expect(result.body.counts).toEqual({ RECORDED: 10, DUPLICATE: 0, REJECTED: 0, WAITING: 4, PAIRED: 0 });
    expect(result.body.reconciliation).toEqual({ ok: true, problems: [] });
    expect([world.rows(), world.incomeRows()]).toEqual([9, 1]);
    // Income: in the income store, with the account, and not an expense.
    const salary = endOf(result.body, 2);
    expect(salary).toMatchObject({ end: 'RECORDED', expense_id: null, detail: 'Recorded as income.' });
    expect(world.app.stores.income.listBetween('2026-02-25', '2026-02-25')).toMatchObject([{ id: salary.income_id, amount_cents: 2_850_000, source: 'SALARY ACME LOGISTICS', account: NORTHBANK_ACCOUNT }]);
    expect(world.app.stores.expenses.listBetween('2026-02-25', '2026-02-25')).toEqual([]);
    // Two equal purchases on one day are two rows of the file, and two expenses with the account of the file.
    expect(world.app.stores.expenses.listBetween('2026-03-05', '2026-03-05')).toMatchObject([{ merchant_name: 'CORNER CAFE', amount_cents: 6800, account: NORTHBANK_ACCOUNT }, { merchant_name: 'CORNER CAFE', amount_cents: 6800 }]);
    // A fee is an out row like any other. The stand-in model does not know it, and the person selected no category.
    expect(endOf(result.body, 8)).toMatchObject({ end: 'WAITING', detail: 'The person selected no category.' });
  }));

  test('Harbour alone: a held row waits, a purchase and its reversal are PAIRED, the money in is income', () => inWorld({ memory: true, ai: 'answer' }, async (world) => {
    const proposal = await propose(world, HARBOUR_SAMPLE, HARBOUR_ACCOUNT);
    expect(proposal.body.summary).toEqual({ new: 7, duplicate: 0, transfer: 0, held: 1, reversed: 2, problem: 0 });
    // A row that is not 'new' has a note and no suggestion.
    expect(proposal.body.lines.filter((l: ImportLine) => l.status !== 'new').map((l: ImportLine) => [l.line_no, l.status, l.suggestion, typeof l.note])).toEqual([[6, 'reversed', null, 'string'], [7, 'reversed', null, 'string'], [11, 'held', null, 'string']]);

    const result = await decide(world, proposal.body, { decisions: accept(proposal.body, { 6: 'entertainment', 11: 'entertainment' }) }); // a decision for a row that is not 'new' changes nothing
    expect(result.body.counts).toEqual({ RECORDED: 5, DUPLICATE: 0, REJECTED: 0, WAITING: 3, PAIRED: 2 });
    expect(result.body.reconciliation.ok).toBe(true);
    expect([world.rows(), world.incomeRows()]).toEqual([3, 2]); // the interest, and the transfer: no second account is known yet
    expect(endOf(result.body, 11)).toMatchObject({ end: 'WAITING', detail: HELD_TEXT, expense_id: null });
    // The reversal pair: each row names the fingerprint of the other row, and none is in the ledger.
    expect(endOf(result.body, 6).detail).toContain('The other row: ' + HARBOUR_ACCOUNT + '|2026-03-08|189900|Lumen Electronics|0.');
    expect(endOf(result.body, 7).detail).toContain('The other row: ' + HARBOUR_ACCOUNT + '|2026-03-06|-189900|Lumen Electronics|0.');
    expect(world.app.stores.expenses.listBetween('2026-03-06', '2026-03-08')).toEqual([]);
  }));

  test('Harbour after Northbank: the transfer is paired with the ledger row of the other account', () => inWorld({ memory: true, ai: 'answer' }, async (world) => {
    const north = await propose(world, NORTHBANK_SAMPLE, NORTHBANK_ACCOUNT);
    const first = await decide(world, north.body, { decisions: accept(north.body, { 7: 'own-transfer' }) });
    expect(first.body.counts).toEqual({ RECORDED: 11, DUPLICATE: 0, REJECTED: 0, WAITING: 3, PAIRED: 0 });

    const harbour = await propose(world, HARBOUR_SAMPLE, HARBOUR_ACCOUNT);
    expect(harbour.body.summary).toEqual({ new: 6, duplicate: 0, transfer: 1, held: 1, reversed: 2, problem: 0 });
    expect(harbour.body.lines[2]).toMatchObject({ line_no: 4, status: 'transfer', suggestion: null });
    expect(harbour.body.lines[2].note).toContain('from ' + NORTHBANK_ACCOUNT + ' to ' + HARBOUR_ACCOUNT);
    const second = await decide(world, harbour.body, { decisions: accept(harbour.body) });
    expect(second.body.counts).toEqual({ RECORDED: 4, DUPLICATE: 0, REJECTED: 0, WAITING: 3, PAIRED: 3 });
    expect(second.body.reconciliation.ok).toBe(true);
    // The partner is a ledger row, thus its request key stands for its fingerprint.
    const partner = world.app.stores.expenses.listBetween('2026-03-03', '2026-03-03').find((e) => e.amount_cents === 250_000)!;
    expect(endOf(second.body, 4)).toMatchObject({ end: 'PAIRED', income_id: null });
    expect(endOf(second.body, 4).detail).toContain('The other row: ' + partner.idempotency_key + '.');
    expect(world.incomeRows()).toBe(2); // the salary and the interest. The transfer is not income.
  }));
});

describe('a file that comes again', () => {
  test('the same file a second time gives only DUPLICATE and records nothing', () => inWorld({ memory: true, ai: 'answer' }, async (world) => {
    const once = async () => {
      const proposal = await propose(world, NORTHBANK_SAMPLE, NORTHBANK_ACCOUNT);
      return { proposal, result: await decide(world, proposal.body, { decisions: accept(proposal.body, ALL_NORTHBANK) }) };
    };
    const first = await once();
    expect(first.result.body.counts).toEqual({ RECORDED: 14, DUPLICATE: 0, REJECTED: 0, WAITING: 0, PAIRED: 0 });
    const second = await once();
    expect(second.proposal.body.batch_id).toBe(first.proposal.body.batch_id);
    expect(second.proposal.body.summary).toMatchObject({ new: 0, duplicate: 14 });
    expect(second.result.body.counts).toEqual({ RECORDED: 0, DUPLICATE: 14, REJECTED: 0, WAITING: 0, PAIRED: 0 });
    expect(second.result.body.reconciliation).toEqual({ ok: true, problems: [] });
    expect([world.rows(), world.incomeRows()]).toEqual([13, 1]);
    expect([second.result.body.expenses_tsv, second.result.body.income_tsv]).toEqual(['', '']);
    expect(second.result.body.notes.at(-1)).toContain('Already in the ledger before this import: 14 rows.');
  }));

  test('a file that overlaps an earlier file records only the new rows', () => inWorld({ memory: true, ai: 'answer' }, async (world) => {
    const early = NORTHBANK_SAMPLE.split('\n').slice(0, 9).join('\n'); // the header and the first 8 rows
    const first = await propose(world, early, NORTHBANK_ACCOUNT);
    expect((await decide(world, first.body, { decisions: accept(first.body, ALL_NORTHBANK) })).body.counts).toMatchObject({ RECORDED: 8 });
    const whole = await propose(world, NORTHBANK_SAMPLE, NORTHBANK_ACCOUNT);
    expect(whole.body.batch_id).not.toBe(first.body.batch_id);
    expect(whole.body.lines.map((l: ImportLine) => l.status)).toEqual([...Array(8).fill('duplicate'), ...Array(6).fill('new')]);
    const second = await decide(world, whole.body, { decisions: accept(whole.body, ALL_NORTHBANK) });
    expect(second.body.counts).toEqual({ RECORDED: 6, DUPLICATE: 8, REJECTED: 0, WAITING: 0, PAIRED: 0 });
    expect(second.body.reconciliation.ok).toBe(true);
    expect([world.rows(), world.incomeRows()]).toEqual([13, 1]);
  }));

  test('a cut file: the balance does not continue, and the proposal reports it', () => inWorld({ memory: true, ai: 'off' }, async (world) => {
    const cut = NORTHBANK_SAMPLE.split('\n').filter((_, i) => i !== 5).join('\n'); // the row of line 6 is absent
    const proposal = await propose(world, cut, NORTHBANK_ACCOUNT);
    expect(proposal.status).toBe(200);
    expect(proposal.body.problems.map((p: { rule: string }) => p.rule)).toEqual(['BATCH-BALANCE']);
    expect(proposal.body.problems[0].text).toContain('Line 6: the balance does not continue from line 5.');
    expect(proposal.body.summary.new).toBe(13);
  }));
});

describe('a layout that is not known', () => {
  test('the run stops at await_mapping; a wrong mapping is refused with its problems; the right mapping continues', () => inWorld({ memory: true, ai: 'off' }, async (world) => {
    const needed = await propose(world, UNKNOWN_SAMPLE, NORTHBANK_ACCOUNT);
    expect(needed.status).toBe(200);
    expect(needed.body).toMatchObject({ step: 'mapping', header: ['When', 'What', 'Money out', 'Money in'], problems: [] });
    expect(needed.body.rows).toHaveLength(5);
    expect(needed.body.rows[0]).toEqual(['03/02/2026', 'Garden centre', '310.00', '']);
    expect(needed.body.fields.filter((f: { required: boolean }) => f.required).map((f: { field: string }) => f.field)).toEqual(['id', 'name', 'columns.date', 'columns.description', 'date_format', 'decimal']);
    expect(world.app.trace!.get(needed.body.run_id)!.events.map((e) => e.node)).toEqual(['inspect', 'map', 'await_mapping', 'respond']);
    const path = '/api/imports/' + needed.body.batch_id;
    expect((await send(world, path + '/decide', { decisions: [] })).status).toBe(422); // no lines to decide yet

    const wrong = await send(world, path + '/mapping', { mapping: { ...UNKNOWN_PROFILE, date_format: 'DD/MM/YYYY' } });
    expect(wrong.status).toBe(400);
    expect(wrong.body.error.problems.map((p: { rule: string }) => p.rule)).toEqual(['MAP-DATE', 'MAP-DATE', 'MAP-DATE']);
    expect(world.app.trace!.get(wrong.body.error.run_id)!.events.map((e) => e.node)).toEqual(['await_mapping', 'reject']);
    expect((await send(world, path + '/mapping', { mapping: 'the second column' })).body.error.problems[0].rule).toBe('MAP-SHAPE');
    expect((await send(world, path + '/mapping', {})).status).toBe(400);

    const proposal = await send(world, path + '/mapping', { mapping: UNKNOWN_PROFILE }); // the batch still waits after a refusal
    expect([proposal.status, proposal.body.step, proposal.body.profile.id, proposal.body.batch_id]).toEqual([200, 'review', 'hand-made', needed.body.batch_id]);
    expect(proposal.body.lines.map((l: ImportLine) => [l.line_no, l.direction, l.amount_cents])).toEqual([[2, 'out', 31000], [3, 'in', 4500], [4, 'out', 20000], [5, 'in', 150000], [6, 'out', 112075]]);
    expect(world.app.trace!.get(proposal.body.run_id)!.parent_run_id).toBe(needed.body.run_id);
    expect((await send(world, path + '/mapping', { mapping: UNKNOWN_PROFILE })).status).toBe(422); // the batch does not wait for a mapping now

    // Two rows have a date after today (2026-03-14): the same rule R5 refuses the expense and the income.
    const result = await decide(world, proposal.body, { decisions: accept(proposal.body, { 2: 'entertainment', 4: 'transport', 6: 'utilities' }) });
    expect(result.body.counts).toEqual({ RECORDED: 3, DUPLICATE: 0, REJECTED: 2, WAITING: 0, PAIRED: 0 });
    expect([endOf(result.body, 5).detail.slice(0, 3), endOf(result.body, 6).detail.slice(0, 3)]).toEqual(['R5:', 'R5:']);
    expect(result.body.reconciliation.ok).toBe(true);
  }));

  test('a mapping in the first request passes the same gate', () => inWorld({ memory: true, ai: 'off' }, async (world) => {
    const direct = await send(world, '/api/imports', { csv: UNKNOWN_SAMPLE, account: NORTHBANK_ACCOUNT, mapping: UNKNOWN_PROFILE });
    expect([direct.status, direct.body.step]).toEqual([200, 'review']);
    expect(world.app.trace!.get(direct.body.run_id)!.events.map((e) => e.node)).toEqual(['inspect', 'map', 'stage', 'classify', 'await_person', 'respond']);
    const wrong = await send(world, '/api/imports', { csv: UNKNOWN_SAMPLE, account: NORTHBANK_ACCOUNT, mapping: { ...UNKNOWN_PROFILE, columns: { ...UNKNOWN_PROFILE.columns, date: 'Day' } } });
    expect([wrong.status, wrong.body.error.problems[0].rule]).toEqual([400, 'MAP-COLUMN']);
    // A known file with a mapping that does not fit it: the mapping is not replaced by the known profile.
    expect((await send(world, '/api/imports', { csv: NORTHBANK_SAMPLE, account: NORTHBANK_ACCOUNT, mapping: UNKNOWN_PROFILE })).status).toBe(400);
  }));
});

describe('the export text', () => {
  const exported = (export_profile?: string) => inWorld({ memory: true, ai: 'answer' }, async (world) => {
    const proposal = await propose(world, NORTHBANK_SAMPLE, NORTHBANK_ACCOUNT);
    return (await decide(world, proposal.body, { decisions: accept(proposal.body, { 4: 'savings', 7: 'own-transfer' }), ...(export_profile ? { export_profile } : {}) })).body;
  });

  test('the default profile: ISO dates, the category before the amount, savings and transfers left out', async () => {
    const result = await exported();
    const rows = result.expenses_tsv.split('\n');
    expect(result.export_profile).toBe('default');
    expect(rows).toHaveLength(9);
    expect(rows[0]).toBe('2026-02-26\tDEBIT ORDER CITYVIEW RENTALS\tRent\t9500.00\t');
    expect(rows[1]).toBe('2026-03-01\tGREENLEAF MARKET\tGroceries\t842.35\t');
    expect(result.income_tsv).toBe('2026-02-25\tSALARY ACME LOGISTICS\t28500.00\t');
    expect(result.notes).toContain('Savings: 1 moves to savings are left out. This template has no place for them.');
    expect(result.notes).toContain('Transfers between your own accounts: 1 left out. A transfer is not an expense and not income.');
  });

  test('the profile "two-tab-tracker": month first, the amount before the category, savings in the expenses', async () => {
    const result = await exported('two-tab-tracker');
    const rows = result.expenses_tsv.split('\n');
    expect(result.export_profile).toBe('two-tab-tracker');
    expect(rows).toHaveLength(10);
    expect(rows[0]).toBe('02-26-2026\tDEBIT ORDER CITYVIEW RENTALS\t9500.00\tRent\t');
    expect(rows[1]).toBe('02-27-2026\tTRANSFER TO SAVINGS POCKET\t3000.00\tSavings\t');
    expect(result.income_tsv).toBe('02-25-2026\tSALARY ACME LOGISTICS\t28500.00\t\t');
  });
});

describe('the orchestrator', () => {
  test('the recorded scenario: step 1 proposes, step 2 starts again at the person node', async () => {
    const scenario = SCENARIOS.find((s) => s.id === 'import_northbank')!;
    const { first, http, run, rows } = await runScenario(scenario);
    expect(first!.run!.events.map((e) => e.node)).toEqual(['inspect', 'map', 'stage', 'classify', 'await_person', 'respond']);
    expect(first!.http.body.budget).toEqual({ unknown_merchants: 10, model_calls_allowed: 4, model_calls_made: 4 });
    expect(first!.http.body.lines.filter((l: ImportLine) => l.suggestion).map((l: ImportLine) => [l.line_no, l.suggestion!.category_id, l.suggestion!.source])).toEqual([[3, 'rent', 'model'], [5, 'groceries', 'memory'], [6, 'transport', 'model'], [12, 'groceries', 'memory']]);
    expect(run!.events.map((e) => e.node)).toEqual(scenario.expect.path);
    expect(run!.parent_run_id).toBe(first!.run!.id);
    expect(http.body.counts).toEqual({ RECORDED: 5, DUPLICATE: 0, REJECTED: 0, WAITING: 9, PAIRED: 0 });
    expect(http.body.reconciliation).toEqual({ ok: true, problems: [] });
    expect(rows).toBe(scenario.expect.rows);
  });

  test('the recorded scenario of the unknown layout: the mapping step starts again at await_mapping', async () => {
    const scenario = SCENARIOS.find((s) => s.id === 'import_unknown_layout')!;
    const { first, http, run, rows } = await runScenario(scenario);
    expect(first!.http.body.step).toBe('mapping');
    expect([http.status, http.body.step, rows]).toEqual([scenario.expect.status, 'review', 0]);
    expect(run!.events.map((e) => e.node)).toEqual(scenario.expect.path);
  });

  test('the model budget belongs to the orchestrator: workers that run at the same time do not go over it', () => inWorld({ memory: true, ai: 'answer', importBudget: 2 }, async (world) => {
    const proposal = await propose(world, NORTHBANK_SAMPLE, NORTHBANK_ACCOUNT);
    expect(proposal.body.budget).toEqual({ unknown_merchants: 11, model_calls_allowed: 2, model_calls_made: 2 });
    expect(world.modelCalls()).toBe(2);
    expect([world.rows(), world.incomeRows()]).toEqual([0, 0]); // a proposal records nothing
  }));

  test('one bad decision does not stop the other lines, and each imported expense passed the gates of the record graph', () => inWorld({ memory: true, ai: 'off' }, async (world) => {
    const proposal = await propose(world, NORTHBANK_SAMPLE, NORTHBANK_ACCOUNT);
    const result = await decide(world, proposal.body, { decisions: [{ line_no: 3, category_id: 'rent' }, { line_no: 5, category_id: 'gym' }, { line_no: 6, category_id: 'transport' }] });
    expect([3, 5, 6].map((n) => endOf(result.body, n).end)).toEqual(['RECORDED', 'REJECTED', 'RECORDED']);
    expect(endOf(result.body, 5).detail).toContain('R6'); // Gate 2 of the record graph refused the inactive category
    expect(world.app.trace!.forSubject(endOf(result.body, 3).expense_id!)[0]!.events.map((e) => e.node)).toContain('verify');
  }));

  test('refusals: text that is not a table, 101 lines, no account, a batch that does not exist, decisions that are not for this batch', () => inWorld({ memory: true }, async (world) => {
    expect((await propose(world, 'not a statement', NORTHBANK_ACCOUNT)).body.error.problems.map((p: { rule: string }) => p.rule)).toEqual(['INSPECT-ONE-COLUMN', 'INSPECT-NO-ROWS']);
    expect((await propose(world, 'Date,Type,Description,Amount\n', HARBOUR_ACCOUNT)).status).toBe(400); // a header and no rows
    const long = 'Date,Type,Description,Amount\n' + Array.from({ length: 101 }, (_, i) => '2026-03-01,PURCHASE,Shop ' + i + ',-' + (i + 1) + '.00').join('\n');
    const refused = await propose(world, long, HARBOUR_ACCOUNT);
    expect([refused.status, refused.body.error.problems[0].text]).toEqual([400, 'The statement has 101 lines. One import can have 100 at most: divide the file.']);
    expect((await send(world, '/api/imports', { csv: NORTHBANK_SAMPLE })).status).toBe(400);
    expect((await send(world, '/api/imports/imp-000000000000/decide', { decisions: [] })).status).toBe(404);
    expect((await send(world, '/api/imports/imp-000000000000/mapping', { mapping: UNKNOWN_PROFILE })).status).toBe(404);
    const proposal = await propose(world, NORTHBANK_SAMPLE, NORTHBANK_ACCOUNT);
    const strange = await decide(world, proposal.body, { decisions: [{ line_no: 99, category_id: 'groceries' }] });
    expect([strange.status, strange.body.error.problems[0].text]).toEqual([400, 'The decisions name lines that are not in the statement: 99.']);
    const profile = await decide(world, proposal.body, { decisions: [], export_profile: 'my-sheet' });
    expect([profile.status, profile.body.error.problems[0].text]).toEqual([400, 'The export profile "my-sheet" is not known. Permitted: default, two-tab-tracker.']);
    expect([world.rows(), world.incomeRows()]).toEqual([0, 0]);
  }));

  test('the keys do not change, the graph has two person nodes, and the engine can start at a node of a stored state', async () => {
    expect(batchIdOf(textHash('a\r\nb\n'), 'x')).toBe(batchIdOf(textHash('a\nb'), 'x'));
    expect(batchIdOf(textHash('a\nb'), 'x')).not.toBe(batchIdOf(textHash('a\nb'), 'y')); // the same file for a different account is a different batch
    expect(rowKey('x|2026-03-01|-100|Shop|0')).toBe('imp-498e9ba9a55e95f773b47229deb5858d');
    expect(describeGraph(importGraph).nodes.filter((n) => n.type === 'person').map((n) => n.id)).toEqual(['await_mapping', 'await_person']);
    const toy = { name: 't', start: 'a', owners: { n: 'b' }, nodes: [{ id: 'a', type: 'code' as const, act: () => ({}) }, { id: 'b', type: 'code' as const, act: () => ({ writes: { n: 2 } }) }], edges: [{ from: 'a', to: 'b' }] };
    expect((await runGraph(toy, { n: 0 }, null, { startAt: 'b' })).path).toEqual(['b']);
  });

  test('the SQLite store of the checkpoints keeps a batch that waits for a mapping', () => {
    const store = sqliteImportStore(openDatabase(':memory:'));
    const batch = { id: 'imp-1', created_at: '2026-03-14T10:00:00.000Z', status: 'WAITING_FOR_MAPPING' as const, run_id: 'run_1', checkpoint: { csv: 'a;b', mapping: null } };
    store.save(batch);
    expect(store.get('imp-1')).toEqual(batch);
    store.save({ ...batch, status: 'WAITING_FOR_PERSON', run_id: 'run_2' });
    expect(store.get('imp-1')).toMatchObject({ status: 'WAITING_FOR_PERSON', run_id: 'run_2' });
    expect(store.get('imp-2')).toBeNull();
  });
});

describe('repairs after the second review', () => {
  const cafe = (key: string, more: object = {}) => ({ idempotency_key: key, amount_cents: 6800, currency: 'ZAR', occurred_on: '2026-03-05', merchant_name: 'CORNER CAFE', category_id: 'eating-out', ...more });

  test('two equal rows of a file: the file confirms the second only if the first is in the ledger from this file', () => inWorld({ memory: true, ai: 'answer' }, async (world) => {
    // The person typed the two coffees in the form before the import.
    expect((await send(world, '/api/expenses', cafe('form-0001'))).status).toBe(201);
    expect((await send(world, '/api/expenses', cafe('form-0002', { confirm_duplicate: true }))).status).toBe(201);
    const proposal = await propose(world, NORTHBANK_SAMPLE, NORTHBANK_ACCOUNT);
    const result = await decide(world, proposal.body, { decisions: accept(proposal.body, ALL_NORTHBANK) });
    expect([endOf(result.body, 9).end, endOf(result.body, 10).end]).toEqual(['WAITING', 'WAITING']);
    expect(world.app.stores.expenses.listBetween('2026-03-05', '2026-03-05')).toHaveLength(2);
    expect(result.body.reconciliation.ok).toBe(true);
  }));

  test('the account name of an import is not case sensitive: the same file under "Cheque" and "cheque" records nothing two times', () => inWorld({ memory: true, ai: 'answer' }, async (world) => {
    const first = await propose(world, NORTHBANK_SAMPLE, 'cheque');
    await decide(world, first.body, { decisions: accept(first.body, ALL_NORTHBANK) });
    const again = await propose(world, NORTHBANK_SAMPLE, '  Cheque ');
    expect([again.body.account, again.body.batch_id]).toEqual(['cheque', first.body.batch_id]);
    expect(again.body.summary).toMatchObject({ new: 0, duplicate: 14 });
    expect([world.rows(), world.incomeRows()]).toEqual([13, 1]);
  }));

  test('a known row that comes again with a problem: REJECTED, and the reconciliation is not a false FAIL', () => inWorld({ memory: true, ai: 'answer' }, async (world) => {
    const first = await propose(world, NORTHBANK_SAMPLE, NORTHBANK_ACCOUNT);
    await decide(world, first.body, { decisions: accept(first.body, ALL_NORTHBANK) });
    const lines = NORTHBANK_SAMPLE.split('\n');
    lines[4] += ';'; // line 5 has 6 cells now
    const again = await propose(world, lines.join('\n'), NORTHBANK_ACCOUNT);
    expect(again.body.summary).toMatchObject({ duplicate: 13, problem: 1 });
    expect(again.body.lines[3].note).toContain('The ledger already has a row with these values.');
    const result = await decide(world, again.body, { decisions: accept(again.body, ALL_NORTHBANK) });
    expect(result.body.counts).toEqual({ RECORDED: 0, DUPLICATE: 13, REJECTED: 1, WAITING: 0, PAIRED: 0 });
    expect(result.body.reconciliation).toEqual({ ok: true, problems: [] });
  }));

  test('the money in is imported first: the transfer pairs later, and its note says that the other side stays income', () => inWorld({ memory: true, ai: 'answer' }, async (world) => {
    const harbour = await propose(world, HARBOUR_SAMPLE, HARBOUR_ACCOUNT);
    expect(endOf((await decide(world, harbour.body, { decisions: [] })).body, 4)).toMatchObject({ end: 'RECORDED', detail: 'Recorded as income.' });
    const north = await propose(world, NORTHBANK_SAMPLE, NORTHBANK_ACCOUNT);
    const line7 = north.body.lines.find((l: ImportLine) => l.line_no === 7);
    expect(line7.status).toBe('transfer');
    expect(line7.note).not.toContain('not income');
    expect(line7.note).toContain('The other side is already in the ledger as income, and it stays income.');
    await decide(world, north.body, { decisions: accept(north.body) });
    expect(world.incomeRows()).toBe(3); // the interest, the money from Northbank, and the salary
  }));
});
