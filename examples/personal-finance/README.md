# Personal finance: the reference application of the Practical Architecture Studio

This folder is a small application. The chapter "Practical Architecture Studio" of the course *Permitted Paths* uses it to show how the ideas of the course become files, functions and tests.

The application does one thing fully: **it records an expense and updates the budget of the month**. All the data is fictional. The application does not connect to a bank, it moves no money, and it has no sign-in.

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

## The four levels

The application was made in four levels. Each level is one commit with a tag. Each level changes the same code; no level is a separate example.

| Level | Tag | What it adds | Tests |
|---|---|---|---|
| 1. Ordinary software | `studio-l1` | Contracts, a pure domain, repository ports, a service, an HTTP server, a React web application | 60 |
| 2. Graph structure | `studio-l2` | The service becomes an execution graph: typed state with owners, two gates, an independent verifier, a trace with checkpoints | 102 |
| 3. Intelligence layer | `studio-l3` | An optional category suggestion: merchant memory, cost control, a model behind a port, a suggestion gate | 139 |
| 4. Orchestration | `studio-l4` | The import of a statement: workers, a bounded pool, one budget, a wait for the person, a reconciler | 155 |
| After a review | (no tag) | Repairs: the server does not stop on a malformed address; a model call is reserved before it is made; merchant keys for each script; consistent import limits | 169 |

To see what one level changed:

```bash
git diff studio-l1 studio-l2 --stat -- .
```

`levels.json` gives the level of each file and the later levels that changed it.

## The folders

```
shared/        the contracts: the web application and the server import the same files
server/
  domain/        pure functions: the expense, the budget, the business rules
  repositories/  the ports of the stores, memory and SQLite, the schema files
  services/      the use cases
  http/          the HTTP server and the handlers
  graph/         level 2: the engine, the state, the gates, the verifier, the trace, the record graph
  intelligence/  level 3: the model port, the stand-in, the Claude adapter, the gate, the memory, the suggest graph
  import/        level 4: the parser, the pool, the workers, the reconciler, the import graph
  main.ts        the composition root: the only file that knows all the parts
web/           the React web application
scripts/       the named scenarios and the recorder
recordings/    runs.json: what the real code did in each scenario. The course page replays it.
fixtures/      a fictional statement
tests/         tests of the architecture itself, and the "AI off" tests
```

## Commands

| Command | What it does |
|---|---|
| `npm run check` | Type check, all tests, and the check that the recordings are current. Do this after each change. |
| `npm test` | All tests. No test uses the network. |
| `npm run typecheck` | The TypeScript compiler, for the server and for the web application. |
| `npm run build` | Type check, then the web application goes into `web/dist`. |
| `npm run record-runs` | Sends each scenario through the real code and writes `recordings/runs.json`. |

After a change to this folder, also run `python examples/tools/sync-studio.py` from the root of the repository. It copies the source files and the recordings into the course page.

## The optional AI

Without a key, the AI is off. The application works the same. The merchant memory still gives suggestions.

To turn the AI on:

1. Make an API key in the Claude Console. Use a workspace of its own with a low spend limit.
2. Copy `.env.example` to `.env` and put the key in it. Git ignores `.env`.
3. Start the server again.

The key stays on the server. The web application never gets it. The model gets only the text of the merchant and the list of categories. It cannot write to the database: the suggest graph gets no store that can write.

A plan for the Claude apps (Pro, Max, Ultra) is not an API key, and the sign-in of a plan must not be put into an application. The chapter gives the sources.

**Not tested here:** a call to the real model. The tests use a stand-in for the SDK client. The first call with a real key is yours to make.

## Limits that you must know

- **The server listens only on 127.0.0.1.** It has no sign-in. Do not make it listen on a network before you add authentication and HTTPS. The chapter has a section on this.
- **One process, one writer.** The record service runs one request at a time.
- **No offline mode.** The web application has a manifest and no service worker.
- **Budgets and categories come from the seed.** The slice has no screen that makes them. The seed makes budgets only for the month in which the server starts; a different month shows "No budget".
- **One import has 100 lines at most.** Divide a longer statement.
- `node:sqlite` prints an `ExperimentalWarning` on some Node versions. It is not a failure.
