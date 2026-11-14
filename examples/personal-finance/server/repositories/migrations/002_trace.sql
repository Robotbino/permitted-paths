-- Level 2. The trace: the context graph of the application.
-- A run is one execution of a graph. A trace event is one step of a run.
-- These tables are outside the business data. A failure to write them never fails an expense.

CREATE TABLE runs (
  id            TEXT PRIMARY KEY,
  graph         TEXT NOT NULL,
  started_at    TEXT NOT NULL,
  ended_at      TEXT NOT NULL,
  result        TEXT NOT NULL CHECK (result IN ('PASS', 'FAIL', 'ESCALATED')),
  subject_id    TEXT,            -- the expense that the run recorded, if it recorded one
  parent_run_id TEXT             -- a run that caused this run; this link connects runs into one history
) STRICT;

CREATE TABLE trace_events (
  run_id      TEXT NOT NULL REFERENCES runs (id),
  seq         INTEGER NOT NULL,  -- 1, 2, 3 ... with no hole
  node        TEXT NOT NULL,
  node_type   TEXT NOT NULL CHECK (node_type IN ('code', 'model', 'person')),
  result      TEXT NOT NULL CHECK (result IN ('PASS', 'FAIL')),
  edge        TEXT,              -- "from>to", the edge that the engine took after the node
  note        TEXT NOT NULL,
  writes      TEXT NOT NULL,     -- JSON: the fields that the node wrote
  state_after TEXT NOT NULL,     -- JSON: the checkpoint, the full state after the node
  PRIMARY KEY (run_id, seq)
) STRICT;

CREATE INDEX runs_by_subject ON runs (subject_id);
