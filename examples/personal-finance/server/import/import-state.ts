// The typed state of the import graph, its ports and its keys.
// Read the state as a table: the comment after each group names the node that owns the fields.
// The ports are functions, not stores: the orchestrator can do only what these functions do.
import { createHash } from 'node:crypto';
import type { Problem } from '../../shared/contracts.ts';
import type { DecideRequest, ImportProposal, ImportResult, LineOutcome, LineSuggestion, MappingNeeded } from '../../shared/contracts.import.ts';
import type { LedgerEntry } from '../../shared/export/paste-rows.ts';
import type { OtherAccountRow, ReconciledRow, RowStatus } from '../../shared/pipeline/reconcile.ts';
import type { Clock, IdGen } from '../clock.ts';
import type { GraphNode } from '../graph/engine.ts';
import type { TraceStore } from '../graph/trace.ts';
import type { LedgerReader } from '../graph/verifier.ts';
import type { Reconciliation } from './reconciler.ts';

export const POOL_SIZE = 3;
/** The name of the pasted text in a problem of the pipeline. The application gets text, not a file with a name. */
export const SOURCE_NAME = 'statement';

/** `checkpoint`: while the batch waits, the state at the node where it waits. When it is DONE, the final state with the result. */
export type ImportBatch = { id: string; created_at: string; status: 'WAITING_FOR_MAPPING' | 'WAITING_FOR_PERSON' | 'DONE'; run_id: string; checkpoint: unknown };

export interface ImportStore {
  save(batch: ImportBatch): void;
  get(id: string): ImportBatch | null;
}

export type ImportDeps = {
  clock: Clock;
  ids: IdGen;
  trace?: TraceStore;
  batches: ImportStore;
  /** The read-only view of the ledger, for the reconciler. */
  ledger: LedgerReader;
  /** Is a row with this request key in the ledger, as an expense or as income? */
  inLedger(key: string): boolean;
  /** The ledger rows of the other accounts in a range of dates: an expense is 'out', an income row is 'in'. */
  otherAccountRows(account: string, from: string, toInclusive: string): OtherAccountRow[];
  /** Does the memory know this merchant? A cheap, local read. */
  knows(merchant_key: string): boolean;
  suggestLine(merchant_name: string, withModel: boolean, parent_run_id: string): Promise<{ suggestion: LineSuggestion; reason: string }>;
  /** fileConfirms: each earlier copy of this row in the file is in the ledger from this file. See recordWorker. */
  recordLine(row: ReconciledRow, category_id: string, idempotency_key: string, suggest_run_id: string | null, parent_run_id: string, fileConfirms: boolean): Promise<LineOutcome>;
  recordIncome(row: ReconciledRow, idempotency_key: string): LineOutcome;
  /** The ledger row of a request key in the form of the export. null: the ledger has no such row. */
  entryForKey(key: string): LedgerEntry | null;
  /** Asks the budget of the day for n model calls, for this import. Returns how many it gets. 0: the AI is off, or the limit is used. */
  reserveModelCalls(n: number): number;
};

export type ImportState = {
  // input: the engine gets these at the start, or at a resume. No node writes them.
  run_id: string; csv: string; account: string;
  mapping: unknown; // null: no mapping was given
  decisions: DecideRequest['decisions'] | null;
  export_profile: string | null;
  // inspect
  batch_id: string;
  file: { hash: string; header: string[]; row_count: number; preview: string[][]; problems: Problem[]; refusal: Problem[] } | null;
  // map
  map: { source: 'known' | 'given' | 'none'; profile_id: string | null; problems: Problem[] } | null;
  // await_mapping
  mapping_problems: Problem[];
  // stage
  staged: { profile: { id: string; name: string }; rows: ReconciledRow[]; summary: Record<RowStatus, number>; problems: Problem[] } | null;
  // classify (the key is the merchant key)
  suggestions: Record<string, LineSuggestion>; budget: ImportProposal['budget'] | null;
  // await_person
  decision_problems: Problem[];
  // apply
  outcomes: LineOutcome[] | null;
  // reconcile
  reconciliation: Reconciliation | null;
  // export
  export: Pick<ImportResult, 'export_profile' | 'expenses_tsv' | 'income_tsv' | 'notes'> | null;
  // respond, reject
  response: ImportProposal | MappingNeeded | ImportResult | null;
  rejection: { problems: Problem[] } | null;
};

export type ImportNode = GraphNode<ImportState, ImportDeps>;

export const IMPORT_OWNERS: { [K in keyof ImportState]: string } = {
  run_id: 'input', csv: 'input', account: 'input', mapping: 'input', decisions: 'input', export_profile: 'input',
  batch_id: 'inspect', file: 'inspect', map: 'map', mapping_problems: 'await_mapping', staged: 'stage',
  suggestions: 'classify', budget: 'classify', decision_problems: 'await_person', outcomes: 'apply',
  reconciliation: 'reconcile', export: 'export', response: 'respond', rejection: 'reject',
};

export const emptyState = (run_id: string, csv: string, account: string, mapping: unknown): ImportState => ({
  run_id, csv, account, mapping: mapping ?? null, decisions: null, export_profile: null,
  batch_id: '', file: null, map: null, mapping_problems: [], staged: null, suggestions: {}, budget: null,
  decision_problems: [], outcomes: null, reconciliation: null, export: null, response: null, rejection: null,
});

const sha = (text: string) => createHash('sha256').update(text).digest('hex');

/** The id of a batch: from the hash of the file and the account. The same file for the same account gives the same id. */
export const batchIdOf = (file_hash: string, account: string) => 'imp-' + sha(file_hash + '|' + account).slice(0, 12);

/**
 * The request key of a row: from its fingerprint (account, date, signed amount, clean description, occurrence).
 * The same row in a second file, or in a file that overlaps, gives the same key, thus it is recorded one time.
 */
export const rowKey = (fingerprint: string) => 'imp-' + sha(fingerprint).slice(0, 32);

/** The fingerprint without its occurrence number (the number at the end): the same for each copy of one row in a file. */
export const baseOf = (fingerprint: string) => fingerprint.slice(0, fingerprint.lastIndexOf('|'));
