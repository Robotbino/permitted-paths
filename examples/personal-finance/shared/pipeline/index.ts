// The import pipeline as one function: raw text -> inspect -> map -> validate -> normalise -> reconcile -> staged rows.
// Each stage is deterministic code with a clear input and output. A model never processes the data.
// The result is for a person to review; nothing here writes to a store.
// runPipeline never throws for bad input: each failure is a problem in the result.
import type { Problem } from '../contracts.ts';
import { inspect, textHash, type Inspected } from './inspect.ts';
import { normalise } from './normalise.ts';
import { DRY_RUN_ROWS, matchProfile, validateMapping, type MappingProfile } from './profiles.ts';
import { reconcile, type Known, type ReconciledRow, type RowStatus } from './reconcile.ts';

export * from './inspect.ts';
export * from './values.ts';
export * from './profiles.ts';
export * from './normalise.ts';
export { checkRemove, cleanerFor, maskDigits, MAX_CLEAN_ENTRIES, MAX_CLEAN_LENGTH, MAX_REMOVE_LENGTH, MAX_REPEATS, removeRule, visibleText } from './clean.ts';
export * from './mapping-shape.ts';
export { pairTransfers, TRANSFER_CHECK } from './transfers.ts';
export * from './balance.ts';
export * from './reconcile.ts';

export type PipelineOptions = {
  /** A mapping from a person or a proposal. If it is absent, the pipeline looks for a known profile. */
  profile?: MappingProfile;
  account: string;
  source_name: string;
  known?: Known;
};

export type PipelineResult = {
  inspected: Inspected;
  profile: MappingProfile | null;
  /** The result of the mapping gate. An empty list with a profile is PASS. */
  mapping_problems: Problem[];
  /** true: the file is readable, and it has no mapping that passes the gate. A person must give or correct the mapping. */
  needs_mapping: boolean;
  rows: ReconciledRow[];
  summary: Record<RowStatus, number>;
  /** The problems of the file and of the batch. The problems of one row are on that row. */
  problems: Problem[];
  file_hash: string;
};

const EMPTY_SUMMARY: Record<RowStatus, number> = { new: 0, duplicate: 0, transfer: 0, held: 0, reversed: 0, problem: 0 };

/** Adds each problem of a list. A loop, because a call with 100 000 arguments stops the program. */
function add(target: Problem[], more: Problem[]): void {
  for (const problem of more) target.push(problem);
}

/**
 * A known profile of this program is not a proposal: its columns are in the header, thus the mapping is correct.
 * If the dry run finds only rows that do not parse, and not each row, the cause is the data of those rows.
 * Then the file continues, and each such row is staged with its problem. A mapping from a person or a model
 * gets no such tolerance: there the same result can mean an incorrect date format or decimal sign.
 */
function tolerated(problems: Problem[], inspected: Inspected): boolean {
  if (problems.length === 0 || !problems.every((p) => p.rule === 'MAP-DATE' || p.rule === 'MAP-AMOUNT')) return false;
  const lines = new Set(problems.map((p) => p.text.slice(0, p.text.indexOf(':'))));
  return lines.size < Math.min(DRY_RUN_ROWS, inspected.rows.length);
}

export function runPipeline(text: string, options: PipelineOptions): PipelineResult {
  const result: PipelineResult = {
    inspected: { delimiter: ',', quoted: false, header: [], rows: [], problems: [] },
    profile: null,
    mapping_problems: [],
    needs_mapping: false,
    rows: [],
    summary: { ...EMPTY_SUMMARY },
    problems: [],
    file_hash: '',
  };
  try {
    const raw = typeof text === 'string' ? text : '';
    result.file_hash = textHash(raw);
    result.inspected = inspect(raw);
    add(result.problems, result.inspected.problems);
    // A file with no rows or with one column cannot be mapped. The inspect problems say why.
    if (result.inspected.header.length < 2 || result.inspected.rows.length === 0) return result;

    const given = options?.profile;
    result.profile = given ?? matchProfile(result.inspected.header);
    if (result.profile === null) {
      result.needs_mapping = true;
      return result;
    }
    result.mapping_problems = validateMapping(result.profile, result.inspected);
    if (given === undefined && tolerated(result.mapping_problems, result.inspected)) result.mapping_problems = [];
    if (result.mapping_problems.length > 0) {
      result.needs_mapping = true;
      return result;
    }
    const normalised = normalise(result.inspected, result.profile, { account: String(options.account), source_name: String(options.source_name) });
    const reconciled = reconcile(normalised.rows, options.known ?? { fingerprints: [] });
    result.rows = reconciled.rows;
    result.summary = reconciled.summary;
    add(result.problems, normalised.problems);
    add(result.problems, reconciled.problems);
  } catch (error) {
    // A defect in the pipeline must not stop the caller. The rows of a run that stopped are not trusted.
    result.rows = [];
    result.summary = { ...EMPTY_SUMMARY };
    result.problems.push({ rule: 'PIPELINE-STOPPED', text: 'The import stopped before the end: ' + (error instanceof Error ? error.message : 'unknown cause') + '. No row was staged.' });
  }
  return result;
}
