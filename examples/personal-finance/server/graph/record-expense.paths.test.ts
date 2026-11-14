// Path tests. For each scenario: the status, the exact path through the graph, and the rows in the ledger.
// A test of level 1 asks "is the result correct?". A path test asks also "did it go the permitted way?".
import { describe, expect, test } from 'vitest';
import { SCENARIOS, runScenario } from '../../scripts/scenarios.ts';
import { describeGraph } from './engine.ts';
import { recordExpenseGraph } from './record-expense.graph.ts';
import { RECORD_OWNERS } from './state.ts';

const scenarios = SCENARIOS.filter((s) => s.level === 2);

describe.each(scenarios)('scenario $id', (scenario) => {
  test(scenario.title, async () => {
    const { http, run, rows } = await runScenario(scenario);
    expect(http.status).toBe(scenario.expect.status);
    expect(run?.events.map((e) => e.node)).toEqual(scenario.expect.path);
    expect(rows).toBe(scenario.expect.rows);
  });
});

test('a path that ends at reject leaves no row; only commit writes the ledger', async () => {
  for (const scenario of scenarios.filter((s) => s.before.length === 0 && s.expect.path.at(-1) === 'reject')) {
    expect((await runScenario(scenario)).rows, scenario.id).toBe(0);
  }
});

test('the result of the run: PASS for respond, FAIL for reject, ESCALATED for escalate', async () => {
  const results: Record<string, string | undefined> = {};
  for (const scenario of scenarios) results[scenario.expect.path.at(-1)!] = (await runScenario(scenario)).run?.result;
  expect(results).toEqual({ respond: 'PASS', reject: 'FAIL', escalate: 'ESCALATED' });
});

test('over budget is PASS with the state OVER, and the expense is in the ledger', async () => {
  const { http } = await runScenario(scenarios.find((s) => s.id === 'over_budget')!);
  expect(http.body.budget).toMatchObject({ state: 'OVER', remaining_cents: -10_000 });
});

test('the failed check of the ledger names the rules and the run, and the row stays for a person to see', async () => {
  const { http, rows } = await runScenario(scenarios.find((s) => s.id === 'ledger_mismatch')!);
  expect(http.body.error.code).toBe('VERIFICATION_FAILED');
  expect(http.body.error.problems.map((p: { rule: string }) => p.rule)).toEqual(['R8', 'R10']);
  expect(http.body.error.run_id).toMatch(/^run_/);
  expect(rows).toBe(1);
});

test('the graph is complete: each node is on a path of a scenario, each edge target exists, each node writes only its fields', async () => {
  const graph = describeGraph(recordExpenseGraph);
  const ids = graph.nodes.map((n) => n.id);
  for (const edge of graph.edges) expect(ids, edge.from + '>' + edge.to).toContain(edge.to);
  expect(Object.values(RECORD_OWNERS).filter((owner) => owner !== 'input' && !ids.includes(owner))).toEqual([]);

  const visited = new Set<string>();
  const usedEdges = new Set<string>();
  for (const scenario of scenarios) {
    const { run } = await runScenario(scenario);
    for (const event of run!.events) {
      visited.add(event.node);
      if (event.edge) usedEdges.add(event.edge);
      for (const field of Object.keys(event.writes)) expect(RECORD_OWNERS[field as keyof typeof RECORD_OWNERS], event.node + ' wrote ' + field).toBe(event.node);
    }
  }
  expect(ids.filter((id) => !visited.has(id))).toEqual([]);
  // The edges that no scenario uses. Each one is a decision: a scenario that is not written yet.
  expect(graph.edges.map((e) => e.from + '>' + e.to).filter((key) => !usedEdges.has(key))).toEqual(['dedupe>reject', 'dedupe>escalate', 'load_facts>escalate']);
});
