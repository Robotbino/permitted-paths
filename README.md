# Permitted Paths: Graph Engineering for Agents

This repository contains an interactive course. The course shows how to move decisions from a model to a system. Its subjects are nodes, edges, state and gates.

The course has nine parts, a practical laboratory, a practical architecture studio and approximately twenty-five instruments. The course is HTML, CSS and JavaScript. The studio has a small TypeScript application in `examples/personal-finance/`.

## Start

The course is online: https://robotbino.github.io/permitted-paths/

To use the course on your computer, open [`index.html`](index.html) in a browser. A build step, an installation, a server and a network connection are not necessary.

```bash
git clone git@github.com:Robotbino/permitted-paths.git
cd permitted-paths
start index.html        # Windows. Use `open` on macOS or `xdg-open` on Linux.
```

To do the tests, open [`tests.html`](tests.html) in a browser. The page shows the results as PASS and FAIL.

## Contents of the repository

| Path | Contents |
|---|---|
| **`index.html`** | **The course. Start here.** |
| `tests.html` | Tests for the engines and the data. They operate in the browser. |
| `css/`, `js/`, `assets/` | The files that `index.html` loads: styles, scripts and fonts |
| `lab/` | The files of part L, "Operate it from your phone". Refer to [`lab/README.md`](lab/README.md). |
| `examples/` | The reference application of part S, "Practical Architecture Studio", and the tool that copies it into the page. Refer to [`examples/personal-finance/README.md`](examples/personal-finance/README.md). |
| `presentation/` | The source of the slide deck that teaches the course, and exported copies. Refer to [`presentation/README.md`](presentation/README.md). |
| `docs/` | [`REPORT.md`](docs/REPORT.md): how the course was made. [`SOURCES.md`](docs/SOURCES.md): the relation between each section and the notes. [`EVIDENCE.md`](docs/EVIDENCE.md): the status of each claim. |
| `notes/` | A copy of each of the nine source notes. Refer to [`notes/README.md`](notes/README.md). |
| `backups/` | Old versions of changed files, at their initial paths. The site does not load them. |

## The content

The course comes from the nine notes `GE 00` to `GE 08` of the author. The notes are the source. The folder [`notes/`](notes/) has a copy of each note. This project shows the content of the notes and does not change the notes.

Part L is different. This edition added part L as a practical laboratory. The content of part L comes from official documents, not from the notes. The research date is 2026-11-12.

The browser keeps these items in `localStorage`, with the key `permitted-paths.v1`:

- your progress
- the gate results
- the trace
- the text that you put into "Your own prompt"

The page does not send these items to a different location. **New run** in the top bar removes them. If storage is not available, or if the data is damaged, the page starts a new run. Two open tabs use the same progress.

A source chip, for example `GE 04 §5`, opens the copy of the note in `notes/`, in a new tab. The link goes to the page of the note on GitHub, thus a network connection is necessary for it. To read the copies with no network, set `noteBase` in `js/data/sources.js` to `notes/`. If you move the repository, change `noteBase`.

## Structure

