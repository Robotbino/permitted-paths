// The scenarios of the import graph, the assist path and the plan: for each one the status, the exact
// path (where a graph runs), the answer and the rows of the ledger. Then what each scenario must show.
// The scenarios of the record graph and the suggest graph have their own path tests.
import { describe, expect, test } from 'vitest';
import { example } from '../shared/planning/plan-example.ts';
import { buildPlan } from '../shared/planning/plan.ts';
import { HELD_TEXT } from '../server/import/import-nodes.write.ts';
import { CAPABILITY_NAMES } from '../server/intelligence/permitted/capabilities.ts';
import { MAX_PROPOSAL_ROWS, record } from './record-runs.ts';
import { ASSIST_SCENARIOS, LEDGER_ROWS } from './scenarios.assist.ts';
import { IMPORT_SCENARIOS } from './scenarios.import.ts';
import { SCENARIOS, runScenario } from './scenarios.ts';

const later = [...IMPORT_SCENARIOS, ...ASSIST_SCENARIOS];
const run = (id: string) => runScenario(SCENARIOS.find((s) => s.id === id)!);
const pathOf = (r: { events: Array<{ node: string }> } | null | undefined) => (r ? r.events.map((e) => e.node) : []);
const ends = (body: any): Record<number, string> => Object.fromEntries(body.outcomes.map((o: any) => [o.line_no, o.end]));

test('the list has each scenario one time', () => {
  expect(new Set(SCENARIOS.map((s) => s.id)).size).toBe(SCENARIOS.length);
  expect(later.map((s) => s.id)).toEqual([
    'import_northbank', 'import_harbour_after', 'import_same_file_twice', 'import_unknown_layout', 'import_bad_mapping',
    'assist_clarify', 'assist_analyse', 'assist_allowance_approved', 'assist_allowance_declined', 'assist_outside_allowlist',
    'assist_invalid_answer', 'assist_model_down', 'assist_ai_off', 'assist_declined_request', 'plan_worked_example',
  ]);
});

describe.each(later)('scenario $id', (scenario) => {
  test(scenario.title, async () => {
    const { http, run: last, first, rows, exchanges } = await runScenario(scenario);
    expect(http.status).toBe(scenario.expect.status);
    expect(pathOf(last)).toEqual(scenario.expect.path);
    expect(rows).toBe(scenario.expect.rows);
    if (scenario.expect.answer !== undefined) expect(http.body.status).toBe(scenario.expect.answer);
    expect(first !== undefined).toBe(scenario.expect.first !== undefined);
    if (first && scenario.expect.first) {
      expect(first.http.status).toBe(scenario.expect.first.status);
      expect(pathOf(first.run)).toEqual(scenario.expect.first.path);
      if (scenario.expect.first.answer !== undefined) expect(first.http.body.status).toBe(scenario.expect.first.answer);
    }
    expect(exchanges).toHaveLength(scenario.follow ? 2 : 1);
    expect(exchanges.at(-1)).toMatchObject({ status: http.status, response: http.body });
  });
});

