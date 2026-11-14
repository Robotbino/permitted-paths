# Personal finance: the reference application of the Practical Architecture Studio

This folder is a small application. The chapter "Practical Architecture Studio" of the course *Permitted Paths* uses it to show how the ideas of the course become files, functions and tests.

The application does one thing fully: **it records an expense and updates the budget of the month**. It also shows the plan of one pay cycle (what to move on payday, the cap of each week, and if the savings really moved), it imports a bank statement that you paste as text, and it reads a request in plain words inside a fixed list of permitted actions. All the data is fictional: a person named Sam who is paid on day 25, the banks Northbank and Harbour Bank, amounts in rand. The application does not connect to a bank, it moves no money, and it has no sign-in.

The application is independent of the course site. The course site has no build step; this folder has one.

## Start

You need Node.js 22.13 or later. A current LTS version is the correct choice.

```bash
npm install
```

```bash
npm run build
```

```bash
npm start
```

Then open http://127.0.0.1:8787 in a browser. The data goes into `data/finance.sqlite`. Git ignores that file.

For development, `npm run dev` starts the server and the web application together, and you open http://127.0.0.1:5173.

## The three levels

The chapter has three levels. Each level changes the same code; no level is a separate example.

| Level | What it is | What is in it |
|---|---|---|
| 1. An ordinary application | Software with no graph and no model | Contracts, a pure domain, repository ports, services, an HTTP server, a React web application. The planning: the pay cycle, the payday plan, the weekly caps, the insights, and the plan service that calculates them from stored rows |
| 2. Structured workflows | Work with named steps, gates and an independent check | The record service as an execution graph: typed state with owners, two gates, a verifier, a trace with checkpoints. The import pipeline (inspect, map, validate, normalise, reconcile) and the export for a budget sheet |
| 3. A model inside permitted paths | A model that can only propose | The optional category suggestion: merchant memory, cost control, a model behind a port, a suggestion gate. The import of a statement on the import pipeline of level 2: a wait for a mapping when the layout is not known, workers, one budget, a wait for the person, one end for each line, and text for a budget sheet. The allowlist of capabilities and the action gate: the model recommends, the application validates, the person approves, the application executes |

`levels.json` gives the level of each file and the later levels that changed it.

### The tags are history

The first version was built in four steps, and each step is one commit with a tag. The tags are the four steps in which the first version was built; the levels of the chapter are three.

| Tag | What the step added | Tests at that step |
|---|---|---|
| `studio-l1` | Contracts, a pure domain, repository ports, a service, an HTTP server, a React web application | 60 |
| `studio-l2` | The service becomes an execution graph: typed state with owners, two gates, an independent verifier, a trace with checkpoints | 102 |
| `studio-l3` | An optional category suggestion: merchant memory, cost control, a model behind a port, a suggestion gate | 139 |
| `studio-l4` | The import of a statement: workers, a bounded pool, one budget, a wait for the person, a reconciler | 155 |
| (no tag) | Repairs after a review: the server does not stop on a malformed address; a model call is reserved before it is made; merchant keys for each script; consistent import limits | 169 |
| (no tag) | The rework into three levels: the planning, the import pipeline with a mapping and an export, the assist path, the recorded scenarios for each, and a hardening pass | 685 |

The steps `studio-l3` and `studio-l4` are the two parts of level 3 now.

To see what one step changed:

```bash
git diff studio-l1 studio-l2 --stat -- .
```

## The folders

```
shared/        the contracts: the web application and the server import the same files
  planning/      level 1: the pay cycle, the payday plan, the pace, the insights (pure functions)
  pipeline/      level 2: the import pipeline, from raw text to staged rows (pure functions)
  export/        level 2: ledger entries to rows for a budget sheet
server/
  domain/        pure functions: the expense, the budget, the business rules
  repositories/  the ports of the stores, memory and SQLite, the schema files
  services/      the use cases: record an expense, show one month, show the plan of one pay cycle; level 3: the assist path
  http/          the HTTP server and the handlers
  graph/         level 2: the engine, the state, the gates, the verifier, the trace, the record graph
  intelligence/  level 3: the model port, the stand-in, the Claude adapter, the gate, the memory, the suggest graph
    permitted/     level 3: the allowlist of capabilities, the action gate, the interpreter port and its two implementations
  import/        level 3: the import graph and its nodes, the pool, the workers, the reconciler
  main.ts        the composition root: the only file that knows all the parts
web/           the React web application
scripts/       the named scenarios (record, suggest, import, assist, plan), the world of a scenario, and the recorder
recordings/    runs.json: what the real code did in each scenario. The course page replays it.
tests/         tests of the architecture itself, the "AI off" tests, and one test for each repaired defect
```

## Commands

