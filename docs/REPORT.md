# Implementation report — Permitted Paths

Built 2026-11-12 from the nine `GE 00–08` notes. The notes were not changed.

## What was built

A no-build, no-network interactive course: `index.html` plus seven stylesheets, 29 scripts and eight font files. Nine parts and a reference shelf, 19 instruments with a result the page can examine, 7 further drawings that are read in steps or by lens, 7 part gates, a capstone gate and a four-story failure gate, a browser test page with 66 assertions, `README.md` and `SOURCES.md`. (The first version of this report counted 25 "instruments"; an adversarial review rightly objected that several were figures.)

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

## Redesign: "the journal and the bench" (2026-11-12)

A full visual pass on the branch `redesign/journal-and-bench`. The content, the ids, the mounts, the engines and the stored data did not change.

**Direction.** A technical journal that contains a laboratory. Two voices:

| Voice | Where | Type |
|---|---|---|
| Journal | titles of parts, questions, ledes, section headings, large numerals, key ideas | Instrument Serif (new, SIL OFL, in `assets/fonts/`) |
| Bench | titles of instruments, controls, read-outs, the wordmark | Nohemi |
| Body | prose, tables, feedback | Atkinson Hyperlegible |
| Data | figure numbers, labels of arrows, state, code, source chips | JetBrains Mono |

- **Colour.** No new colour. Ink, the four role colours and the FAIL colour, each with one meaning. Paper is now a warm ivory sheet; Blueprint is a navy drafting sheet. Each theme has its own values in `tokens.css`.
- **Marks.** The gate hexagon (wordmark, rail, gate head) and the path line of the rail. The ink part of the line grows to the last part that the learner opened.
- **Depth.** Shadows only on layers that float: the search dialog, the open rail, the transport bar of the run, the phone.

**What changed.**

- `css/tokens.css`: the serif face, a larger display scale, new neutrals for each theme, `--grid-dot`, `--shadow-float`, `--hex`, `--caps`. From 90rem the rail is wide (`--rail: 15.5rem`).
- `css/layout.css`: top bar (mark, locator "02 / 08", a quiet search field, three text tools); rail under the top bar with titles on a wide window, a narrow rail that opens between 56rem and 90rem, one row on a phone; openers of the parts (part 0 is a cover); numbered sections; the bench as a plate with a figure number ("Fig. 2.3"); the end-of-part links; notes in the margin from 82rem.
- `css/base.css`, `css/components.css`: tables, code, buttons, segmented groups, chips and their states, stamps, callouts, drawers, the gate (letters on the options), search, and one drawing language (stage with a dot grid and four registration marks, mono labels on arrows, thinner arrowheads, a softer wavering line).
- `css/agent-run.css`, `js/labs/agent-run.js`: "Watch one run" is one instrument. The stage, a transport bar that stays at the bottom of the window while the stage is in view, a scrubber with one mark for each step (a check has a taller mark), and the recorder (event, state, inspector) beside the stage. A node that the run did not reach is a ghost: an outline with no words. Only the assembly of the DOM changed; the steps, the timing, the keys and the prediction are the same.
- `js/core/app.js`: the locator in the top bar, the kicker with the nine path marks in each opener, `--ch-dot` for the figure numbers, `--progress` for the rail.
- `js/core/graph-view.js`: the shape of the two arrowheads. `index.html`: the scale of the `ge-wobble` filter (3.4 to 2.4).
- `css/labs.css`, `css/phone-lab.css`: the instruments and part L use the new surfaces and voices.

**Checked.** `tests.html`: 92 PASS, 0 FAIL. No console errors. Chromium at 1440 px and 375 px, both themes: parts 0, 2, 4, 6, L and the shelf. No page-level horizontal scroll at 375 px on any part. Navigation by rail and by address, a deep link to a gate, a citation, search, the theme toggle, and the run (play, pause, scrubber, back, inspector).

**Not done, or not checked.**

- A small role mark in the corner of each node (planned) was not added. The shape and the line already carry the role without colour.
- The gate did not get progress marks; it keeps the text "Question 1 of 4".
- 768 px, 1024 px and 320 px were not looked at as pictures. Print, `file://`, reduced motion, Firefox, Safari and screen readers were not checked after the redesign. Contrast of the new neutrals was set by lightness, not measured pair by pair.

## Presentation deck (2026-11-12)

`presentation/` holds the source of a slide deck that teaches the course in 33 slides: `deck.json` (the index) and one HTML fragment for each slide. The site does not load these files. The prose comes from `index.html`. The code on the slides is an example for teaching; no test runs it. `presentation/README.md` gives the format.

