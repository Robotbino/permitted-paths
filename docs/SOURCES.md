# Source mapping

Every part of the course comes from one of the author's notes. The folder [`notes/`](../notes/) has a copy of each note.
"Added" means the item is not in the notes; the page labels each one.

**Part L, "Operate it from your phone", does not come from a note.** It was added by this edition and researched on 2026-11-12 from official documents: Claude Code and Claude plan documents of Anthropic, the source and the documents of n8n 2.47.5, and the price pages of the other services. Its sources are listed on the page (part L, "Sources"), with a list of what the research could not confirm. Its ideas are mapped back to parts 2 to 7 in the section "The ideas of the course in this system". The defect, the code and the note names in its two example lifecycles are examples by this edition.

## Parts

| Part | Note | Sections used in the main text | Sections in reference drawers |
|---|---|---|---|
| 0 The claim | GE 00 — Session Guide | The main idea; The three controls; The full system; One experiment; Five claims | — |
| 1 The same question, five answers | GE 01 — Why Agent Output Changes | §1–5, Try it | §6 (ladder; the interactive ladder is on the reference shelf) |
| 2 Take decisions away from the model | GE 02 — Graph Engineering | §1, 2, 3, 7, 8, Try it | §4, 5, 6, 9, 10 |
| 3 Four things with the name "graph" | GE 03 — Four Types of Graph | §1, 2, 5, Try it | §3, 4, 6 |
| 4 Say what is permitted | GE 04 — Ontologies | §1, 4 (summary), 5, 7, 10, Try it | §2, 3, 4 (code), 5 (code), 6, 8, 9 |
| 5 What the system knows | GE 05 — The Intelligence Plane | §1, 2, 3, 6, 8, 10, Try it | §4, 5, 7, 9, 11 |
| 6 The factory | GE 06 — Worked Example — Game Store Software Factory | §1–9, Try it | — |
| 7 A small real one | GE 07 — Case Study — Knowledge Graph for a Legacy Application | §1–9, Try it | — |
| 8 Give it back | GE 08 — Glossary, Checklist and Exercises | §7, 9 | — |
| Reference shelf | GE 08 §1–6, 8; GE 01 §6; GE 00 Sources | — | — |

## Instruments

