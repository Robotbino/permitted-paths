# Permitted Paths: Graph Engineering for Agents

An interactive course on taking decisions away from the model: nodes, edges, state and gates. Nine parts, a practical lab, and about twenty hands-on instruments, all in plain HTML, CSS and JavaScript.

## Start here

**Open [`index.html`](index.html) in a browser.** That's the whole site. There is no build step, no install, no server and no network request.

```bash
git clone git@github.com:Robotbino/permitted-paths.git
cd permitted-paths
start index.html        # Windows; use `open` on macOS or `xdg-open` on Linux
```

Double-clicking `index.html` works too. To run the self-checks, open [`tests.html`](tests.html) the same way.

## What's in the repository

| Path | What it is |
|---|---|
| **`index.html`** | **The course. Start here.** |
| `tests.html` | Browser-run assertions for the engines and the data |
| `css/`, `js/`, `assets/` | What `index.html` loads (styles, scripts, fonts) |
| `lab/` | Working files for part L, "Operate it from your phone" (see [`lab/README.md`](lab/README.md)) |
| `docs/` | [`REPORT.md`](docs/REPORT.md) (how it was built), [`SOURCES.md`](docs/SOURCES.md) (section-by-section mapping to the notes), [`EVIDENCE.md`](docs/EVIDENCE.md) (status of each factual claim) |
| `backups/` | Earlier versions of edited files, at their original paths. The site never loads them. |

## About the content

The course is built from the nine `GE 00–08` notes in the author's Obsidian vault. It is a presentation layer: the notes are the source of truth and this project does not change them. Part L is different: a practical lab added by this edition, researched from official documents on 2026-11-12, not from the notes.

Progress, gate results, the trace and the text you put into "Your own prompt" are kept in the browser's `localStorage` (key `permitted-paths.v1`) and go nowhere else. **New run** in the top bar removes them. The page still works when storage is blocked or holds damaged data; it then starts a new run. Two open tabs share the same progress.

Source chips such as `GE 04 §5` open the note in Obsidian through an `obsidian://` link, so they only work on a machine with the vault. If the vault or the folder is renamed, change `vault` and `noteFolder` in `js/data/sources.js`.

## How it is organised

```
index.html            all prose, as semantic HTML; one <section class="chapter"> per part
tests.html            browser-run assertions
css/
  tokens.css          every colour, font and duration (light-dark() pairs); nothing else declares them
  base.css            reset, typography, tables, code
  layout.css          top bar, path rail, chapter frame, bench
  components.css      buttons, chips, stamps, callouts, drawers, the gate, the graph drawing
  labs.css            styles of the individual instruments
js/core/
  dom.js              GE namespace, element helpers, stamp, segmented control
  rng.js              seeded random numbers (every simulation is repeatable for a seed)
  store.js            localStorage wrapper and the learner's trace
  motion.js           one shared animation loop; honours prefers-reduced-motion
  graph-runner.js     GE.runGraph: interpreter for an execution graph; GE.player: plays a run on a drawing
  graph-view.js       GE.graphView: draws a graph as SVG from hand-positioned data
  ontology.js         the game-store ontology (R1–R8), validate_status, Gate 1, Gate 2, plan gate, note validator
  gate.js             the checkpoint at the end of a part (PASS / FAIL, two attempts, then it escalates)
  app.js              router, rail, theme, source links, lazy start of instruments (load last)
js/data/
  sources.js          vault name, note files, chapter list
  graphs.js           every drawing as data (nodes, edges, reading steps)
  gates.js            gate questions, answers and causes, each with its source section
  reference.js        glossary, incorrect ideas, checklist, ladder, sources, recall questions
js/labs/              one file per group of instruments; each registers GE.labs.<name>
                      (own.js holds "Your own prompt", the four failure stories and the one-page takeaway)
assets/fonts/         Nohemi, Atkinson Hyperlegible, JetBrains Mono (copied from your other projects)
```

Scripts are classic `<script>` files under one `GE` namespace, not ES modules, because modules and `fetch` do not work from `file://`.

### The three shared engines

| Engine | File | Used by |
|---|---|---|
| `GE.runGraph` + `GE.player` | `core/graph-runner.js` | decision ledger, loan procedure, factory floor, two-gate bench |
| `GE.graphView` | `core/graph-view.js` | every drawing |
| `GE.onto` | `core/ontology.js` | validator, fact workbench, two-gate bench, transitions, factory plan gate, note validator |

`GE.runGraph` enforces the state contract: a node that writes a field it does not own throws an error.

## Maintain it

**Change text.** Edit `index.html`. Keep the vocabulary rules of GE 00: `edge` for an execution graph, `relation` for an ontology or knowledge graph, `path` (never "route"), `PASS` / `FAIL`.