Appearance pass (2026-11-12): a new cover and a new last slide (the same graph, first with three nodes lit, then fully lit), larger type, code in panels with syntax colour, a faint grid on the dark slides, and a nine-mark part indicator at the bottom right of each slide.

Checked: each of the 33 slides was examined in a local render (headless Chrome, with a small page that loads `deck.json` and the slide files). That render is an approximation of the deck page. Not checked: the slides in the deck page itself, and the export to PDF or PowerPoint.

## 2026-11-14: upgrade sweep of `index.html`

A structural audit of the page, then the corrections that do not change the content or the appearance. Branch `chore/html-upgrade-sweep`.

**Audit result.** No unclosed tag, no duplicate id, no broken internal link, no `h2` without an id, no button without a type, no input without a label. Each `data-lab` mount has a registered instrument (38 of 38) and each of the 29 scripts exists. Each of the 68 external addresses answers with HTTP 200.

**Changed**

- **Moved addresses.** 11 external addresses answered through a redirect (n8n, Tailscale, Cloudflare, Docker, Make and Claude support moved their pages). They now point to the new address. Two of them are also in `js/data/phone-lab.js` (three places), and were changed there.
- **Table headers.** Each of the 199 column headers in the 64 tables has `scope="col"`.
- **Head.** A tab icon (the gate hexagon, an inline SVG, so that no file is necessary and the request for `favicon.ico` stops), and four Open Graph tags for a link preview.
- **Vocabulary.** "route requests" is now "send requests" (part L). "Exercise 1: give a color to each node" is now "give a type to each node", the name that the instrument got on 2026-11-13.

**Checked.** `tests.html`: 92 of 92, from `file://` in headless Edge. Parts 0, 4 and L load with no console error. `python lab/tools/sync-page.py`: 5 blocks, 0 changed.

**Second pass, the same day**

- **Heading levels.** No part skips a level now. In parts 1, 2, 3, 4, 6 and 8 the first bench title was an `h3` before any `h2`; it is an `h2` with the same class. The four `h4` in the drawer of part 0 are `h3 class="h4"`, and `base.css` gives `.h4` the look of an `h4`. Screenshots of parts 1 and 6 before and after show no difference. This closes the heading item of the first engineering review.
- **Table names.** 22 tables have `aria-labelledby` with the id of their section heading. A table has a name only if its nearest heading has an id and no other table uses it.
- **Part L, limits of the Ultra plan.** The Claude support page was read on 2026-11-14. Pro and Max have a five-hour limit and a weekly limit; Ultra has a weekly limit, and a verified Ultra account has no five-hour limit. The two rows that gave both limits for each plan now say this. The other prices and limits keep the research date 2026-11-12.

**Checked after the second pass.** `tests.html`: 92 of 92. Parts 0, 1, 6 and L: no console error. `sync-page.py`: 0 blocks changed.

**Found and not changed**

- **Tables with no name.** 42 of the 64 tables: those in drawers, those below a heading with no id, and two that share one heading. A name for each is new text.
- **Not checked:** screen readers, Firefox, Safari, print, phone widths, and the link preview on a real service.

## 2026-11-14: the source notes are in the repository; private details removed

**The notes.** The folder `notes/` has a copy of each of the nine notes, `ge-00-…md` to `ge-08-…md`, and a `README.md`. In each copy the links between the notes are usual markdown links, the ten images are replaced by one line each (the line that gives the source stays), and the frontmatter gives the date with no time. The originals were read and not changed.

**The source chips.** A source chip opened an `obsidian://` address in the vault of the author, thus it operated on one computer only. It now opens the copy of the note in `notes/` on GitHub, in a new tab. `js/data/sources.js` has `noteBase` and a `page` for each note in place of `vault` and `noteFolder`; `js/core/app.js` makes the link. Two sentences in `index.html` that said "in Obsidian" were changed.

**Private details.** The name of the vault, the folder path in the vault and a path on the computer of the author were removed from `js/data/sources.js`, `docs/SOURCES.md` and `CLAUDE.md`. `CLAUDE.md` has a rule that prevents such details.

**Checked.** `tests.html`: 93 of 93 (one new test for the note pages). Part 4: each of the nine chips has its address in `notes/`; no `obsidian://` address stays; no console error. A search of all files for a user name, a local path, the vault name and an email address finds nothing.

**Limits.** The addresses of the chips operate after this branch is on `main` on GitHub. The older commits keep the removed details.

## 2026-11-14: part S, the practical architecture studio