```
index.html            all the text, as semantic HTML. One <section class="chapter"> for each part.
tests.html            the tests. They operate in the browser.
css/
  tokens.css          each colour, font and duration (light-dark() pairs). No other file sets them.
  base.css            reset, typography, tables, code
  layout.css          top bar, path rail, chapter frame, bench
  components.css      buttons, chips, stamps, callouts, drawers, the gate, the graph drawing
  labs.css            styles of the instruments
  agent-run.css       styles of the agent trace in part 2
js/core/
  dom.js              the GE namespace, element helpers, stamp, segmented control
  rng.js              seeded random numbers. For one seed, a simulation always gives the same result.
  store.js            the localStorage wrapper and the trace of the learner
  motion.js           one shared animation loop. It obeys prefers-reduced-motion.
  graph-runner.js     GE.runGraph: the interpreter for an execution graph. GE.player: shows a run on a drawing.
  graph-view.js       GE.graphView: draws a graph as SVG. A person set the position of each node.
  ontology.js         the game-store ontology (R1 to R8), validate_status, Gate 1, Gate 2, plan gate, note validator
  gate.js             the checkpoint at the end of a part: PASS or FAIL, two attempts, then it escalates
  app.js              router, rail, theme, source links, delayed start of the instruments. Load this file last.
js/data/
  sources.js          address of the notes, note files, chapter list
  graphs.js           each drawing as data: nodes, edges, reading steps
  gates.js            gate questions, answers and causes. Each question has its source section.
  reference.js        glossary, incorrect ideas, checklist, ladder, sources, recall questions
js/labs/              one file for each group of instruments. Each file registers GE.labs.<name>.
                      own.js contains "Your own prompt", the four failure stories and the one-page takeaway.
assets/fonts/         Instrument Serif (titles; SIL OFL, the licence is in the same folder), Nohemi,
                      Atkinson Hyperlegible, JetBrains Mono
```

The scripts are classic `<script>` files in one `GE` namespace. They are not ES modules, because modules and `fetch` do not operate from `file://`.

### The three shared engines

| Engine | File | Instruments that use it |
|---|---|---|
| `GE.runGraph` and `GE.player` | `core/graph-runner.js` | decision ledger, loan procedure, factory floor, two-gate bench |
| `GE.graphView` | `core/graph-view.js` | each drawing |
| `GE.onto` | `core/ontology.js` | validator, fact workbench, two-gate bench, transitions, factory plan gate, note validator |

`GE.runGraph` enforces the state contract. If a node writes a field that it does not own, the engine gives an error.

## Maintenance

### After a change

1. Open `tests.html` and make sure that no test gives FAIL.
2. If the change is important, write it in `docs/REPORT.md`.

### Change the text

Change `index.html`. Write short sentences in simplified English. Obey the vocabulary rules of GE 00:

- Use `edge` for an execution graph.
- Use `relation` for an ontology or a knowledge graph.
- Use `path`. Do not use "route".
- Use `PASS` and `FAIL`.

### Change a drawing

1. Change the entry of the drawing in `js/data/graphs.js`.
2. `x, y` is the centre of a node.
3. Use `fromSide`, `toSide` and `via` to set the path of an edge.
4. Use `lx` and `ly` to set the position of the label of an edge.

`tests.html` makes sure that each edge and each reading step refers to an item that exists.

### Add an instrument

1. Put a mount point in `index.html`: `<div data-lab="myLab">text for a browser with no JavaScript</div>`. Usually, put it in a `<figure class="bench">`.
2. Register the instrument in a file in `js/labs/`: `GE.labs.myLab = function (el, chapterKey) { … }`. Make the DOM with `GE.h`.
3. After the learner uses the instrument, call `GE.trace.lab('myLab', chapterKey)`. Then the instrument shows in the trace.
4. If the capstone must count the instrument, add its name to `INSTRUMENTS` in `js/labs/capstone.js`. The instruments of part L and part S are not in that list.
5. Add the `<script>` tag to `index.html`, before `js/core/app.js`.

### Add a gate question

Add the question to `js/data/gates.js`. Give the question these fields:

| Field | Contents |
|---|---|
| `kind` | `'choice'` or `'assign'` |
| `source` | The source section |
| `hint` | The page shows the hint after the first FAIL. The hint must not give the answer. |
| `at` | The id of the heading that the learner must read again |

Each `<h2>` has an id of the form `p<part>-<words-of-the-heading>`. The page shows the answers in a new sequence each time.

Use a new case for the question, not a sentence from the text. Make sure that the correct answer is not the longest answer.

`tests.html` makes sure that each question has one correct answer, a hint and a section. It also makes sure that each question obeys the length rule.

### Keep the predictions

Some instruments ask for a prediction: the ledger, the workbench, the two-gate bench, the factory and the validator. The action button stays disabled until the learner makes a prediction. Do not put the answer in the label of a preset.

