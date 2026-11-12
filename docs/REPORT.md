# Implementation report — Permitted Paths

Built 2026-11-12 from the nine `GE 00–08` notes. The notes were not changed.

## What was built

A no-build, no-network interactive course: `index.html` plus five stylesheets, 24 scripts and six font files. Nine parts and a reference shelf, 19 instruments with a result the page can examine, 7 further drawings that are read in steps or by lens, 7 part gates, a capstone gate and a four-story failure gate, a browser test page with 66 assertions, `README.md` and `SOURCES.md`. (The first version of this report counted 25 "instruments"; an adversarial review rightly objected that several were figures.)

## The learning journey

The course is itself an execution graph and the learner is a run. Each part is a node on the path rail; each part ends in a gate that returns PASS or FAIL with the cause, allows two attempts, then escalates to the worked answer; everything is written to a trace that part 8 shows back as a context graph.

| Part | Question | Signature instrument |
|---|---|---|
| 0 The claim | What is the idea? | The full system, read in five steps |
| 1 The same question, five answers | Why does output change? | Ask five times; the compounding machine |
| 2 Take decisions away from the model | What does a graph remove? | The decision ledger with a ten-run measurement |
| 3 Four things with the name "graph" | Which graph? | Four lenses; the loan procedure with branch coverage |
| 4 Say what is permitted | How is a rule enforced? | Validator, fact workbench, two-gate bench, reasoner |
| 5 What the system knows | Where does knowledge live? | Plane sorter; three paths from a trace |
| 6 The factory | How do the controls combine? | The factory floor (scenarios A, B, C, ON_HOLD) |
| 7 A small real one | What is the minimum? | Note walker, graph validator, baseline |
| 8 Give it back | Can you explain it? | Label every arrow; four free-recall questions; your trace |

One thread runs through it, as in the notes: the learner's five results for order 1042 from part 1 go into the validator in part 4, and the same kind of bad status is stopped by the plan gate in part 6. Each gate also asks one question from the previous part.

## The most important interactions

