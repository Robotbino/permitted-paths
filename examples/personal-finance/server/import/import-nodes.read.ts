// The first five nodes of the import graph: they read the file and propose. They record nothing.
//   inspect -> map -> [await_mapping] -> stage -> classify
// The stages of shared/pipeline do the work on the data. A node gives the stage its input, and
// writes the result to the state. No model reads or changes a row of the file.
import type { Problem } from '../../shared/contracts.ts';
import { MAX_STATEMENT_LINES, type LineSuggestion } from '../../shared/contracts.import.ts';
import { inspect, matchProfile, normalise, reconcile, runPipeline, textHash, TRANSFER_DAYS, validateMapping, type MappingProfile } from '../../shared/pipeline/index.ts';
import { addDays } from '../../shared/planning/pay-cycle.ts';
import { merchantKey } from '../domain/expense.ts';
import { batchIdOf, POOL_SIZE, rowKey, SOURCE_NAME, type ImportNode, type ImportState } from './import-state.ts';
import { mapPool } from './pool.ts';

/** The rows that can become an expense: the pipeline says 'new', and the money went out. Only these get a suggestion. */
export const expenseRows = (state: Readonly<ImportState>) => (state.staged?.rows ?? []).filter((row) => row.status === 'new' && row.direction === 'out');

const rules = (problems: Problem[]) => problems.map((p) => p.rule).join(', ');

export const READ_NODES: ImportNode[] = [
  {
    id: 'inspect', type: 'code',
    act(state) {
      const inspected = inspect(state.csv);
      const hash = textHash(state.csv);
      let refusal: Problem[] = [];
      // Text with no rows or with one column is not a table: no mapping can read it.
      if (inspected.header.length < 2 || inspected.rows.length === 0) refusal = inspected.problems.length ? inspected.problems : [{ rule: 'R14', text: 'The text is not a table with a header line and rows.' }];
      else if (inspected.rows.length > MAX_STATEMENT_LINES) refusal = [{ rule: 'R14', text: 'The statement has ' + inspected.rows.length + ' lines. One import can have ' + MAX_STATEMENT_LINES + ' at most: divide the file.' }];
      const file = { hash, header: inspected.header, row_count: inspected.rows.length, preview: inspected.rows.slice(0, 5).map((row) => row.cells), problems: inspected.problems, refusal };
      return {
        writes: { batch_id: batchIdOf(hash, state.account), file },
        result: refusal.length ? 'FAIL' : 'PASS',
        note: refusal.length ? 'The text cannot be imported: ' + rules(refusal) + '.' : inspected.rows.length + ' rows, ' + inspected.header.length + ' columns.',
      };
    },
  },
  {
    id: 'map', type: 'code',
    act(state) {
      if (state.mapping !== null) {
        // A mapping in the request. It passes the same gate as each mapping, whoever proposed it.
        const problems = validateMapping(state.mapping as MappingProfile, inspect(state.csv));
        const profile_id = problems.length ? null : (state.mapping as MappingProfile).id;
        return { writes: { map: { source: 'given', profile_id, problems } }, result: problems.length ? 'FAIL' : 'PASS', note: problems.length ? 'The mapping gate: FAIL (' + rules(problems) + ').' : 'The mapping gate: PASS for the given mapping.' };
      }
      // No mapping: the pipeline looks for a known profile and tries it on the file (a dry run).
      const dry = runPipeline(state.csv, { account: state.account, source_name: SOURCE_NAME });
      if (dry.profile && !dry.needs_mapping) return { writes: { map: { source: 'known', profile_id: dry.profile.id, problems: [] } }, note: 'The header fits the known profile "' + dry.profile.id + '".' };
      return { writes: { map: { source: 'none', profile_id: null, problems: dry.mapping_problems } }, note: dry.profile ? 'The profile "' + dry.profile.id + '" does not read this file.' : 'The header fits no known profile.' };
    },
  },
  {
    id: 'await_mapping', type: 'person',
    act(state) {
      // The first visit: no mapping. The run stops here and the state is stored.
      if (state.mapping === null) return { note: 'A mapping is necessary. The state is stored as a checkpoint.' };
      // The second visit, after the resume: the mapping is input. It must pass the mapping gate.
      const problems = validateMapping(state.mapping as MappingProfile, inspect(state.csv));
      return { writes: { mapping_problems: problems }, result: problems.length ? 'FAIL' : 'PASS', note: problems.length ? 'The mapping gate: FAIL (' + rules(problems) + ').' : 'The mapping gate: PASS.' };
    },
  },
  {
    id: 'stage', type: 'code',
    act(state, deps) {
      const inspected = inspect(state.csv);
      // The mapping passed the gate (node map or await_mapping), or the header fits one known profile (node map).
      const profile = (state.mapping as MappingProfile | null) ?? matchProfile(inspected.header)!;
      const normalised = normalise(inspected, profile, { account: state.account, source_name: SOURCE_NAME });
      // What is known: the rows of this file that the ledger has already, and the rows of the other accounts near the dates of the file.
      const fingerprints = normalised.rows.map((row) => row.fingerprint).filter((fingerprint) => deps.inLedger(rowKey(fingerprint)));
      const dates = normalised.rows.flatMap((row) => (row.occurred_on === null ? [] : [row.occurred_on])).sort();
      const others = dates.length ? deps.otherAccountRows(state.account, addDays(dates[0]!, -TRANSFER_DAYS), addDays(dates[dates.length - 1]!, TRANSFER_DAYS)) : [];
      const reconciled = reconcile(normalised.rows, { fingerprints, other_account_rows: others });
      const problems = [...inspected.problems, ...normalised.problems, ...reconciled.problems];
      const s = reconciled.summary;
      return {
        writes: { staged: { profile: { id: profile.id, name: profile.name }, rows: reconciled.rows, summary: s, problems } },
        note: reconciled.rows.length + ' rows staged: ' + s.new + ' new, ' + s.duplicate + ' duplicate, ' + s.transfer + ' transfer, ' + s.held + ' held, ' + s.reversed + ' reversed, ' + s.problem + ' with a problem.' + (problems.length ? ' The file: ' + rules(problems) + '.' : ''),
      };
    },
  },
  {
    id: 'classify', type: 'code',
    async act(state, deps) {
      // One suggestion for each different merchant, not for each row.
      const merchants = [...new Map(expenseRows(state).map((row) => [merchantKey(row.description_clean), row.description_clean])).entries()];
      const unknown = merchants.filter(([key]) => !deps.knows(key));
      // The budget is decided here, one time, before any worker starts. Workers that run at the same
      // time cannot count each other, thus a worker is told if it has a model call or not.
      const granted = deps.reserveModelCalls(unknown.length);
      const allowed = new Set(unknown.slice(0, granted).map(([key]) => key));
      const results = await mapPool(merchants, POOL_SIZE, ([key, name]) => deps.suggestLine(name, allowed.has(key), state.run_id));
      const suggestions: Record<string, LineSuggestion> = {};
      merchants.forEach(([key], i) => { suggestions[key] = results[i]!.suggestion; });
      const made = results.filter((r) => ['FROM_MODEL', 'MODEL_UNAVAILABLE', 'NOT_PERMITTED', 'MODEL_DOES_NOT_KNOW'].includes(r.reason)).length;
      const budget = { unknown_merchants: unknown.length, model_calls_allowed: allowed.size, model_calls_made: made };
      return { writes: { suggestions, budget }, note: merchants.length + ' merchants. ' + (merchants.length - unknown.length) + ' from the memory, ' + made + ' model calls, ' + (unknown.length - allowed.size) + ' with no budget.' };
    },
  },
];
