// The recorder. It sends each scenario through the real application and writes what happened
// to recordings/runs.json: the HTTP exchange, the path, and each step with its writes.
// The course page replays this file. "npm run record-runs:check" fails if the file is not current,
// thus the page cannot show behaviour that the code does not have.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RULES } from '../shared/ontology.ts';
import { example } from '../shared/planning/plan-example.ts';
import { buildPlan } from '../shared/planning/plan.ts';
import { describeGraph } from '../server/graph/engine.ts';
import { recordExpenseGraph, recordExpenseGraphWithMemory } from '../server/graph/record-expense.graph.ts';
import { initialRecordState } from '../server/graph/state.ts';
import { importGraph } from '../server/import/import.graph.ts';
import { GATE_RULES } from '../server/intelligence/permitted/action-gate.ts';
import { CAPABILITIES, CAPABILITY_NAMES } from '../server/intelligence/permitted/capabilities.ts';
import { initialSuggestState, suggestCategoryGraph } from '../server/intelligence/suggest-category.graph.ts';
import { SCENARIOS, TODAY, runScenario, type Exchange } from './scenarios.ts';

const FILE = join(dirname(fileURLToPath(import.meta.url)), '..', 'recordings', 'runs.json');

/** The largest number of rows of an import proposal that the recording keeps in an HTTP body. */
export const MAX_PROPOSAL_ROWS = 12;

/** An import proposal can have 100 rows. The recording keeps the first rows and says how many there were. */
function small(body: any): any {
  if (body === null || typeof body !== 'object' || body.step !== 'review' || !Array.isArray(body.lines)) return body;
  return { ...body, lines: body.lines.slice(0, MAX_PROPOSAL_ROWS), rows_total: body.lines.length };
}
const smallHttp = (http: Exchange): Exchange => ({ status: http.status, body: small(http.body) });

export async function record(): Promise<string> {
  const scenarios = [];
  for (const scenario of SCENARIOS) {
    const { http, run, rows, income_rows, memory_rows, model_calls, first, exchanges } = await runScenario(scenario);
    const steps = (r: NonNullable<typeof run>) => r.events.map(({ node, type, result, note, edge, by, writes }) => ({ node, type, result, note, edge, by, writes: 'response' in writes ? { ...writes, response: small(writes.response) } : writes }));
    scenarios.push({
      id: scenario.id,
      level: scenario.level,
      title: scenario.title,
      world: scenario.world,
      method: scenario.method ?? 'POST',
      endpoint: scenario.endpoint,
      before: scenario.before.length,
      // What the world has before the request, in words, when more than one request made it ready.
      ...(scenario.prepare ? { prepared: scenario.prepare.text } : {}),
      request: scenario.request,
      http: smallHttp(http),
      rows_after: rows,
      income_rows_after: income_rows,
      memory_rows_added: memory_rows,
      model_calls,
      // null: the request runs no graph (the assist path, the plan). The HTTP exchange is the recording.
      run: run && {
        id: run.id,
        graph: run.graph === 'record-expense' && scenario.world.memory ? 'record-expense+memory' : run.graph,
        result: run.result,
        path: run.events.map((e) => e.node),
        // The checkpoints are in the trace of the application. The recording keeps only the writes:
        // the page gets each checkpoint when it adds the writes to the initial state, step by step.
        steps: steps(run),
      },
      // The first of two requests (the proposal, before the person decides).
      ...(first ? { first: { http: smallHttp(first.http), run: first.run && { id: first.run.id, graph: first.run.graph, result: first.run.result, path: first.run.events.map((e) => e.node), steps: steps(first.run) } } } : {}),
      // A scenario of two requests: each request with its path, its body, the status and the answer.
      ...(exchanges.length > 1 ? { exchanges: exchanges.map((x) => ({ ...x, response: small(x.response) })) } : {}),
    });
  }
  const recording = {
    about: 'Recorded by "npm run record-runs" from the real code. Fixed clock, sequential ids, SQLite in memory. Do not edit.',
    today: TODAY,
    rules: RULES,
    graphs: {
      'record-expense': { ...describeGraph(recordExpenseGraph), initial_state: initialRecordState('run_0000', null) },
      // Level 3: the record graph of an application that has a merchant memory, and the suggest graph.
      'record-expense+memory': { ...describeGraph(recordExpenseGraphWithMemory), initial_state: initialRecordState('run_0000', null) },
      'suggest-category': { ...describeGraph(suggestCategoryGraph), initial_state: initialSuggestState('run_0000', null) },
      // Level 3: the orchestrator graph. Its state at the start has only the input of the request.
      'import-statement': { ...describeGraph(importGraph), initial_state: {} },
    },
    // Level 3, the assist path: the complete list of what a model can request, and the rules of the action gate.
    assist: {
      allowlist: CAPABILITY_NAMES.map((name) => {
        const { purpose, needs_approval, changes_data, model_does, application_does } = CAPABILITIES[name];
        return { name, purpose, needs_approval, changes_data, model_does, application_does };
      }),
      rules: Object.entries(GATE_RULES).map(([id, text]) => ({ id, text })),
    },
    // The worked example of the payday plan: the input, and the plan that the pure function makes from it.
    plan_example: { input: example(), plan: buildPlan(example()) },
    scenarios,
  };
  return JSON.stringify(recording, null, 1) + '\n';
}

// Run as a program (not when a test imports the file).
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const text = await record();
  if (process.argv.includes('--check')) {
    const current = readFileSync(FILE, 'utf8').replace(/\r\n/g, '\n');
    if (current !== text) {
      console.error('FAIL  recordings/runs.json is not current. Run "npm run record-runs".');
      process.exit(1);
    }
    console.log('PASS  recordings/runs.json is current (' + SCENARIOS.length + ' scenarios).');
  } else {
    writeFileSync(FILE, text);
    console.log('Wrote recordings/runs.json (' + SCENARIOS.length + ' scenarios).');
  }
}
