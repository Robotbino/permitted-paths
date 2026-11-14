/* sources.js: where the content comes from. The notes are the source of truth.
   The folder notes/ of the repository has a copy of each note. A source chip opens that copy.
   `noteBase` is the address of the folder. To read the copies with no network, set it to 'notes/'. */
(function (GE) {
  'use strict';
  GE.data.noteBase = 'https://github.com/Robotbino/permitted-paths/blob/main/notes/';
  GE.data.notes = {
    '00': { file: 'GE 00 — Session Guide', page: 'ge-00-session-guide.md' },
    '01': { file: 'GE 01 — Why Agent Output Changes', page: 'ge-01-why-agent-output-changes.md' },
    '02': { file: 'GE 02 — Graph Engineering', page: 'ge-02-graph-engineering.md' },
    '03': { file: 'GE 03 — Four Types of Graph', page: 'ge-03-four-types-of-graph.md' },
    '04': { file: 'GE 04 — Ontologies', page: 'ge-04-ontologies.md' },
    '05': { file: 'GE 05 — The Intelligence Plane', page: 'ge-05-the-intelligence-plane.md' },
    '06': { file: 'GE 06 — Worked Example — Game Store Software Factory', page: 'ge-06-worked-example-game-store-software-factory.md' },
    '07': { file: 'GE 07 — Case Study — Knowledge Graph for a Legacy Application', page: 'ge-07-case-study-knowledge-graph-for-a-legacy-application.md' },
    '08': { file: 'GE 08 — Glossary, Checklist and Exercises', page: 'ge-08-glossary-checklist-and-exercises.md' }
  };
  GE.data.chapters = [
    { key: '0', title: 'The claim', note: '00' },
    { key: '1', title: 'The same question, five answers', note: '01' },
    { key: '2', title: 'Take decisions away from the model', note: '02' },
    { key: '3', title: 'Four things with the name “graph”', note: '03' },
    { key: '4', title: 'Say what is permitted', note: '04' },
    { key: '5', title: 'What the system knows', note: '05' },
    { key: '6', title: 'The factory', note: '06' },
    { key: '7', title: 'A small real one', note: '07' },
    { key: '8', title: 'Give it back', note: '08' },
    { key: 'lab', title: 'Operate it from your phone', note: null }, // the practical laboratory: added by this edition, not from a note
    { key: 'ref', title: 'Reference shelf', note: '08' }
  ];
})(window.GE);