**What was asked.** A practical part that shows how the ideas of the course become an application: which files, which functions, which tests. With one rule: no agent architecture first. An ordinary application first, then the graph ideas, then a model, then orchestration, each on the same code.

**What was added.**

- **A reference application**, `examples/personal-finance/`: TypeScript, React, Node, SQLite. One vertical slice: record an expense and update the budget of the month. Fictional data. It was built in four levels, one commit and one tag for each (`studio-l1` to `studio-l4`), and the tests of a level passed before the subsequent level started.
  - Level 1, ordinary software: shared contracts, a pure domain, repository ports with two implementations, a service, an HTTP server on `node:http`, a web application. 60 tests.
  - Level 2, graph structure: the service became an execution graph with a typed state and owners, two named gates, an independent verifier, a trace with checkpoints. The service is now a facade; the tests of level 1 pass with no change. 102 tests.
  - Level 3, intelligence layer: an optional category suggestion. Memory first, then a cost control, then a model behind a port, then a deterministic gate. The suggest graph gets no store that can write. 139 tests.
  - Level 4, orchestration: the import of a statement. An orchestrator graph, a bounded pool, one model budget, a wait for the person with a stored checkpoint, a reconciler. 155 tests.
- **Part S in the page**, between part L and the reference shelf: 19 sections, a strip that shows the level of the section on the screen, eight drawings where each box and each arrow can be selected, three replays of recorded runs, a source explorer by level, nine questions, a gate of six questions.
- **A sync tool**, `examples/tools/sync-studio.py`, that copies the source files and the recordings into two generated data files and into eight code blocks of the page.

**Decisions that differ from the first plan.**

- *Level 4 is an import, not a "month review" with agents.* A design review judged the month review a contrivance: its queries take milliseconds, thus parallel workers gain nothing, and its evaluator is a deterministic gate that level 3 already has. The import of a statement has six limits of level 3 that can be named, and each mechanism of level 4 answers one of them. The month review is in the part as the example of a requirement that does not need orchestration.
- *The spent amount of a budget is calculated, not stored.* Then one expense is one write, and the slice needs no transaction across two tables.
- *No service worker.* The Home Screen installation does not need one, and it would show old builds during learning. The part teaches it as a postponed decision.
- *The replays are recordings, not simulations.* The tests of the application write what the real code did in 19 scenarios. The page plays that file. A test in `tests.html` compares each drawing with the recorded graph, thus the page cannot show a node or an edge that the code does not have.
- *The text of each component is in HTML tables, and the instrument reads them.* Thus the page with no JavaScript shows the same content, and the text exists one time.

**How the existing parts were preserved.** No text, example or exercise of parts 0 to 8, part L or the shelf changed. The edits to existing files are: one stylesheet link, one rail item, four script tags, the "Next" link of part L, the "Previous" link of the shelf (all in `index.html`); two cases for the key `studio` in `js/core/app.js` (the locator and the figure prefix); one entry in `js/data/sources.js`; new tests at the end of `tests.html`. `lab/tools/sync-page.py` reports 5 blocks, 0 changed.

**Found during the work.**

- A test of level 4 failed on a line of the fixture with a date after the fixed clock. The import had no rule for it. The line went to the record graph as a worker and Gate 2 refused it (R5). The part uses this as its example of why the worker is the existing graph.
- The first drawing of the record graph failed its test: it showed an edge that is only in the level 2 version of the graph. The drawing now names the two versions.
- `README.md` named a list `LAB_NAMES` that does not exist; the list is `INSTRUMENTS`. Corrected.

**Checked.**

- The application: `npm run check` (type check, 155 tests, recordings current) and `npm run build`. Started with the real SQLite file, AI off: an expense recorded in the browser, the budget changed, the data stayed after a reload; a suggestion came from the memory; an import in two steps gave 2 recorded and 2 rejected with reconciliation PASS, and the second decision gave DUPLICATE. The database of the level 1 run was opened by the level 4 code, thus the three later schema files were applied to a database with data.
- `tests.html`: 116 of 116 (93 before, 23 new).
- Each part opened (`#/0` to `#/8`, `#/lab`, `#/studio`, `#/ref`): each instrument started, the locator and the rail are correct, the previous and next links are correct.
- Part S: each of the 19 recordings played to its end; a box and an arrow selected in a drawing; the explorer at each level; a file link from a table opens the file; a question; the gate starts.
- 375 px width: no sideways scroll of the page. Dark theme: checked on one drawing.
- `python examples/tools/sync-studio.py --check`: PASS. `node lab/bridge/test/run.mjs`: PASS.