### Add a part

Add these three items:

- a `<section class="chapter" data-chapter="9">` with an `<h1>`
- a rail item in `<nav class="rail">`
- an entry in `GE.data.chapters`

For a part whose key is not a digit (as `lab` and `studio`), also add the key in two locations of `js/core/app.js`: the locator of the top bar and the figure prefix `--ch-dot`.

### Change the colours and the type

Change the colours and the type only in `css/tokens.css`.

The type has four voices:

| Token | Use |
|---|---|
| `--font-serif` | titles, questions and ledes |
| `--font-display` | instruments and controls |
| `--font-text` | the text of the course |
| `--font-mono` | data |

The four role colours are `--code`, `--model`, `--agent` and `--person`. Each role colour has a meaning. Do not use a role colour for decoration or for an action.

## Content rules

- The course does not give a statement with more confidence than the notes give. The notes have the mark `verified: false`. The numbers from talks are demonstrations, not benchmarks. The course says this where it shows the numbers.
- Three marks show the source of a statement: *from a source*, *summary by the notes*, and *added by this edition*.
- Each simulation has a label that says that it is a simulation. No simulation calls a real model. The results come from fixed data and a seeded random number.
- The images in the notes are not in this repository. For seven of the ten images, the permission of the owner is necessary before publication. Thus each figure is a new SVG drawing of the same content.

[`docs/SOURCES.md`](docs/SOURCES.md) gives the relation between each section and the notes.

## Part L: the practical laboratory

Part L is the design of a system that you operate from your phone. The system uses Claude Code, an automation platform and your notes. Part L is one more `<section class="chapter is-lab" data-chapter="lab">`. It uses the same engines as the other parts.

```
css/phone-lab.css       styles of part L. It uses only the tokens of tokens.css.
js/data/phone-lab.js    all the content as data: components, connections, the three architectures,
                        the two lifecycles, the costs, the milestones, and the gate of part L
js/labs/phone-lab.js    the instruments: phoneArch, phoneLife, phoneIntake, phoneCost, phoneRoad, copy
lab/                    the files that the page shows: the bridge, the n8n workflow, the Claude Code settings.
                        lab/README.md tells you how to start them and which tests were done.
```

### Change a price, a limit or an exchange rate

1. Change `js/data/phone-lab.js`: `P.fx`, `P.power`, `P.plans` and `P.scenarios`.
2. Change the tables in `index.html`.
3. Change the research date in the head of part L and in `P.researched`.
4. Change the assertions for the cost sums in `tests.html`. They must agree with the new numbers.

### Change a drawing of an architecture

Change `P.archs` in `js/data/phone-lab.js`.

- A node is `n(componentId, x)`. The layer of the component gives the band.
- The column centres are 125, 323, 521, 719 and 917.
- An edge gives the name of a connection in `P.links`.
- `via` and `ly` can give the name of a layer as an alternative to a y value: `[224, 'orch', 12]`.

`tests.html` makes sure that each node, each edge and each failure refers to an item that exists.

### Change a file in `lab/`

The page has a copy of each file, because a page from `file://` cannot read the files.

1. After a change, run `python lab/tools/sync-page.py`. The tool changes only the blocks that have `data-file="lab/…"`.
2. After a change to the bridge, also run `node lab/bridge/test/run.mjs`.

### Rules of part L

- Each component and each step has one of four marks: *Use it today*, *You configure it*, *You build it*, *You decide*.
- Each price and each capability has a source link and the research date.
- Each instrument that shows a run has a label that says that it is a simulation.
- The line types keep their meaning. A dashed line is an item that a model selects. A thick dash-dot line is code that you write.

## Search

`js/core/search.js` adds a Search button to the top bar. You can also push `/` or Ctrl+K.

When the search opens for the first time, it makes an index from the page. The index contains these items:

- each part
- each `h2` that has an `id`
- each instrument: a `figure.bench`, which gets an `id` from its title
- the glossary terms in `js/data/reference.js`

