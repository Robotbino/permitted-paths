/* sources.js: where the content comes from. The Obsidian notes are the source of truth.
   If the vault or the folder gets a different name, change `vault` and `noteFolder` here. */
(function (GE) {
  'use strict';
  GE.data.vault = 'Obsidian-main';
  GE.data.noteFolder = '2 - Learning/AI Engineering/Graph Engineering';
  GE.data.notes = {
    '00': { file: 'GE 00 — Session Guide' },
    '01': { file: 'GE 01 — Why Agent Output Changes' },
    '02': { file: 'GE 02 — Graph Engineering' },
    '03': { file: 'GE 03 — Four Types of Graph' },
    '04': { file: 'GE 04 — Ontologies' },
    '05': { file: 'GE 05 — The Intelligence Plane' },
    '06': { file: 'GE 06 — Worked Example — Game Store Software Factory' },
    '07': { file: 'GE 07 — Case Study — Knowledge Graph for a Legacy Application' },
    '08': { file: 'GE 08 — Glossary, Checklist and Exercises' }
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
