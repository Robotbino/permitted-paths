// Level 4: the parts of an import alone, then the whole import in two steps through HTTP.
import { describe, expect, test } from 'vitest';
import { SCENARIOS, STATEMENT, makeWorld, runScenario, send } from '../../scripts/scenarios.ts';
import type { LineOutcome, StatementLine } from '../../shared/contracts.import.ts';
import { describeGraph, runGraph } from '../graph/engine.ts';
import type { LedgerReader } from '../graph/verifier.ts';
import { batchIdOf, importGraph, lineKey } from './import.graph.ts';
import { mapPool } from './pool.ts';
import { reconcile } from './reconciler.ts';
import { parseStatement, splitCsvLine } from './statement-parser.ts';

describe('the parser of a statement', () => {
  test('a good line becomes a date, a merchant and cents', () => {
    expect(parseStatement('Date,Description,Amount\n2026-03-02,Woolworths,-642.35')).toEqual([{ line_no: 1, raw: '2026-03-02,Woolworths,-642.35', occurred_on: '2026-03-02', merchant_name: 'Woolworths', amount_cents: 64235, problem: null }]);
  });
  test('a bad line is a value with a problem, and the other lines continue', () => {
    const lines = parseStatement(STATEMENT)!;
    expect(lines).toHaveLength(14);
    expect(lines.filter((l) => l.problem).map((l) => [l.line_no, l.problem!.text.slice(0, 22)])).toEqual([[4, 'This line is money in.'], [9, 'The date "2026-02-30" ']]);
  });
  test('a field in quotes can contain a comma', () => {
    expect(splitCsvLine('2026-03-09,"Clicks, Sandton City",-240.00')).toEqual(['2026-03-09', 'Clicks, Sandton City', '-240.00']);
  });
  test('text with no header is not a statement', () => {
    expect(parseStatement('hello')).toBeNull();
    expect(parseStatement('')).toBeNull();
  });
});

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
  const lines: StatementLine[] = [1, 2, 3].map((n) => ({ line_no: n, raw: '', occurred_on: '2026-03-0' + n, merchant_name: 'M' + n, amount_cents: n * 100, problem: null }));
  const ends = (...list: Array<[number, LineOutcome['end']]>): LineOutcome[] => list.map(([line_no, end]) => ({ line_no, end, expense_id: null, detail: '' }));
  const ledgerWith = (rows: Record<string, number>): LedgerReader => ({ rowsForKey: (key) => (key in rows ? [{ amount_cents: rows[key] } as never] : []), amountsInMonth: () => [] });
  const key = (n: number) => 'k' + n;
  const check = (outcomes: LineOutcome[], rows: Record<string, number>) => reconcile(lines, outcomes, key, ledgerWith(rows));

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
});