| Instrument | Part | Teaches | Source | Added by this edition |
|---|---|---|---|---|
| The full system (stepper) | 0 | The five reading steps | GE 00, "The full system" | — |
| Ask five times | 1 | The same input gives different output | GE 01, Try it | The answer list and its probabilities (the notes give five example results) |
| The compounding machine | 1 | `p^n`; fewer model decisions, more reliable task | GE 01 §3 | The simulation of 100 runs |
| The decision ledger | 2 | Which decisions move from the model to the structure | GE 02 §3; GE 01 §5 (how to measure) | The probabilities that the model ignores a prompt sentence |
| Give a color to each node | 2 | Node types | GE 02 §3, Try it; GE 08 exercise 1 | — |
| Script, loop, harness or graph? | 2 | When to use a graph | GE 08 §4; GE 02 §8 | The five cases |
| Your own prompt | 2 | Which rule in your prompt is a suggestion; the transfer to your own work | GE 08 exercise 2; GE 02 §2, §7 | The sentence splitter, the five locations as buttons, the example prompt |
| Four lenses | 3 | The four types of graph | GE 03 §1 | The entities of the knowledge lens and the run of the context lens |
| The cycle (stepper) | 3 | How the four types connect | GE 03 §2 | — |
| The loan procedure | 3 | Rules before the model; permitted and actual paths | GE 03 §5 | The five cases |
| Your five results and the validator | 4 | A closed vocabulary rejects values | GE 04 §10 | — (JavaScript version of the notes' Python) |
| Types above, facts below | 4 | Ontology and knowledge graph | GE 04 §1 | — |
| The fact workbench | 4 | Rules R1–R4, R7, R8 reject facts | GE 06 §3; GE 04 §7 | The people, orders and facts |
| The two-gate bench | 4 | Gate 1 reads the call; Gate 2 needs the current facts | GE 04 §5; GE 08 exercise 4 | Four of the seven proposals; the database rows |
| Infer, or reject? | 4 | RDFS infers; OWL does not reject; SHACL validates | GE 04 §4 | — |
| Put each part in its plane | 5 | The three planes | GE 05 §2 | — |
| Token bars | 5 | The demonstration numbers | GE 05 §6 | — |
| Three paths from a trace (stepper) | 5 | Token space, weight space, harness | GE 05 §8 | — |
| The permitted transitions | 6 | Rules R1 and R7 | GE 06 §3 | — |
| The factory floor | 6 | The 12-node graph, the state contract, scenarios A, B, C, ON_HOLD | GE 06 §5–7, Try it | Maximum of 2 attempts; the question scenario; the file names in the plans; the loop result for ON_HOLD is stated as not given; the switch that removes the plan gate and its result |
| How the rule gate finds the tests (stepper) | 6 | Changed file → rule → test | GE 06 §5 | — |
| Go from the rule to its test | 7 | Typed notes and relations | GE 07 §4 | — |
| The graph validator | 7 | A script validates types, relations, targets | GE 07 §3, 4 | The validator itself (the notes describe it, they do not give its code) |
| The agent session loop (stepper) | 7 | Five steps and the cause of each | GE 07 §5 | The node colours |
| The baseline of known findings | 7 | KNOWN and NEW | GE 07 §6 | The six example findings |
| The capstone | 8 | Label every arrow of the full system | GE 08 §7; GE 00 | — |
| Four questions | 8 | Free recall, self-marked | GE 08 §7 | — |
| Four failures | 8 | Which control was absent in a failure | GE 02 §7; GE 04 §5, §7; GE 07 §1, §8 | The four stories |
| Your one page | 8 | The six sentences, your own rules, the first hour | GE 08 §9, §5; GE 01 §5 | The printable page |
| Your run, as a context graph | 8 | Permitted paths and the actual path | GE 03 §5; GE 06 §7 | The learner's own trace |
| Glossary, incorrect ideas, checklist, ladder, sources | Reference | — | GE 08 §1–3; GE 01 §6; GE 00 | The "correct or incorrect" card game around the ten idea pairs |

Five more drawings are read in steps and have no result to examine: the full system, the cycle, three paths from a trace, how the rule gate finds the tests, and the agent session loop. The four lenses and the ontology-and-facts drawing are figures of the same kind.

## Gates

Each gate question names its source section in `js/data/gates.js` and on the page, and links back to the heading where the course gives the answer. Most questions put the idea into a new case (a code review divided between four agents, a salary table, a reviewer who asks about last Tuesday). Those cases are examples written for this edition; each correct answer and each cause is from the note and section named beside it.

## Figures of the notes

The ten images in `11 - Attachments/Graph Engineering/` are not copied into this project. Where the course needs the same content, it uses a new drawing or a table:

| Image in the notes | In the course |
|---|---|
| `ge-ladder-exam-analogy.png` (Feng et al., fig. 4, CC BY 4.0) | Interactive ladder, reference shelf |
| `ge-fixed-model-agent-steps.svg` (LangChain) | Node-type table and the example graph, part 2 |
| `ge-loop-is-one-node.webp`, `ge-four-loops.png` | Drawer "A loop is a graph, and the four loops", part 2 |
| `ge-four-topologies.webp` (PuppyGraph) | Drawer "Usual shapes", part 2 |
| `ge-overview-three-views.png` (Feng et al., fig. 5, CC BY 4.0) | Drawer "The three views of a system", part 2 |
| `ge-talk-build-an-ontology.webp`, `ge-talk-rdfs-owl.webp`, `ge-talk-two-gates-rule.webp` (Coyle) | Tables, the reasoner instrument and the two-gate bench, part 4 |
| `ge-enforced-ontology.webp` (PuppyGraph) | Drawer "One ontology below all the nodes", part 4 |
