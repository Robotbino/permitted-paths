-- Level 4. An import waits for the person between its two steps. The state of the graph at the
-- node "await_person" is stored here: the checkpoint. Step 2 starts again from this checkpoint.

CREATE TABLE import_batches (
  id         TEXT PRIMARY KEY,   -- from the content of the statement: the same file gives the same id
  created_at TEXT NOT NULL,
  status     TEXT NOT NULL CHECK (status IN ('WAITING_FOR_PERSON', 'DONE')),
  run_id     TEXT NOT NULL,      -- the run of step 1
  checkpoint TEXT NOT NULL       -- JSON: the state of the import graph
) STRICT;
