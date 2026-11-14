-- Level 3. The memory of the application: which category the person confirmed for a merchant.
-- A row is written only when the person records an expense (rule R13). The model never writes here.

CREATE TABLE merchant_memory (
  merchant_key      TEXT PRIMARY KEY,
  category_id       TEXT NOT NULL REFERENCES categories (id),
  times_confirmed   INTEGER NOT NULL CHECK (times_confirmed > 0),
  last_confirmed_on TEXT NOT NULL,   -- local date
  source_run_id     TEXT NOT NULL    -- the run that recorded the expense: the memory can show where it came from
) STRICT;