**Not run, and other limits.**

- **No call to the real Claude API.** The project has no key. The adapter is tested with a stand-in for the SDK client.
- **No real iPhone.** The steps of Add to Home Screen come from documents. The layout was checked in a browser at the width of a phone.
- Stages 2 and 3 of the deployment (a private path, a host, a sign-in) are a design. Nothing was deployed.
- Three statements about Apple platforms are not confirmed by a current official page; the part lists them under "What this edition did not confirm".
- The cost of one suggestion is an estimate.
- The git tags `studio-l1` to `studio-l4` are local until they are pushed. The file links of the part go to the repository on GitHub, and work there after a push.
- The page is now about 430 kB, and the two generated data files are about 320 kB more.
- Some files of the application are longer than the target of 150 lines: the three graph files and the scenarios.

## 2026-11-14: adversarial review of part S, and the repairs

**How.** Three reviews after the part was finished: the author's own checks, and two independent sessions with no knowledge of the author's reasoning. One attacked the application code and ran its attacks. One checked each statement of the chapter against the code.

**Defects of the application, repaired.** Each has a test in `examples/personal-finance/tests/review-fixes.test.ts`.

- *One request stopped the server.* `GET /%` (and `//`) threw outside the error handler of `server/http/server.ts`, and an error that nobody handles ends a Node process. This ran before the Host and Origin checks. Now all the work of a request is inside one function with one `catch`. Reproduced on the real server before the repair; after it the same requests give 404 and 400 and the server answers the next request.
- *The daily limit of model calls did not hold.* The limit was a count of saved traces, and a run saves its trace after the model answers: ten requests together made ten calls with a limit of two, and a trace that failed to save was a free call. Now `server/intelligence/model-budget.ts` reserves a call in one step before it is made. The import reserves from the same budget.
- *A merchant name that is not in Latin letters had an empty key*, thus the memory of one merchant was suggested for a different one. The key now keeps the letters and digits of each script.
- *The limits of an import did not agree*: a statement could be read and then not decided. One import now has 100 lines at most, the first step refuses a longer one with a clear message, and the body limit is in bytes (40 000).
- *A second decide request on a finished import reported a false reconciliation failure.* It now gets the stored result.
- *Each SQLite error was "try again later"*, also a constraint that a second attempt cannot pass. Such an error is now `StoreRejected`, a defect, and the graph does not try again.
- *The web form kept its request key after the form changed*, thus each try after a lost answer gave a conflict. A changed form now gets a new key.
- Smaller: `Origin: null` gives 403, not 500; text with a control character is refused; the test of the body limit tested the limit of the note; the architecture test now sees double quotes, dynamic imports and `require`.

**Statements of the chapter that were false or too strong, corrected.**

- "The suggest graph gets no store that can write." It got the full merchant memory, which can write. The code changed to make the statement true: the graph now gets a memory with only the method that reads. The text also says that the graph writes its own trace.
- "Level 1 cannot depend on the graph." The architecture test permits a file that a later level changed. The text now says what the test does check.
- "`ai-off.test.ts` is the proof." Its first test never enters the suggest graph. The text now says what each of its two tests shows.
- "SQLite is behind the port, thus a change is one file." SQL is in six files. Corrected.
- "A test that is not written yet" for an edge that two tests cover. Corrected.
- The verifier is independent only with the SQLite reader; "each path test fails" was four of nine; the cost estimate was below what the code permits (1,024 output tokens); the trace is written by the services, not by the engine; counts of the parts; two exercises that could not be finished as written.

**Defects of the page, repaired.** On a wide screen the level strip, which stays at the top, covered the heading of each link target inside the part. The eight drawings added about 180 stops for the Tab key; an arrow with no description is now not a stop, and a selected box or arrow says so to a screen reader.

**Not repaired, on purpose.** The parser of a statement refuses some real formats (a header in quotes, a Unicode minus, a comma for thousands); it fails safe. Budgets exist only for the month in which the server starts; the README says so. The architecture test checks imports, not purity: `Date.now()` in the domain passes. The git tags `studio-l1` to `studio-l4` are the code before these repairs.

**Checked.** The application: `npm run check`, 169 tests in 20 files, recordings current; the build; the requests that stopped the server, on the real server. `tests.html`: 116 of 116. The page: a link to a section now stops below the strip; the count of Tab stops in the part.

**What this means for the earlier "Checked" list.** That list was true and it was the author's list. It did not include one attack. The review found 13 defects of the code and about 20 statements of the text to correct, with all tests green.
