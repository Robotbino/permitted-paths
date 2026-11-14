// The scenarios of the import graph (level 3). Each has two requests: the first reads the file and
// proposes (or asks for a mapping), the second is what the person answers.
// The files are the synthetic samples of shared/pipeline/samples.ts: two fictional banks, one unknown layout.
import { HARBOUR_ACCOUNT, HARBOUR_SAMPLE, NORTHBANK_ACCOUNT, NORTHBANK_SAMPLE, UNKNOWN_PROFILE, UNKNOWN_SAMPLE } from '../shared/pipeline/samples.ts';
import type { Scenario, Step } from './scenarios.ts';
import { send, type World, type WorldOptions } from './world.ts';

const WORLD: WorldOptions = { memory: true, ai: 'answer', remembered: [['Greenleaf Market', 'groceries']], importBudget: 4 };

const START = ['inspect', 'map', 'stage', 'classify', 'await_person', 'respond'];
const APPLY = ['await_person', 'apply', 'reconcile', 'export', 'respond'];
const TO_MAPPING = ['inspect', 'map', 'await_mapping', 'respond'];

/** The person accepts each suggestion. A line with no suggestion gets no category, thus it waits. */
const acceptAll = (first: any): Step => ({
  path: '/api/imports/' + first.batch_id + '/decide',
  body: { decisions: first.lines.map((l: any) => ({ line_no: l.line_no, category_id: l.suggestion?.category_id ?? null })) },
});

/**
 * Makes the world ready: the Northbank sample is imported and decided. `byHand` is the category that the
 * person selects for a line that has no suggestion (the key is a word of the description).
 */
const northbankDone = (text: string, byHand: Record<string, string> = {}) => ({
  text,
  async run(world: World): Promise<void> {
    const first = await send(world, '/api/imports', { csv: NORTHBANK_SAMPLE, account: NORTHBANK_ACCOUNT });
    const step = acceptAll(first.body);
    const hand = (line: any): string | null => Object.entries(byHand).find(([word]) => String(line.description_clean).toLowerCase().includes(word))?.[1] ?? null;
    const decisions = first.body.lines.map((line: any) => ({ line_no: line.line_no, category_id: line.suggestion?.category_id ?? hand(line) }));
    await send(world, step.path, { decisions });
  },
});

export const IMPORT_SCENARIOS: Scenario[] = [
  { id: 'import_northbank', level: 3, title: 'Import the Northbank sample of 14 rows; the person accepts each suggestion', world: WORLD,
    endpoint: '/api/imports', before: [], request: { csv: NORTHBANK_SAMPLE, account: NORTHBANK_ACCOUNT }, follow: acceptAll,
    expect: { status: 200, path: APPLY, rows: 4, first: { status: 200, path: START } } },
  // The transfer of R2 500 is already in the ledger as a Northbank row, thus the Harbour row pairs with it and is not income.
  { id: 'import_harbour_after', level: 3, title: 'Import the Harbour Bank sample after the Northbank sample: a transfer pairs, a pending row is held, a purchase and its reversal pair', world: WORLD,
    endpoint: '/api/imports', before: [], prepare: northbankDone('The Northbank sample is already imported. The person accepted each suggestion, and selected "Transfer between own accounts" for the transfer to Harbour Bank.', { harbour: 'own-transfer' }), request: { csv: HARBOUR_SAMPLE, account: HARBOUR_ACCOUNT }, follow: acceptAll,
    expect: { status: 200, path: APPLY, rows: 8, first: { status: 200, path: START } } },
  { id: 'import_same_file_twice', level: 3, title: 'The same Northbank file a second time: a row that is in the ledger is a duplicate, and a line that waited can get a category now', world: WORLD,
    endpoint: '/api/imports', before: [], prepare: northbankDone('The Northbank sample is already imported, and the person accepted each suggestion.'), request: { csv: NORTHBANK_SAMPLE, account: NORTHBANK_ACCOUNT }, follow: acceptAll,
    expect: { status: 200, path: APPLY, rows: 6, first: { status: 200, path: START } } },
  // A layout that no profile knows. The first answer asks for a mapping; the second request gives it, and the run continues to the proposal.
  { id: 'import_unknown_layout', level: 3, title: 'A file in a layout that the application does not know; the person gives the mapping', world: { memory: true, ai: 'off' },
    endpoint: '/api/imports', before: [], request: { csv: UNKNOWN_SAMPLE, account: NORTHBANK_ACCOUNT },
    follow: (first) => ({ path: '/api/imports/' + first.batch_id + '/mapping', body: { mapping: UNKNOWN_PROFILE } }),
    expect: { status: 200, path: ['await_mapping', 'stage', 'classify', 'await_person', 'respond'], rows: 0, first: { status: 200, path: TO_MAPPING } } },
  // The mapping gate: a mapping is tried on the file before a row is read with it.
  { id: 'import_bad_mapping', level: 3, title: 'The person gives a mapping that names a column "Day"; the file has no such column', world: { memory: true, ai: 'off' },
    endpoint: '/api/imports', before: [], request: { csv: UNKNOWN_SAMPLE, account: NORTHBANK_ACCOUNT },
    follow: (first) => ({ path: '/api/imports/' + first.batch_id + '/mapping', body: { mapping: { ...UNKNOWN_PROFILE, columns: { ...UNKNOWN_PROFILE.columns, date: 'Day' } } } }),
    expect: { status: 400, path: ['await_mapping', 'reject'], rows: 0, first: { status: 200, path: TO_MAPPING } } },
];
