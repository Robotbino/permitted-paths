-- Level 3. An import can now wait two times: for a mapping (the layout of the file is not known),
-- and then for the decisions of the person. SQLite cannot change a CHECK of a table, thus the table
-- is made again with the new list of states and the stored checkpoints are copied.

CREATE TABLE import_batches_new (
  id         TEXT PRIMARY KEY,   -- from the content of the statement and the account: the same file gives the same id
  created_at TEXT NOT NULL,
  status     TEXT NOT NULL CHECK (status IN ('WAITING_FOR_MAPPING', 'WAITING_FOR_PERSON', 'DONE')),
  run_id     TEXT NOT NULL,      -- the run that made the answer that the person sees now
  checkpoint TEXT NOT NULL       -- JSON: the state of the import graph
) STRICT;

INSERT INTO import_batches_new (id, created_at, status, run_id, checkpoint)
  SELECT id, created_at, status, run_id, checkpoint FROM import_batches;

DROP TABLE import_batches;
ALTER TABLE import_batches_new RENAME TO import_batches;
