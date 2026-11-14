// The engine alone, with a small graph that has nothing to do with money.
import { expect, test } from 'vitest';
import { describeGraph, runGraph, StateContractViolation, type Graph } from './engine.ts';

type S = { n: number; doubled: number | null; label: string | null };
const graph = (over: Partial<Graph<S, null>> = {}): Graph<S, null> => ({
  name: 'toy',
  start: 'double',
  owners: { n: 'input', doubled: 'double', label: 'name' },
  nodes: [
    { id: 'double', type: 'code', act: (s) => ({ writes: { doubled: s.n * 2 } }) },
    { id: 'name', type: 'code', act: (s) => ({ writes: { label: s.doubled! > 10 ? 'large' : 'small' } }) },
    { id: 'stop', type: 'code', act: () => ({ result: 'FAIL', note: 'stopped' }) },
  ],
  edges: [
    { from: 'double', to: 'stop', when: (s) => s.n < 0 },
    { from: 'double', to: 'name' },
  ],
  ...over,
});
const start: S = { n: 4, doubled: null, label: null };

test('the engine takes the first edge whose condition is true', async () => {
  expect((await runGraph(graph(), start, null)).path).toEqual(['double', 'name']);
  expect((await runGraph(graph(), { ...start, n: -1 }, null)).path).toEqual(['double', 'stop']);
});

test('each step says its node, its result, its writes and the edge that the engine took', async () => {
  const run = await runGraph(graph(), start, null);
  expect(run.steps[0]).toEqual({ node: 'double', type: 'code', result: 'PASS', note: '', writes: { doubled: 8 }, edge: 'double>name', by: 'code' });
  expect(run.steps[1]!.edge).toBeNull();
  expect(run.state).toEqual({ n: 4, doubled: 8, label: 'small' });
});

test('the state contract: a node that writes a field of a different owner stops the run', async () => {
  const bad = graph({ nodes: [{ id: 'double', type: 'code', act: () => ({ writes: { label: 'mine now' } }) }] });
  await expect(runGraph(bad, start, null)).rejects.toThrow(StateContractViolation);
  await expect(runGraph(bad, start, null)).rejects.toThrow('Node "double" cannot write "label". The owner is "name".');
});

test('the state contract: no node can write an input field', async () => {
  const bad = graph({ nodes: [{ id: 'double', type: 'code', act: () => ({ writes: { n: 99 } }) }] });
  await expect(runGraph(bad, start, null)).rejects.toThrow('The owner is "input".');
});

test('a node cannot change the state that it gets', async () => {
  const bad = graph({ nodes: [{ id: 'double', type: 'code', act: (s) => { (s as S).n = 99; return {}; } }] });
  await expect(runGraph(bad, start, null)).rejects.toThrow(TypeError); // the state is frozen
});

test('the step budget stops a cycle', async () => {
  const loop = graph({ edges: [{ from: 'double', to: 'double' }], maxSteps: 5 });
  const run = await runGraph(loop, start, null);
  expect(run.steps).toHaveLength(6);
  expect(run.steps.at(-1)).toMatchObject({ result: 'FAIL', stopped: true });
});

test('an edge to a node that does not exist is an error of the graph', async () => {
  await expect(runGraph(graph({ edges: [{ from: 'double', to: 'nowhere' }] }), start, null)).rejects.toThrow('has no node "nowhere"');
});

test('the checkpoint after each step is a copy of the state', async () => {
  const seen: S[] = [];
  const run = await runGraph(graph(), start, null, { onStep: (_step, state) => void seen.push(state) });
  expect(seen).toEqual([{ n: 4, doubled: 8, label: null }, { n: 4, doubled: 8, label: 'small' }]);
  expect(seen[1]).not.toBe(run.state);
});

test('the graph as data: nodes with the fields that they own, edges, input fields', () => {
  expect(describeGraph(graph())).toEqual({
    name: 'toy', start: 'double', input: ['n'],
    nodes: [{ id: 'double', type: 'code', owns: ['doubled'] }, { id: 'name', type: 'code', owns: ['label'] }, { id: 'stop', type: 'code', owns: [] }],
    edges: [{ from: 'double', to: 'stop', label: '' }, { from: 'double', to: 'name', label: '' }],
  });
});
