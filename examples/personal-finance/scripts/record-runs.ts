// The recorder. It sends each scenario through the real application and writes what happened
// to recordings/runs.json: the HTTP exchange, the path, and each step with its writes.
// The course page replays this file. "npm run record-runs:check" fails if the file is not current,
// thus the page cannot show behaviour that the code does not have.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RULES } from '../shared/ontology.ts';
import { describeGraph } from '../server/graph/engine.ts';
import { recordExpenseGraph, recordExpenseGraphWithMemory } from '../server/graph/record-expense.graph.ts';
import { initialRecordState } from '../server/graph/state.ts';
import { importGraph } from '../server/import/import.graph.ts';
import { initialSuggestState, suggestCategoryGraph } from '../server/intelligence/suggest-category.graph.ts';
import { SCENARIOS, TODAY, runScenario } from './scenarios.ts';

const FILE = join(dirname(fileURLToPath(import.meta.url)), '..', 'recordings', 'runs.json');

export async function record(): Promise<string> {
  const scenarios = [];
  for (const scenario of SCENARIOS) {
    const { http, run, rows, memory_rows, model_calls, first } = await runScenario(scenario);
    const steps = (r: NonNullable<typeof run>) => r.events.map(({ node, type, result, note, edge, by, writes }) => ({ node, type, result, note, edge, by, writes }));
    scenarios.push({
      id: scenario.id,
      level: scenario.level,
      title: scenario.title,
      world: scenario.world,
      endpoint: scenario.endpoint,
      before: scenario.before.length,
      request: scenario.request,
      http,
      rows_after: rows,
      memory_rows_added: memory_rows,
      model_calls,
      run: run && {
        id: run.id,
        graph: run.graph === 'record-expense' && scenario.world.memory ? 'record-expense+memory' : run.graph,
        result: run.result,
        path: run.events.map((e) => e.node),
        // The checkpoints are in the trace of the application. The recording keeps only the writes:
        // the page gets each checkpoint when it adds the writes to the initial state, step by step.
        steps: steps(run),
      },
      // Level 4: the first of two requests (the proposal, before the person decides).
      ...(first ? { first: { http: first.http, run: first.run && { id: first.run.id, graph: first.run.graph, result: first.run.result, path: first.run.events.map((e) => e.node), steps: steps(first.run) } } } : {}),
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
      // Level 4: the orchestrator graph.
      'import-statement': { ...describeGraph(importGraph), initial_state: {} },
    },
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