describe('what the import scenarios show', () => {
  test('Northbank: each suggestion that the person accepts is one row, and the salary is income', async () => {
    const { http, first, income_rows } = await run('import_northbank');
    expect(first!.http.body.lines).toHaveLength(14);
    expect(http.body.counts).toEqual({ RECORDED: 5, DUPLICATE: 0, REJECTED: 0, WAITING: 9, PAIRED: 0 });
    expect(income_rows).toBe(1);
    expect(http.body.reconciliation.ok).toBe(true);
  });

  test('Harbour after Northbank: the transfer pairs and is not income, the pending row is held, the purchase and its reversal pair', async () => {
    const { http, first, income_rows } = await run('import_harbour_after');
    expect(first!.http.body.summary).toEqual({ new: 6, duplicate: 0, transfer: 1, held: 1, reversed: 2, problem: 0 });
    expect(ends(http.body)).toMatchObject({ 4: 'PAIRED', 6: 'PAIRED', 7: 'PAIRED', 11: 'WAITING' });
    expect(http.body.outcomes.find((o: any) => o.line_no === 11).detail).toBe(HELD_TEXT);
    expect(http.body.outcomes.find((o: any) => o.line_no === 4).detail).toContain('a move between your own accounts');
    // The salary of the Northbank file and the interest of the Harbour file. The R2 500 that arrived is not a third income row.
    expect(income_rows).toBe(2);
    // The text for the sheet has no paired row and no held row.
    expect(http.body.expenses_tsv).not.toMatch(/Lumen|Orbit/);
    expect(http.body.income_tsv).not.toMatch(/Northbank/i);
  });

  test('the same file a second time: no row of the ledger is added again', async () => {
    const { http, first, rows, income_rows } = await run('import_same_file_twice');
    expect(first!.http.body.summary).toMatchObject({ new: 9, duplicate: 5 });
    expect(http.body.counts).toMatchObject({ DUPLICATE: 5, RECORDED: 2 });
    // 4 expenses and 1 income row from the first import. The second adds only the two lines that waited before.
    expect([rows, income_rows]).toEqual([6, 1]);
    expect(http.body.outcomes.filter((o: any) => o.end === 'RECORDED').map((o: any) => o.line_no)).toEqual([9, 10]);
  });

  test('the unknown layout: the first answer asks for a mapping, the second has the 5 rows, and nothing is recorded', async () => {
    const { http, first, rows, income_rows } = await run('import_unknown_layout');
    expect([first!.http.body.step, http.body.step]).toEqual(['mapping', 'review']);
    expect(http.body.lines).toHaveLength(5);
    expect([rows, income_rows]).toEqual([0, 0]);
  });

  test('the bad mapping: the mapping gate names the column, and the batch still waits for a mapping', async () => {
    const { http, rows, income_rows } = await run('import_bad_mapping');
    expect(http.body.error).toMatchObject({ code: 'SHAPE', problems: [{ rule: 'MAP-COLUMN' }] });
    expect(http.body.error.problems[0].text).toContain('"Day"');
    expect([rows, income_rows]).toEqual([0, 0]);
  });
});

describe('what the assist scenarios show', () => {
  test('no scenario adds a row to the ledger, and only the approved one changes the plan settings', async () => {
    for (const scenario of ASSIST_SCENARIOS.filter((s) => s.endpoint === '/api/assist')) {
      const { rows, income_rows, model_calls, http } = await runScenario(scenario);
      expect([rows, income_rows], scenario.id).toEqual([LEDGER_ROWS, 3]);
      expect(model_calls, scenario.id).toBe(scenario.id === 'assist_ai_off' ? 0 : 1);
      expect(http.body.status === 'EXECUTED', scenario.id).toBe(scenario.id === 'assist_allowance_approved');
    }
  });

  test('the two refusals of the gate name their rule: R15 for the name, R16 for the input', async () => {
    const outside = (await run('assist_outside_allowlist')).http.body;
    expect([outside.capability, outside.reason, outside.problems[0].rule]).toEqual(['move_money_to_savings', 'UNKNOWN_CAPABILITY', 'R15']);
    const invalid = (await run('assist_invalid_answer')).http.body;
    expect([invalid.capability, invalid.reason, invalid.problems[0].rule]).toEqual(['recommend_allowance', 'INVALID_INPUT', 'R16']);
  });

  test('the approval writes the number that the person saw; the refusal of the person writes nothing', async () => {
    const approved = await run('assist_allowance_approved');
    const seen = approved.first!.http.body.consequences;
    expect(seen.free_spending_after_cents - seen.free_spending_before_cents).toBe(seen.savings_before_cents - seen.savings_after_cents);
    expect(approved.http.body.output).toMatchObject({ savings_request_cents: seen.savings_request_after_cents, free_spending_cents: seen.free_spending_after_cents });
    const declined = await run('assist_allowance_declined');
    expect(declined.first!.http.body.consequences).toEqual(seen);
    expect(declined.http.body).toMatchObject({ status: 'DECLINED_BY_PERSON', output: null, problems: [] });
  });

  test('the analysis has the totals of the ledger, the largest first', async () => {
    const { output } = (await run('assist_analyse')).http.body;
    expect(output.cycle).toEqual({ id: '2026-01-25', start: '2026-01-25', end: '2026-02-24' });
    expect(output.categories.map((c: any) => [c.category_id, c.total_cents])).toEqual([['rent', 950_000], ['savings', 600_000], ['groceries', 124_050], ['transport', 95_000], ['entertainment', 32_995], ['eating-out', 18_500]]);
    expect(output.total_cents).toBe(1_820_545);
  });
});