**Change a drawing.** Edit its entry in `js/data/graphs.js`. `x, y` is the centre of a node; use `fromSide` / `toSide` / `via` to route an edge and `lx` / `ly` to place its label. `tests.html` checks that every edge and reading step points at something that exists.

**Add an instrument.**
1. Put a mount point in `index.html`: `<div data-lab="myLab">fallback text for no JavaScript</div>`, usually inside a `<figure class="bench">`.
2. Register it in a file under `js/labs/`: `GE.labs.myLab = function (el, chapterKey) { … }` and build the DOM with `GE.h`.
3. Call `GE.trace.lab('myLab', chapterKey)` once the learner has used it, so it shows in the trace. Add its name to `LAB_NAMES` in `js/labs/capstone.js`.
4. Add the `<script>` tag to `index.html` before `js/core/app.js`.

**Add a gate question.** Add it to `js/data/gates.js` (`kind: 'choice'` or `'assign'`) with a `source`, a `hint` (shown after the first FAIL; it must not give the answer) and `at` (the id of the heading to read again; every `<h2>` has an id of the form `p<part>-<words-of-the-heading>`). The answers are shown in a new sequence each time. Prefer a new case over a sentence from the text, and keep the correct answer from being the longest one: `tests.html` checks one correct answer per question, a hint and a section for each, and the length rule.

**Keep predictions real.** Where an instrument asks for a prediction, the action button stays disabled until the learner has made one (ledger, workbench, two-gate bench, factory, validator). Do not label a preset with its own answer.

**Add a part.** Add a `<section class="chapter" data-chapter="9">` with an `<h1>`, a rail item in the `<nav class="rail">`, and an entry in `GE.data.chapters`.

**Colours and type.** Change them only in `css/tokens.css`. The four role colours (`--code`, `--model`, `--agent`, `--person`) carry meaning and are not used for decoration or for actions.

## Content rules that the course follows

- Nothing is stated with more confidence than the notes state it. The notes are marked `verified: false`; the numbers from talks are demonstrations, not benchmarks, and the course says so where they appear.
- Three marks show where a statement comes from: *from a source*, *summary by the notes*, *added by this edition*.
- Every simulation is labelled as one. None calls a real model; outcomes come from fixed data and a seeded random number.
- The images in the notes are not copied here. Seven of the ten need the owner's permission before publication, so every figure is a new SVG drawing of the same content.

See [`docs/SOURCES.md`](docs/SOURCES.md) for the section-by-section mapping to the notes.

## Part L: the practical laboratory

Part L designs a system that you operate from your phone: Claude Code, an automation platform and your notes. It is one more `<section class="chapter is-lab" data-chapter="lab">` and uses the same engines as the other parts.

```
css/phone-lab.css       styles of part L (tokens of tokens.css only)
js/data/phone-lab.js    all content as data: components, connections, the three architectures,
                        the two lifecycles, the costs, the milestones, and the gate of part L
js/labs/phone-lab.js    the instruments: phoneArch, phoneLife, phoneIntake, phoneCost, phoneRoad, copy
lab/                    the working files that the page shows (bridge, n8n workflow, Claude Code settings);
                        lab/README.md says how to start them and what was tested
```

**Change a price, a limit or an exchange rate.** Edit `js/data/phone-lab.js` (`P.fx`, `P.power`, `P.plans`, `P.scenarios`) and the tables in `index.html`. Change the research date in the head of part L and in `P.researched`. `tests.html` has assertions for the cost sums: change them with the numbers.

**Change a drawing of an architecture.** Edit `P.archs` in `js/data/phone-lab.js`. A node is `n(componentId, x)`; the layer of the component gives the band. Column centres are 125, 323, 521, 719 and 917. An edge names a connection in `P.links`. `via` and `ly` can name a layer in place of a y value: `[224, 'orch', 12]`. `tests.html` checks that each node, edge and failure points at something that exists.

**Change a file in `lab/`.** The page has a copy of each file, because a page from `file://` cannot read them. After a change run `python lab/tools/sync-page.py`. It rewrites only the blocks that have `data-file="lab/…"`. After a change to the bridge also run `node lab/bridge/test/run.mjs`.

**Rules of part L.** Each component and each step has one of four marks: *Use it today*, *You configure it*, *You build it*, *You decide*. Each price and each capability has a source link and the research date. Each instrument that shows a run is labelled as a simulation. The existing meaning of line quality is kept: a dashed line is something a model selects; a thick dash-dot line is code that you write.

## Search

`js/core/search.js` adds a Search button to the top bar (also `/` or Ctrl+K). When the search first opens, it makes an index from the page: each part, each `h2` with an `id`, each instrument (`figure.bench`, which gets an `id` from its title), and the glossary terms in `js/data/reference.js`. A word matches at the start of a word, and small words such as "to" and "the" are not used. Text that only an instrument makes is not in the index. A new section is searchable when its `h2` has an `id`.
