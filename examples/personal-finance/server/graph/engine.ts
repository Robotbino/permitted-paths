// The graph engine: a small interpreter for an execution graph.
// It is the TypeScript twin of GE.runGraph in the course (js/core/graph-runner.js).
// A graph is data: nodes, edges and the owner of each field of the state.
// The engine, not the nodes, decides what happens next: after each node it takes the first edge
// whose condition is true. No model selects an edge here; each edge is "by: code".

export type NodeType = 'code' | 'model' | 'person';
export type StepResult = 'PASS' | 'FAIL';

/** What a node gives back: the fields that it writes, PASS or FAIL, and a sentence for the trace. */
export type NodeOutput<S> = { writes?: Partial<S>; result?: StepResult; note?: string };

export type GraphNode<S, D> = {
  id: string;
  type: NodeType;
  act(state: Readonly<S>, deps: D): NodeOutput<S> | Promise<NodeOutput<S>>;
};

export type Edge<S> = { from: string; to: string; label?: string; when?: (state: Readonly<S>) => boolean };

export type Graph<S, D> = {
  name: string;
  start: string;
  nodes: GraphNode<S, D>[];
  edges: Edge<S>[];
  /** The state contract: each field has exactly one owner, a node id or 'input'. A field with no owner does not compile. */
  owners: { [K in keyof S]: string };
  maxSteps?: number;
};

/** One step of a run. The course page replays these steps on its drawing (GE.player reads the same fields). */
export type Step = {
  node: string;
  type: NodeType;
  result: StepResult;
  note: string;
  writes: Record<string, unknown>;
  /** The edge that the engine took after this node, as "from>to". null at the end of the path. */
  edge: string | null;
  by: 'code';
  stopped?: true;
};

export type Run<S> = { steps: Step[]; state: S; path: string[] };

export class StateContractViolation extends Error {
  constructor(node: string, field: string, owner: string | undefined) {
    super('Node "' + node + '" cannot write "' + field + '". ' + (owner ? 'The owner is "' + owner + '".' : 'The field has no owner.'));
  }
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const inner of Object.values(value)) deepFreeze(inner);
  }
  return value;
}

export type RunHooks<S> = {
  /** Called after each step with a copy of the state. The trace uses it for the checkpoints. */
  onStep?(step: Step, stateAfter: S): void;
};

export async function runGraph<S extends object, D>(graph: Graph<S, D>, initial: S, deps: D, hooks: RunHooks<S> = {}): Promise<Run<S>> {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  let state: S = structuredClone(initial);
  const steps: Step[] = [];
  let current: string | null = graph.start;
  const budget = graph.maxSteps ?? 40;

  while (current !== null) {
    const node = byId.get(current);
    if (!node) throw new Error('The graph "' + graph.name + '" has no node "' + current + '".');
    if (steps.length >= budget) {
      // The step budget. A graph with a cycle cannot run for an unlimited time.
      steps.push({ node: node.id, type: node.type, result: 'FAIL', note: 'The step budget of ' + budget + ' is used.', writes: {}, edge: null, by: 'code', stopped: true });
      break;
    }
    // The node gets a frozen copy. It cannot change the state; it can only give back writes.
    const output = await node.act(deepFreeze(structuredClone(state)), deps);
    const writes = (output.writes ?? {}) as Record<string, unknown>;
    for (const field of Object.keys(writes)) {
      const owner = (graph.owners as Record<string, string>)[field];
      if (owner !== node.id) throw new StateContractViolation(node.id, field, owner);
    }
    state = { ...state, ...structuredClone(writes) } as S;

    const edge: Edge<S> | undefined = graph.edges.find((e) => e.from === node.id && (!e.when || e.when(state)));
    if (edge && !byId.has(edge.to)) throw new Error('The graph "' + graph.name + '" has no node "' + edge.to + '".');
    const step: Step = { node: node.id, type: node.type, result: output.result ?? 'PASS', note: output.note ?? '', writes: structuredClone(writes), edge: edge ? edge.from + '>' + edge.to : null, by: 'code' };
    steps.push(step);
    hooks.onStep?.(step, structuredClone(state));
    current = edge ? edge.to : null;
  }
  return { steps, state, path: steps.map((s) => s.node) };
}

/** The graph as plain data, without the functions. The recordings and the course page use it. */
export function describeGraph<S, D>(graph: Graph<S, D>) {
  const owners = graph.owners as Record<string, string>;
  return {
    name: graph.name,
    start: graph.start,
    nodes: graph.nodes.map((n) => ({ id: n.id, type: n.type, owns: Object.keys(owners).filter((field) => owners[field] === n.id) })),
    edges: graph.edges.map((e) => ({ from: e.from, to: e.to, label: e.label ?? '' })),
    input: Object.keys(owners).filter((field) => owners[field] === 'input'),
  };
}
