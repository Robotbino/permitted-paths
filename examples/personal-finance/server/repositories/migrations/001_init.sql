-- Level 1. The three tables of the slice "record an expense and update the monthly budget".
-- STRICT: SQLite then refuses a value of the wrong type.
-- The CHECK constraints repeat the rules of the ontology. The database is the last line of defence.

CREATE TABLE categories (
  id     TEXT PRIMARY KEY,
  name   TEXT NOT NULL UNIQUE,
  kind   TEXT NOT NULL CHECK (kind = 'EXPENSE'),
  active INTEGER NOT NULL CHECK (active IN (0, 1))
) STRICT;

-- Rule R9: a category has one budget at most for a month, and the limit is more than 0.
CREATE TABLE budgets (
  id          TEXT PRIMARY KEY,
  category_id TEXT NOT NULL REFERENCES categories (id),
  period      TEXT NOT NULL,                      -- YYYY-MM
  limit_cents INTEGER NOT NULL CHECK (limit_cents > 0),
  currency    TEXT NOT NULL CHECK (currency = 'ZAR'),
  UNIQUE (category_id, period)
) STRICT;

-- An expense is added and never changed. There is no "spent" column in any table (rule R10).
-- Rule R8: UNIQUE on idempotency_key. One request key records one expense at most.
CREATE TABLE expenses (
  id              TEXT PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,
  occurred_on     TEXT NOT NULL,                  -- local date, YYYY-MM-DD
  amount_cents    INTEGER NOT NULL CHECK (amount_cents > 0),
  currency        TEXT NOT NULL CHECK (currency = 'ZAR'),
  merchant_name   TEXT NOT NULL,
  merchant_key    TEXT NOT NULL,
  category_id     TEXT NOT NULL REFERENCES categories (id),
  note            TEXT,
  created_at      TEXT NOT NULL                   -- UTC, for the audit
) STRICT;

CREATE INDEX expenses_by_category_date ON expenses (category_id, occurred_on);