1. **The compounding machine** — estimate, release 100 runs through `n` steps, then turn model decisions into code and watch the survival rate rise.
2. **The decision ledger** — move each decision out of the model; the prompt sentence becomes a node or an edge in the drawing; run ten times before and after and compare the counts (the notes' own measuring procedure).
3. **The two-gate bench** — predict where each proposal stops. The same valid call commits once and is rejected the second time, with Gate 1 still accepting it: the reason Gate 2 needs the current facts.
4. **The loan procedure** — after twelve usual cases, two branches stay thin and grey: no run has used them, so they have no evidence.
5. **The factory floor** — a real interpreter runs the 12-node graph; the state contract fills in field by field with its owner; scenario C's two runs end on the same entities and status values.
6. **Infer, or reject?** — predict what OWL does with two refunds before seeing it next to SHACL.

## Patterns adapted from existing projects

- **PorfolioWebsite** (`docs/onboarding.html`, constellation, frame-pulse): data-driven SVG graph with dim-all-but-focus; node-position morph for the four lenses; one shared animation loop that pauses on a hidden tab.
- **gameStore** (`docs/index.html`, `DESIGN.md`): `light-dark()` token pairs and a pre-paint theme script; view-transition theme change; "continue where you stopped"; the stored quiz as the starting point for the gate; motion scale; one colour, one job.
- **CodePairs**: paper-and-ink ground (cooled to a drafting-paper white), shake feedback using the individual `translate` property, tactile but stable buttons.
- Fonts already self-hosted in those projects: Nohemi, Atkinson Hyperlegible, JetBrains Mono.
- Not inherited: frameworks, WebGL, hidden scrollbars, CDN fonts, runtime Mermaid, confetti.

## Design references and their influence

- **Impeccable** (read mode, motion, slop list): plain reading column with the identity in the frame; durations and easing; no gradient text, eyebrows or glow.
- **Better Typography**: unitless line heights, tracking by size, `text-wrap`, tabular figures, real quotes.
- **Design Intelligence (RYUX)**: no invented data, every state defined, one meaning per colour and shape, colour never alone.
- **Hallmark**: tokens only in `:root`, `overflow-x: clip`, transform/opacity motion, content visible without scripts.
- **interface-design** (read from its GitHub source; the site returned HTTP 402): type ratio, text levels.
- **Taste Skill**: checks at several widths.
- **Not used**: Google Stitch (could not be accessed), Craftwork and Hue (no usable rules).

The distinctive rule is the notes' own: a ruled, continuous line is fixed; a wavering or dashed line is something a model selects. The four role colours appear only with that meaning.

## Source notes incorporated

All nine. `SOURCES.md` maps every part, instrument and reference drawer to its note and section, and lists everything this edition added (simulation data, example cases, example people and facts). The ten images in the notes are not copied; each is replaced by a new drawing or a table.

## QA performed

| Check | Result |
|---|---|
| Engine and data assertions (`tests.html`) | PASS — 59 of 59, served and opened from `file://` |
| Opens from `file://` (headless Edge) | PASS — router, instruments and source links work |
| Every instrument driven end to end by script in the browser | PASS — no console errors |
| Page-level horizontal overflow at 375 px, all parts | PASS — none |
| Tap targets under 34 px at 375 px | PASS — none |
| Contrast, light and dark, 21 token pairs | PASS — text ≥ 5.0:1, control edges ≥ 3.0:1 |
| Visual inspection at 1024 px, light and dark | Done; fixed cramped side-by-side layouts, a selector clash, lens spacing |
| Instructional review against the notes (independent reviewer) | 2 high, 11 medium, 15 low — all applied |
| Engineering review (independent reviewer) | 1 high, 13 medium, 19 low — high and medium applied; see below |
| Screenshots at phone width | NOT VERIFIED — the preview could not capture a usable image at 375 px; layout was verified by measurement only |
| Reduced motion | NOT VERIFIED in a browser — the code path (tweens jump to the end, stepped playback) was reviewed, not exercised |
| Screen reader | NOT VERIFIED |
| Firefox and Safari | NOT VERIFIED — tested in Chromium only |

Notable fixes from the reviews: the workbench now uses Order → OrderLine → Game as in GE 06; scenario C rejects `Return`/`RETURNED` in both runs; scenario B no longer claims to be the notes' run 57; the state-contract table and several dropped qualifications were restored; the skip link no longer jumps to part 0; the run player can no longer be confused by Reset or Pause mid-travel; the phone rail is sticky; wrong answers carry a text mark, not only colour; print uses the light theme; links work with JavaScript off.

## Remaining limitations

- **Not fixed from the engineering review:** the first bench title in parts 1–4 is an `h3` before any `h2`; scroll position is not restored on Back; the top bar may clip below about 350 px wide; `aria-pressed` is used on some answer-reveal states; some small duplication (`MAX_ATTEMPTS` in three files, a repeated verdict pattern).
- **The wavering-line filter** (`#ge-wobble`) is an SVG turbulence filter per model/agent node. It was not profiled; if a slow machine struggles, replace it with a precomputed jittered path in `graph-view.js`.
- **The execution lens** in part 3 draws one pass, not the branches; the note beside it says so.
- **Simulation numbers** (answer probabilities, how often the model ignores a prompt sentence, two attempts per cycle) are examples chosen for this edition and are labelled as such.
- **The source notes are AI-drafted and marked `verified: false`.** The course is faithful to them; it does not verify them against the original talks and papers.
- Nothing is committed to git; the folder is not a repository.

---

## Adversarial review, second round

Two reviewers were told to attack the result, and a third pass used real screenshots.

**Teaching (read-only, hostile instructional review).** Its verdict was that the first version's claim was inflated: about two thirds of each part was the notes as tables, most instruments could be finished by clicking in order, and the gates could be passed without knowledge (17 of 20 correct answers were option 2). What changed in response:

- **Gates rebuilt.** Answers appear in a new sequence each time. The first FAIL gives a hint and a link back to the section, not the answer. Two-category sorts no longer mark the wrong rows. Most questions are now new cases rather than sentences from the text, with plausible wrong answers, and the correct answer is the single longest option in at most one question in five (asserted in `tests.html`). The summary lists each question with its result.
- **A FAIL has an edge back.** The next part shows a notice with a link to the gate, the rail marks it, and part 8 lists the gates to try again. The page now says plainly that it records a FAIL but does not stop the learner, and that a real gate does.
- **Transfer to the learner's own work.** New in part 2: paste a system prompt or skill file, the page divides it into sentences, and the learner gives each one a location (node, edge, gate, prompt, not a rule). Part 8 turns the result into a first work list on a printable page. This is exercise 2 of the notes, which the first version had hidden in a drawer.
- **Predictions are enforced.** The ledger, workbench, two-gate bench and factory keep their action disabled until a prediction is made. Proposal presets are named "Proposal 1…7" instead of describing their own defect; workbench presets fill the form instead of submitting it; the sentence that gave away the OWL answer above the OWL prediction is gone; the cases of "script, loop, harness or graph" come in a new sequence each time.
- **The ledger's measurement is honest.** Ten runs are shown as the notes' procedure, but two structures are compared on 400 runs with a fixed seed, because the ten-run count went the wrong way in 30–70% of comparisons. The feedback is computed from the real change. The page states that the ignore-rates are deliberately high and that a graph does not correct an error inside a node.
- **The factory has a counterfactual.** A switch removes the plan gate; the same request then carries `PENDING_SHIP` (or `Return`/`RETURNED`, or `ON_HOLD`) into the pull request.
- **"Permitted" is not "correct".** After the validator runs, the learner is asked whether PASS means correct, using a value that passes and is wrong (GE 04 §9). Gate 4 asks the same in a case.
- **Less notes-as-tables on the main path.** Nine tables that an instrument already shows moved into drawers; part 0 opens with a concrete failure instead of the abstract claim, and its housekeeping moved into a drawer; the six-sentence ordering task was cut; part 8 gained four failure stories.
- **Wording.** "Part" no longer means both a course part and a component; "escalate" is explained where it is used; grading buttons and the lint check no longer share one label.

**Breakage (10,500 seeded random actions, corrupt storage, router fuzzing, eight widths, keyboard only, no JavaScript, print).** No crash, hang or injected markup in normal use. Fixed: one `null` in the saved trace stopped every instrument (HIGH); two tabs erased each other's progress; a non-object saved checklist threw on every click; "New run" was clipped at 320 px; printing produced "needs JavaScript" 33 times; the sticky bars covered over half of a short or very narrow window; plus the reasoner dead end, runs continuing in a part the learner had left, theme-toggle errors on key repeat, a junk saved theme, empty gates without JavaScript, and small touch targets.

**Screenshots (true device emulation).** Fixed: run counts hidden behind tall bars in the compounding machine; a scrollbar track under the phone rail; the factory drawing too small to read on a wide screen (it now uses the full window width); drawings no longer shrink below 85%.

### QA after the second round

| Check | Result |
|---|---|
| `tests.html` | PASS — 66 of 66, opened from `file://` |
| Rebuilt instruments driven in headless Edge | PASS — no console errors |
| Reduced motion | PASS — the factory run completes in stepped mode |
| Phone layout, 320 and 375 px, true emulation | PASS — screenshots inspected; no page overflow on any route |
| Corrupt and hostile saved data | PASS — the course renders and every instrument starts |
| Keyboard only | PASS — every gate and instrument completed without a pointer (by the reviewer) |
| No JavaScript | PASS — all parts readable, links scroll, gates show a fallback |
| Print | PASS — light colours; unopened parts start their instruments first; the takeaway prints as one page |
| Screen reader | NOT VERIFIED |
| Firefox and Safari | NOT VERIFIED |

### What the review found that is not fixed

- **The factory is still a replay.** Plans, approval and review are fixed per scenario; the learner does not act as the approval node or edit the plan. The counterfactual switch is the only way to change the outcome.
- **No lesson reaches node 12.** The notes give one lesson (run 57) without saying which request produced it, so the simulation does not claim one, and layer 4 is described rather than shown.
- **No 60-minute mode.** The header of each part gives the notes' minutes for both session plans, but the page does not hide content for the shorter one.
- **The capstone is still label matching**, as the notes specify; the four failure stories beside it test application.
- **Spaced review is light.** Failed gates are listed for another try, but individual failed questions do not come back later.
- **The execution lens** in part 3 still draws one pass rather than the branches.
- **Diagram text on phones** is about 11 px at the 85% floor, and wide drawings scroll sideways.
- **Back and Forward** return to the top of a part, not the previous scroll position.
- **Remaining engineering notes** from round one: first bench title is an `h3` before any `h2` in four parts; some duplicated patterns.

---

## Part L: the practical laboratory (added 2026-11-12)

A new part, "Operate it from your phone", between part 8 and the reference shelf. It is not from the notes: it was researched from official documents on 2026-11-12, and it says so in its head.

### What was added

| File | Content |
|---|---|
| `index.html`, section `data-chapter="lab"` | 14 sections of prose and tables, 5 instruments, 8 code blocks with a Copy button, a gate of 6 questions |
| `css/phone-lab.css` | Styles of the part. Tokens only; no new colour. |
| `js/data/phone-lab.js` | 28 components, 35 connections, 3 architectures, 2 lifecycles (11 and 5 stages), 3 cost scenarios, 6 milestones, the gate |
| `js/labs/phone-lab.js` | `phoneArch`, `phoneLife`, `phoneIntake`, `phoneCost`, `phoneRoad`, `copy` |
| `lab/bridge/` | `server.mjs` (the bridge between n8n and Claude Code), `config.example.json`, `test/run.mjs` |
| `lab/n8n/` | `phone-to-claude.workflow.json`: 28 standard nodes of n8n 2.47.5 |
| `lab/claude/` | Example `settings.json` (permission rules) and a `PreToolUse` hook |
| `lab/tools/sync-page.py` | Copies the files of `lab/` into their blocks on the page |

The five instruments: the stack in eight layers for three architectures (select a component; four views; switch a component off); the lifecycle of one task with a phone screen (approve or reject on the phone); the five checks of the bridge with a prediction; three cost scenarios in rand; six milestones with a stored mark.

### How the existing parts were preserved

- No engine, stylesheet, data file or instrument of parts 0 to 8 was changed. The new part uses `GE.graphView`, `GE.segmented`, `GE.gate`, `GE.store`, `GE.trace` and `GE.legend` as they are.
- `index.html` outside the new section: 8 lines. One stylesheet link, one rail item, two script tags, and two "previous / next" links so that the path is 8, L, reference.
- `js/data/sources.js`: one entry in the chapter list. `tests.html`: two script tags and 22 new assertions. `css/layout.css`: only the rail width change that was made earlier on the same day.
- The conventions of the course hold in the new part: a dashed line is something a model selects; role colours carry meaning only; PASS and FAIL stamps; each simulation is labelled; the gate has a hint and a heading to read again for each question.

### What was tested

| Check | Result |
|---|---|
| `tests.html` | PASS — 88 of 88 (66 existing, 22 new), opened from `file://` in headless Chrome |
| Each instrument of part L driven by script | PASS — each node of each architecture, each view, switch-off, both lifecycles to the end, Reject, the six results of the checks, the cost controls, the milestones. No console error. |
| Two defects found by that run and corrected | Reject went to the next stage; a view did not clear a selected component |
| Parts 0 to 8 and the reference shelf | Each instrument starts; no page overflow |
| Phone layout, 390 and 320 px, device emulation | PASS — no page overflow; screenshots of 390 px inspected |
| Light and dark theme, 1500 px | Screenshots inspected |
| The rail with 11 items | Fits at a window height of 620 px |
| `lab/bridge/test/run.mjs` | PASS — 28 of 28, with a stand-in for Claude Code |
| The workflow against the node definitions of n8n 2.47.5 | PASS — 28 of 28 nodes: type, version, parameter names, option values |
| `n8n import:workflow`, n8n 2.47.5 | PASS |
| The hook `guard.mjs` | PASS — blocks push, recursive delete and `.env`; permits `npm test` and `git status` |

### Not tested, and other limits

- **No real agent run.** The bridge was not run with the real `claude -p`, and the workflow was not run from a Telegram message. Both use an account, a bot token or the limits of a plan. The flags come from the documents and from `claude --help` of 2.1.211; `--max-turns` is in the CLI reference but not in that help text.
- **The expressions between the n8n nodes were read, not executed.** Only the Code node was run.
- **`tailscale funnel --set-path`** was not run on Windows.
- **Prices and limits are of one day.** Several are in a research preview (channels, cloud scheduled tasks, Funnel). The page lists what the research could not confirm.
- **20 W for a laptop** is an assumption, and the dollar-to-rand rate is a cross rate from two ECB rates.
- **Architecture drawings on a phone** scroll sideways, as the other drawings do; the list of components below each drawing gives the same content.
- **The gate of part L** was driven by script for its first question only.
- **Part 8 does not list the gate or the instruments of part L** in "Your run": its lists are fixed to parts 1 to 8, and they were not changed.
- **Screen reader, Firefox, Safari, print, no JavaScript:** not verified for part L. The prose and the tables are static HTML.
- Nothing is committed to git; the folder is not a repository.

## 2026-11-13: progression and evidence pass

**Progression**

The plane sort (part 5), the node-type task (part 2) and the capstone (part 8) were reworked.

- **Plane sort**
  - The three planes are now defined before the sort. Each has one example and one question to ask ("what does this item do?").
  - The confusing pair is called out.
- **Worked examples**
  - The plane sort starts with 3 worked examples.
  - The node-type task starts with 2 worked examples and was renamed from "Give a color".
- **Hints**
  - Hints are optional, with 3 per instrument. Each hint names the question to ask, not the answer.
- **"Can you say why?"**
  - After a PASS, the reader selects a reason (`GE.whyCheck` in `dom.js`).
- **Capstone**
  - It now states the method before the reader starts.
  - Wrong selects get a "(not correct)" text mark.
- **Colour no longer the only signal**
  - The node-type answer reveal names line shapes, not only colours.
  - Wrong nodes get a thicker outline. On the second attempt they are also named in text.
- **Estimates**
  - The estimate prompts in parts 1 and 4 now say that a wrong estimate is expected.

**Evidence**

- Part 0 has a "How sure are we?" key and a design drawer that cites the learning science. The certainty marks are words, not colours.
- 16 primary sources were added to `R.sources`, now 25. Inline `a.cite[data-ref]` links are numbered by `linkCitations` in `app.js`; a click opens the reference shelf at that row.
- One claim was corrected: GE 1968.
- One claim is flagged as not confirmed: the Feng formula.
- The p^n table is labelled as a teaching model.
- Full table: `EVIDENCE.md` (in this folder).

**Tests**

- 92 of 92 pass.
- The new tests cover source ids and links, the worked examples in the colour task and the plane sort, and `whyCheck`.
- A headless walk-through passed at 1280 and 375 px:
  - The colour task and the plane sort were solved through key and click events.
  - The citation link was followed to its row.
  - There was no horizontal scroll and no console errors.

**Not checked**

- Screen readers, Firefox and Safari.
- Part L prices.
- The full text of the Feng paper.

**Backups**

Backups are the `*.bak-20261113` files in `backups/`.

## 2026-11-13: "Watch one run" (part 2)

**What it is.** A new instrument in part 2, "Watch one run", placed after "Control" and before "The same task as one loop and as a graph". It plays an invented agent run as a graph that grows step by step. The run is a defect fix in an employee application:
- the request, interpreting the task, and retrieval from the notes and the knowledge graph
- the plan, then a repository tool called twice
- a first patch that fails the tests, a diagnosis, a retry, and a second patch that passes
- human approval, then the final response

**Files**
- `js/data/agent-run.js`: the graph, the 18 steps, and the inspector texts.
- `js/labs/agent-run.js`: the instrument (`GE.labs.agentRun`).
- `css/agent-run.css`: the styles.

**How it is built.** It reuses `GE.graphView` (hand-placed SVG, arrow markers, the token travel), the four role styles, and the course rule that a dashed arrow is a choice made by the model.

**Behaviour**
- **Steps:** nodes appear when the run reaches them. Each edge draws in the direction of the run, the token travels along it, and then its label appears. The current node has a thick outline that slowly pulses.
- **Ideas:** a short "New idea" note appears at six steps: trace, retrieval, tool call, model choice, branch, retry and approval.
- **Controls:** Play/Pause, Back, Next, Replay, a speed setting (0.5×, 1×, 2×), a scrubber, and "Show the full map".
- **Inspector:** you can select a node or an arrow, with the mouse or the keyboard. A node shows its purpose, what it receives and produces, who does it, the next possible actions, and why it matters. An arrow shows what travels on it.
- **Log:** "The trace as a log" is the same run as a list, with no animation.
- **Reduced motion:** no drawing and no token, and the full map is on by default.
- **Honesty:** the text says it shows only observable events, not the model's private reasoning, and that the run is invented.

**Checks (headless Chrome)**
- `tests.html`: 92 of 92 pass.
- No instrument failed to start in any chapter.
- Every arrow ends at its target node and has an arrowhead.
- No edge label overlaps a node or another label.
- A full run at 2× took about 26 seconds:
  - The FAIL branch at step 12 marks the gate.
  - The retry goes back to "Propose a change".
  - The unused edge "changes requested" stays hidden.
- These all worked: pause holds the state, and the scrubber, the log rows, Replay, Back and Next all move to the right step.
- Node and arrow inspection works with click and with Enter.
- Steps not reached yet cannot be focused.
- At 375 px there is no page-level horizontal scroll. The drawing scrolls sideways inside its frame, as the other drawings do.
- Reduced motion works: the map is on and steps change at once.
- No console errors.

**Not checked:** screen readers, Firefox, Safari, and light theme screenshots.