| Command | What it does |
|---|---|
| `npm run check` | Type check, all tests, and the check that the recordings are current. Do this after each change. |
| `npm test` | All tests. No test uses the network. |
| `npm run typecheck` | The TypeScript compiler, for the server and for the web application. |
| `npm run build` | Type check, then the web application goes into `web/dist`. |
| `npm run record-runs` | Sends each scenario through the real code and writes `recordings/runs.json`. |
| `npm run record-runs:check` | Fails if `recordings/runs.json` is not what the code does now. `npm run check` includes it. |
| `npm run dev` | The server and the web application together, with a restart after each change. |
| `npm start` | The server on http://127.0.0.1:8787, with the built web application. |

After a change to this folder, also run `python examples/tools/sync-studio.py` from the root of the repository. It copies the source files and the recordings into the course page.

## The HTTP API

Each path starts with `/api`. A request body and an answer are JSON. An error is `{ "error": { "code", "problems": [{ "rule", "text" }], "run_id"? } }`.

| Method and path | Level | What it does |
|---|---|---|
| `GET /api/health` | 1 | `{ ok, today }`. |
| `GET /api/categories` | 1 | The active categories, each with `kind` and `class`. |
| `GET /api/summary?period=YYYY-MM` | 1 | The expenses and the budgets of one month. |
| `GET /api/plan?date=YYYY-MM-DD` | 1 | The plan of the pay cycle that contains the date (without a date: today): the income, the input, the plan, the weeks with their caps, the pace, the savings, the insights and a headline. 400 for a date that is not a calendar day or that has no pay cycle in the calendar; 404 if no plan settings are on record. |
| `GET /api/weeks?date=YYYY-MM-DD` | 1 | Only the cycle, the weeks, the pace and the savings of that plan. |
| `POST /api/expenses` | 1, 2 | Records one expense through the record graph. `account` is optional. 201 for a new expense, 200 for a replay of the same request key. |
| `GET /api/runs/:id` | 2 | The trace of one run: each step, PASS or FAIL, the edge, the state after the step. |
| `POST /api/expenses/suggest` | 3 | A suggestion for the category of a merchant. 200 also when there is no suggestion. |
| `POST /api/imports` | 3 | `{ csv, account, mapping? }`. Reads the text and answers with a proposal (`step: "review"`) or asks for a mapping (`step: "mapping"`). Nothing is recorded. |
| `POST /api/imports/:id/mapping` | 3 | `{ mapping }`. Continues an import that waits for a mapping. 400 with the problems of the mapping gate; the import still waits. |
| `POST /api/imports/:id/decide` | 3 | `{ decisions: [{ line_no, category_id }], export_profile? }`. Records what the person decided. The answer has one end for each line, the reconciliation, and the text for a budget sheet. |
| `POST /api/assist` | 3 | `{ text }`. A request in plain words. 200 with a `status`: `AI_OFF`, `DAILY_CAP`, `MODEL_UNAVAILABLE`, `CLARIFY`, `DECLINED`, `REJECTED`, `DONE`, `FAILED` or `NEEDS_APPROVAL`. It changes no data. |
| `POST /api/assist/:id/decide` | 3 | `{ approve }`. The decision of the person for one stored proposal: `EXECUTED`, `DECLINED_BY_PERSON` or `FAILED`. 404 for an id that is not a stored proposal. |

## The recorded scenarios

`scripts/` has 33 named scenarios. Each is a small world, one request or two, the expected status and the exact path through the graph. `npm run record-runs` sends each one through the real HTTP server (SQLite in memory, a fixed clock, sequential ids, stand-ins for the two models) and writes `recordings/runs.json`.

| Scenarios | What they show |
|---|---|
| 9 of the record graph (level 2) | Each path of the record graph: PASS, the two gates, a replay, a retry, the store down, a failed check of the ledger |
| 9 of the suggest graph and the memory (level 3) | The memory, the model, the suggestion gate, the daily limit, the AI off |
| 5 of the import graph (level 3) | `import_northbank`, `import_harbour_after` (a transfer pairs, a pending row is held, a purchase and its reversal pair), `import_same_file_twice`, `import_unknown_layout`, `import_bad_mapping` |
| 9 of the assist path (level 3) | A question back, an analysis, an allowance change that the person approves or declines, a capability outside the allowlist, an input of the wrong shape, the model down, the AI off, a request to move money |
| `plan_worked_example` | `GET /api/plan` for the pay cycle 2026-01-25 to 2026-02-24 |

A scenario that runs no graph (the assist path, the plan) has `run: null` in the recording, and the HTTP exchange is the record. A scenario of two requests has both in `exchanges`. The recording also has the allowlist with the rules R15 to R18 (`assist`) and the worked example of the plan with its input (`plan_example`). An import proposal in the recording keeps the first 12 rows and has `rows_total`.

## The optional AI

Without a key, the AI is off. The application works the same. The merchant memory still gives suggestions.

To turn the AI on:

