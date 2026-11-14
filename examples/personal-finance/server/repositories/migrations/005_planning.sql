-- Planning: the data that the payday plan needs. No table here stores a figure of the plan:
-- the plan is calculated from these rows each time.

-- A category gets a kind and a class. The old column "kind" holds 'EXPENSE' in each row and has a CHECK,
-- thus it stays as it is, and the new values go into two new columns.
--   entry_kind:  consumption (money that is used), savings (money that goes to a pot), transfer (a move between own accounts)
--   spend_class: fixed (a dated commitment), variable (a planned essential), free (all other spending)
ALTER TABLE categories ADD COLUMN entry_kind TEXT NOT NULL DEFAULT 'consumption' CHECK (entry_kind IN ('consumption', 'savings', 'transfer'));
ALTER TABLE categories ADD COLUMN spend_class TEXT NOT NULL DEFAULT 'free' CHECK (spend_class IN ('fixed', 'variable', 'free'));

-- The account that the money left.
ALTER TABLE expenses ADD COLUMN account TEXT NOT NULL DEFAULT 'main';
CREATE INDEX expenses_by_date ON expenses (occurred_on);

-- Money in. As an expense, an income row is added and never changed, and one request key records one row at most.
CREATE TABLE income (
  id              TEXT PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,
  occurred_on     TEXT NOT NULL,                  -- local date, YYYY-MM-DD
  amount_cents    INTEGER NOT NULL CHECK (amount_cents > 0),
  source          TEXT NOT NULL,
  account         TEXT NOT NULL,
  created_at      TEXT NOT NULL                   -- UTC, for the audit
) STRICT;

CREATE INDEX income_by_date ON income (occurred_on);

-- A cost with a date in each cycle. due_day is a day of the month; 28 is the largest, because each month has a day 28.
CREATE TABLE commitments (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  amount_cents  INTEGER NOT NULL CHECK (amount_cents > 0),
  due_day       INTEGER NOT NULL CHECK (due_day BETWEEN 1 AND 28),
  account       TEXT NOT NULL,
  pay_to_person INTEGER NOT NULL CHECK (pay_to_person IN (0, 1)),
  active        INTEGER NOT NULL CHECK (active IN (0, 1))
) STRICT;

-- Priority 1 gets money first.
CREATE TABLE savings_pots (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  priority     INTEGER NOT NULL,
  target_cents INTEGER NOT NULL CHECK (target_cents >= 0),
  active       INTEGER NOT NULL CHECK (active IN (0, 1))
) STRICT;

-- One row only (id = 1). buffer_items is JSON: a list of { name, amount_cents }.
CREATE TABLE plan_settings (
  id                    INTEGER PRIMARY KEY CHECK (id = 1),
  payday                INTEGER NOT NULL CHECK (payday BETWEEN 1 AND 28),
  variable_living_cents INTEGER NOT NULL CHECK (variable_living_cents >= 0),
  savings_request_cents INTEGER NOT NULL CHECK (savings_request_cents >= 0),
  card_account          TEXT,
  buffer_items          TEXT NOT NULL
) STRICT;
