-- Level 3. The assist path: a person writes a request in plain words, a model recommends,
-- the application validates, the person approves, the application executes.

-- One row for each request, also for a refused one. It has no text of the person:
-- input_summary is the short summary of the action gate, or the length of the text.
CREATE TABLE assist_audit (
  request_id    TEXT PRIMARY KEY,
  at            TEXT NOT NULL,      -- UTC
  capability    TEXT,               -- the name that the model gave, or NULL
  status        TEXT NOT NULL,
  reason        TEXT,
  input_summary TEXT NOT NULL,
  model         TEXT                -- the model that was asked; NULL: no model call for this request
) STRICT;

CREATE INDEX assist_audit_by_time ON assist_audit (at);

-- A request that passed the gate and waits for the person. input and consequences are JSON: what the person saw.
-- A proposal is decided one time. outcome is JSON: the stored answer of the decision.
CREATE TABLE assist_proposals (
  id           TEXT PRIMARY KEY,
  request_id   TEXT NOT NULL,
  capability   TEXT NOT NULL,
  input        TEXT NOT NULL,
  consequences TEXT,
  description  TEXT NOT NULL,
  created_at   TEXT NOT NULL,       -- UTC
  status       TEXT NOT NULL CHECK (status IN ('PENDING', 'DECLINED_BY_PERSON', 'EXECUTED', 'FAILED')),
  outcome      TEXT,
  CHECK ((status = 'PENDING') = (outcome IS NULL))
) STRICT;