1. Make an API key in the Claude Console. Use a workspace of its own with a low spend limit.
2. Copy `.env.example` to `.env` and put the key in it. Git ignores `.env`.
3. Start the server again.

The key stays on the server. The web application never gets it. The model gets only the text of the merchant and the list of categories. It cannot write to the database: the suggest graph gets no store that can write.

A plan for the Claude apps (Pro, Max, Ultra) is not an API key, and the sign-in of a plan must not be put into an application. The chapter gives the sources.

### A request in plain words (the assist path)

`POST /api/assist` with `{ "text": "lower my weekly allowance" }` starts the assist path. Four kinds of step stay four different things:

1. **The model recommends.** It gets the text, the names of the four permitted capabilities and the list of categories. It gets no amount and no row of the ledger.
2. **The application validates.** The action gate checks the request against the allowlist, the shape and the facts of the application. For an allowance change the application calculates the consequences in cents (rule BR4 is the limit). A request that fails is `REJECTED`, and nothing is stored but the audit record.
3. **The person approves.** A capability that changes data gives `NEEDS_APPROVAL` with a proposal id and the consequences. `POST /api/assist/:id/decide` with `{ "approve": true }` or `false` is the decision. An id that is not a stored proposal gives 404.
4. **The application executes.** Its own services do the work. The only write is one number of the plan settings (the savings request), after an approval. No path of this kind writes a row of the ledger.

A capability that only reads (`analyse_spending`, `suggest_category`) is executed at once and gives `DONE`. Each request writes one record in `assist_audit`; the record has no text of the person: it keeps the field names and the numbers of the input, and of a text only its length. The path uses the same key, the same model setting and the same budget of calls as the suggestions. The budget counts the calls of one UTC day. Without a key the answer is `AI_OFF`, with a list of what the person can do without the model.

**Not run here:** a call to the real model. No test and no recording makes one: the tests use a stand-in for the SDK client, and the recordings use the stand-in interpreter and the stand-in suggester. The first call with a real key is yours to make.

## Limits that you must know

- **The server listens only on 127.0.0.1.** It has no sign-in. Do not make it listen on a network before you add authentication and HTTPS. The chapter has a section on this.
- **One process, one writer.** The record service runs one request at a time.
- **No offline mode.** The web application has a manifest and no service worker.
- **The plan comes from the seed.** The seed puts in the plan of a fictional person, Sam, who is paid on day 25: commitments, savings pots, buffer items. It does this only if no plan settings are on record. `GET /api/plan` and `GET /api/weeks` give the plan of a pay cycle; no figure of the plan is stored. The slice has no screen for the plan. An income row comes only from an import.
- **Budgets and categories come from the seed.** The slice has no screen that makes them. The seed makes budgets only for the month in which the server starts; a different month shows "No budget".
- **One import has 100 lines at most.** Divide a longer statement. The text of one request has 9000 characters at most.
- **An import reads pasted text.** It is not a connection to a bank. Two layouts are known (the fictional banks Northbank and Harbour Bank); a different layout needs a mapping, and each mapping passes the mapping gate. The web page offers the two sample accounts only.
- **A transfer is a match by amount and date, and it needs the other side in the ledger.** A row pairs only if the row of the other account is already recorded: import the account that the money left first, and give its transfer line a category. If the other side is not in the ledger, money that arrives is recorded as income. The ledger does not store which row has a partner, thus a row of a different account can pair again with a later file. If the money in was imported first, it stays income; the note of the pair says so. The review cannot undo a pair.
- **A refund with no reversal mark is income.** Only a row with a reversal mark that finds its purchase is kept out of the ledger. Each other row with money in is recorded as income when the person sends the decisions; the review has no choice for it.
- **An account name is in lower case.** "Cheque" and "cheque " are one account, because the name is part of the fingerprint of each row. A different name ("cheque account") is a different account, and its rows are new rows. Income has no rule for a similar row (same date, amount and source), as an expense has.
- **The export is text. No spreadsheet file is written.** The application makes tab-separated rows that you copy into a budget sheet. It never opens, makes or writes a sheet.
- **The assist path has one write.** An approved allowance change sets one number of the plan settings. If the service fails before the write, the answer is `FAILED` and the proposal still waits: the person can approve again. If the store fails after the write and before the outcome of the proposal is stored, the proposal still waits; a second approval finds the approved number in the settings and gives `EXECUTED` with no second write.
- **Two decisions for one import at the same time** record each line one time (the request keys protect the ledger), but the stored result can be that of the second request, which shows the lines as duplicates.
- **The calendar has the years 0100 to 9999.** A date whose pay cycle starts or ends outside it gets 400 from the plan endpoints. A row of the ledger with such a date is in no cycle of the plan.
- `node:sqlite` prints an `ExperimentalWarning` on some Node versions. It is not a failure.