describe('the import, in two steps', () => {
  const scenario = SCENARIOS.find((s) => s.id === 'import_statement')!;

  test('step 1 proposes and records nothing; step 2 records what the person decided; each line has one end', async () => {
    const { first, http, run, rows } = await runScenario(scenario);
    // Step 1.
    expect(first!.run!.events.map((e) => e.node)).toEqual(['parse', 'classify', 'await_person', 'respond']);
    expect(first!.http.body.budget).toEqual({ unknown_merchants: 10, model_calls_allowed: 4, model_calls_made: 4 });
    expect(first!.http.body.lines.filter((l: any) => l.suggestion).map((l: any) => [l.line_no, l.suggestion.category_id, l.suggestion.source])).toEqual([
      [1, 'groceries', 'memory'], [2, 'transport', 'model'], [3, 'eating-out', 'model'], [5, 'groceries', 'memory'], [6, 'health', 'model'], [7, 'transport', 'model'],
    ]);
    // Step 2: the run starts again at the person node.
    expect(run!.events.map((e) => e.node)).toEqual(scenario.expect.path);
    expect(run!.parent_run_id).toBe(first!.run!.id);
    expect(http.body.counts).toEqual({ RECORDED: 6, DUPLICATE: 0, REJECTED: 2, WAITING: 6 });
    expect(http.body.reconciliation).toEqual({ ok: true, problems: [] });
    expect(rows).toBe(6);
  });

  test('the model budget belongs to the orchestrator: workers that run at the same time do not go over it', async () => {
    const world = await makeWorld({ memory: true, ai: 'answer', importBudget: 2 });
    try {
      const proposal = await send(world, '/api/imports', { csv: STATEMENT });
      expect(proposal.body.budget).toMatchObject({ unknown_merchants: 11, model_calls_allowed: 2, model_calls_made: 2 });
      expect(world.modelCalls()).toBe(2);
      expect(world.rows()).toBe(0); // a proposal records nothing
    } finally {
      await world.close();
    }
  });

  test('the same statement a second time records nothing: each line is DUPLICATE', async () => {
    const world = await makeWorld({ memory: true, ai: 'answer' });
    try {
      const decide = async () => {
        const proposal = await send(world, '/api/imports', { csv: STATEMENT });
        return send(world, '/api/imports/' + proposal.body.batch_id + '/decide', { decisions: proposal.body.lines.map((l: any) => ({ line_no: l.line_no, category_id: l.suggestion?.category_id ?? null })) });
      };
      const first = await decide();
      const second = await decide();
      // 11 lines have a suggestion. One of them has the date 2026-03-31, after today: Gate 2 of the record graph refuses it (R5).
      expect(first.body.counts).toEqual({ RECORDED: 10, DUPLICATE: 0, REJECTED: 3, WAITING: 1 });
      expect(second.body.counts).toMatchObject({ RECORDED: 0, DUPLICATE: 10 });
      expect(world.rows()).toBe(10);
      expect(second.body.reconciliation.ok).toBe(true);
    } finally {
      await world.close();
    }
  });

  test('one bad decision does not stop the other lines, and each imported line passed the gates of the record graph', async () => {
    const world = await makeWorld({ memory: true, ai: 'off' });
    try {
      const proposal = await send(world, '/api/imports', { csv: STATEMENT });
      const decisions = [{ line_no: 1, category_id: 'groceries' }, { line_no: 2, category_id: 'gym' }, { line_no: 3, category_id: 'eating-out' }];
      const result = await send(world, '/api/imports/' + proposal.body.batch_id + '/decide', { decisions });
      const end = (n: number) => result.body.outcomes.find((o: LineOutcome) => o.line_no === n);
      expect([end(1).end, end(2).end, end(3).end]).toEqual(['RECORDED', 'REJECTED', 'RECORDED']);
      expect(end(2).detail).toContain('R6'); // Gate 2 of the record graph refused the inactive category
      expect(world.app.trace!.forSubject(end(1).expense_id)[0]!.events.map((e) => e.node)).toContain('verify');
    } finally {
      await world.close();
    }
  });

  test('refusals: text that is not a statement, a batch that does not exist, decisions for lines that are not there', async () => {
    const world = await makeWorld({ memory: true });
    try {
      expect((await send(world, '/api/imports', { csv: 'not a statement' })).status).toBe(400);
      expect((await send(world, '/api/imports/imp-000000000000/decide', { decisions: [] })).status).toBe(404);
      const proposal = await send(world, '/api/imports', { csv: STATEMENT });
      expect((await send(world, '/api/imports/' + proposal.body.batch_id + '/decide', { decisions: [{ line_no: 99, category_id: 'groceries' }] })).status).toBe(400);
      expect(world.rows()).toBe(0);
    } finally {
      await world.close();
    }
  });

  test('the engine can start at a node of a stored state, and the keys of the lines do not change', async () => {
    expect(batchIdOf('a\r\nb\n')).toBe(batchIdOf('a\nb'));
    expect(lineKey('imp-0123456789ab', 7)).toBe('imp-0123456789ab-0007');
    const graph = describeGraph(importGraph);
    expect(graph.nodes.filter((n) => n.type === 'person').map((n) => n.id)).toEqual(['await_person']);
    const toy = { name: 't', start: 'a', owners: { n: 'b' }, nodes: [{ id: 'a', type: 'code' as const, act: () => ({}) }, { id: 'b', type: 'code' as const, act: () => ({ writes: { n: 2 } }) }], edges: [{ from: 'a', to: 'b' }] };
    expect((await runGraph(toy, { n: 0 }, null, { startAt: 'b' })).path).toEqual(['b']);
  });
});