A search word must be at the start of a word in the index. The search does not use small words, for example "to" and "the". Text that only an instrument makes is not in the index.

To put a new section in the search, give its `h2` an `id`.

## Part S: the practical architecture studio

Part S shows how an everyday problem that a person describes in one sentence becomes a dependable application, and where a model belongs in it. The case is a budgeting system for a fictional person. It is one more `<section class="chapter is-lab is-studio" data-chapter="studio">`, between part L and the reference shelf. Its content is not from the notes. The research date of its product facts is 2026-11-14.

```
examples/personal-finance/   the reference application: TypeScript, React, Node, SQLite. It has its own README.
examples/tools/sync-studio.py  copies the source files, the recordings and the shared functions into the page
examples/tools/studio-entry.ts the list of the functions of the application that the page runs
css/studio.css               styles of part S. It uses only the tokens of tokens.css.
js/data/studio.js            the seven drawings, the replays, the questions, and the gate of part S
js/data/studio-files.js      GENERATED: each source file with its level and its role
js/data/studio-runs.js       GENERATED: what the real code did in 33 scenarios
js/data/studio-domain.js     GENERATED: the planning, pipeline and export functions of the application, as one script (GE.domain)
js/labs/studio.js            the instruments: studioLevels, studioDiagram, studioRun, studioExplorer, studioCheck
js/labs/studio-live.js       the instruments that run GE.domain or replay a request: studioSort, studioPlan, studioPipeline, studioInsights, studioAssist
```

The application has three levels: an ordinary application, structured workflows, a model inside permitted paths. `levels.json` gives the level of each file, and a test of the application checks it. The git tags `studio-l1` to `studio-l4` are the code of the first edition of the part, which had four levels.

**The page runs the code of the application.** The folders `shared/planning`, `shared/pipeline` and `shared/export` use no Node API and no store. The sync tool makes one classic script from them with esbuild (a development package of the application; run `npm install` in `examples/personal-finance` one time). The calculator and the pipeline of the part call those functions, and `tests.html` compares their results with the recordings of the server.

### Change the reference application

1. Change the files in `examples/personal-finance/`.
2. In that folder, run `npm run check`. It does the type check, the tests and the check of the recordings. If a recording changed on purpose, run `npm run record-runs` first.
3. If you added a file, add it to `levels.json` with its level and its role. A test fails if you do not.
4. From the root, run `python examples/tools/sync-studio.py`. It writes the three generated files and the code blocks of the page.
5. Open `tests.html`.

`python examples/tools/sync-studio.py --check` writes nothing and gives FAIL if a generated file is not current. The tool refuses a file that contains a key or a path of a computer.

### Change a drawing of part S

Change `GE.data.studio.drawings` in `js/data/studio.js`.

- A node and an edge have a `level` (1 to 3). The lens of the drawing makes a later level faint.
- A drawing with `graph` is the drawing of a real execution graph. `tests.html` compares its nodes and edges with the recording. A node with `outside: true` is not part of that graph.
- The text of each component is not in the data file. It is in the table that is inside the mount of the drawing in `index.html`: a row with `data-node="<id>"` or `data-edge="<from>><to>"`. The instrument reads the table, and a browser with no JavaScript shows the table.

### Rules of part S

- No instrument of part S is a simulation. `studioRun` and `studioAssist` play a recording of the real code; `studioPlan`, `studioPipeline` and `studioInsights` run the functions of the application. Where a scenario has a model, the model is a stand-in, and the page says so.
- The person, the banks, the amounts and the files of the case are fictional. Do not put data of a real person into the part or into the application.
- Each product fact has a source link. A statement that reads more into a document than the document says has the mark "The reading of this edition".
- The part says what was not run: a call to the real model, a real bank file, and a real iPhone.
- Each source in the list of sources has a mark: Read, Abstract only, or Not confirmed. Do not add a source that nobody opened.
- A file name in the text is a link with `data-st-file`. With JavaScript it opens the file in the explorer of the page.