test('the plan scenario: the application makes the plan of the worked example from its ledger', async () => {
  const { http } = await run('plan_worked_example');
  expect(http.body.plan).toEqual(JSON.parse(JSON.stringify(buildPlan(example()))));
  expect(http.body.input.commitments).toEqual(example().commitments);
  expect(http.body.savings).toMatchObject({ planned_cents: 600_000, moved_cents: 600_000, held: true });
  expect(http.body.weeks.map((w: any) => [w.spent_cents, w.status])).toEqual([[51_495, 'NEAR'], [0, 'OK'], [null, null], [null, null], [null, null]]);
});

describe('the recording', () => {
  test('it has the allowlist, the gate rules, the plan example and the import graph', async () => {
    const recording = JSON.parse(await record());
    expect(recording.assist.allowlist.map((c: any) => c.name)).toEqual([...CAPABILITY_NAMES]);
    for (const c of recording.assist.allowlist) expect(Object.keys(c)).toEqual(['name', 'purpose', 'needs_approval', 'changes_data', 'model_does', 'application_does']);
    expect(recording.assist.rules.map((r: any) => r.id)).toEqual(['R15', 'R16', 'R17', 'R18']);
    expect(recording.plan_example.plan).toEqual(JSON.parse(JSON.stringify(buildPlan(example()))));
    expect(recording.plan_example.input.income_cents).toBe(3_200_000);
    expect(recording.graphs['import-statement'].nodes.map((n: any) => n.id)).toEqual(['inspect', 'map', 'await_mapping', 'stage', 'classify', 'await_person', 'apply', 'reconcile', 'export', 'respond', 'reject']);
    expect(recording.scenarios.map((s: any) => s.id)).toEqual(SCENARIOS.map((s) => s.id));
  });

  test('a scenario with no graph has run: null and the HTTP exchange; a scenario of two requests has both exchanges', async () => {
    const recording = JSON.parse(await record());
    for (const s of recording.scenarios) {
      const expected = SCENARIOS.find((x) => x.id === s.id)!;
      expect(s.run === null, s.id).toBe(expected.expect.path.length === 0);
      expect(s.http.status, s.id).toBe(expected.expect.status);
      expect(s.exchanges?.length, s.id).toBe(expected.follow ? 2 : undefined);
      if (s.exchanges) expect(s.exchanges.map((x: any) => Object.keys(x)), s.id).toEqual([['method', 'path', 'body', 'status', 'response'], ['method', 'path', 'body', 'status', 'response']]);
    }
  });

  test('an import proposal keeps 12 rows at most, and says how many rows there were', async () => {
    const text = await record();
    const proposals: any[] = [];
    JSON.parse(text, (_key, value) => {
      if (value && typeof value === 'object' && value.step === 'review') proposals.push(value);
      return value;
    });
    expect(proposals.length).toBeGreaterThan(8);
    for (const p of proposals) {
      expect(p.lines.length).toBe(Math.min(p.rows_total, MAX_PROPOSAL_ROWS));
    }
    expect(proposals.map((p) => p.rows_total).sort((a, b) => a - b).at(-1)).toBe(14);
    // No key of a model provider, and no setting of the environment.
    expect(text).not.toMatch(/sk-ant|api[_-]?key"|ANTHROPIC_API_KEY=/i);
  });
});
