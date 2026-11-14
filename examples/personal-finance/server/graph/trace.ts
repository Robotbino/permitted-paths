// The trace: what happened in each run, step by step, with a checkpoint of the state after each step.
// This is the context graph of the application. The ledger says what is true now.
// The trace says how it became true, and what was refused.
import type { DatabaseSync } from 'node:sqlite';
import type { Run, Step } from './engine.ts';

export type RunResult = 'PASS' | 'FAIL' | 'ESCALATED';
export type TraceEvent = Step & { seq: number; state_after: unknown };
export type RunRecord = {
  id: string;
  graph: string;
  started_at: string;
  ended_at: string;
  result: RunResult;
  subject_id: string | null;
  parent_run_id: string | null;
  events: TraceEvent[];
};

export interface TraceStore {
  save(run: RunRecord): void;
  get(id: string): RunRecord | null;
  /** The runs that recorded or touched one subject, the oldest first. */
  forSubject(subject_id: string): RunRecord[];
  /** Level 3: how many times a node ran in the runs that started on one day ("2026-03-14"). The cost control reads it. */
  countSteps(node: string, day: string): number;
}

export function memoryTrace(): TraceStore {
  const runs = new Map<string, RunRecord>();
  return {
    save: (run) => void runs.set(run.id, structuredClone(run)),
    get: (id) => runs.get(id) ?? null,
    forSubject: (subject_id) => [...runs.values()].filter((r) => r.subject_id === subject_id),
    countSteps: (node, day) => [...runs.values()].filter((r) => r.started_at.startsWith(day)).reduce((n, r) => n + r.events.filter((e) => e.node === node).length, 0),
  };
}

export function sqliteTrace(db: DatabaseSync): TraceStore {
  const load = (row: Record<string, unknown>): RunRecord => {
    const events = db.prepare('SELECT * FROM trace_events WHERE run_id = ? ORDER BY seq').all(row.id as string).map((e) => ({
      seq: Number(e.seq), node: String(e.node), type: e.node_type as Step['type'], result: e.result as Step['result'], edge: (e.edge as string | null) ?? null,
      note: String(e.note), by: 'code' as const, writes: JSON.parse(String(e.writes)), state_after: JSON.parse(String(e.state_after)),
    }));
    return { ...(row as Omit<RunRecord, 'events'>), events };
  };
  return {
    save(run) {
      // One transaction: a run is in the trace with all its steps, or it is not in the trace.
      db.exec('BEGIN');
      try {
        db.prepare('INSERT INTO runs (id, graph, started_at, ended_at, result, subject_id, parent_run_id) VALUES (?, ?, ?, ?, ?, ?, ?)').run(run.id, run.graph, run.started_at, run.ended_at, run.result, run.subject_id, run.parent_run_id);
        const insert = db.prepare('INSERT INTO trace_events (run_id, seq, node, node_type, result, edge, note, writes, state_after) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
        for (const e of run.events) insert.run(run.id, e.seq, e.node, e.type, e.result, e.edge, e.note, JSON.stringify(e.writes), JSON.stringify(e.state_after));
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    get(id) {
      const row = db.prepare('SELECT * FROM runs WHERE id = ?').get(id);
      return row ? load({ ...row }) : null;
    },
    forSubject: (subject_id) => db.prepare('SELECT * FROM runs WHERE subject_id = ? ORDER BY started_at, id').all(subject_id).map((row) => load({ ...row })),
    countSteps: (node, day) => Number(db.prepare("SELECT COUNT(*) AS n FROM trace_events e JOIN runs r ON r.id = e.run_id WHERE e.node = ? AND r.started_at LIKE ? || '%'").get(node, day)!.n),
  };
}

/** Collects the checkpoints while a graph runs. Give `onStep` to runGraph. */
export function collector<S>() {
  const events: TraceEvent[] = [];
  return { events, onStep: (step: Step, stateAfter: S) => void events.push({ ...step, seq: events.length + 1, state_after: stateAfter }) };
}

/**
 * Writes one run to the trace. Best effort: the trace is not the business data.
 * If the trace store fails, the run still has its result, and the server log gets one line.
 */
export function writeTrace(trace: TraceStore | undefined, record: Omit<RunRecord, 'events'>, run: Run<unknown>, events: TraceEvent[]): boolean {
  if (!trace) return false;
  try {
    trace.save({ ...record, events: events.length === run.steps.length ? events : run.steps.map((step, i) => ({ ...step, seq: i + 1, state_after: null })) });
    return true;
  } catch (error) {
    console.warn('trace not written for run ' + record.id + ': ' + (error instanceof Error ? error.message : String(error)));
    return false;
  }
}
