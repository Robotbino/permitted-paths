// The last six nodes of the import graph: the person decided, and the application acts.
//   await_person -> apply -> reconcile -> export -> respond ; reject
// apply gives each line exactly one end. reconcile is the independent check of that. export makes
// text that the person copies into a budget sheet; the application never opens or writes a sheet.
import type { Problem } from '../../shared/contracts.ts';
import { MAPPING_FIELDS, type ImportLine, type LineEnd, type LineOutcome } from '../../shared/contracts.import.ts';
import { EXPORT_PROFILES, pasteRows, type LedgerEntry } from '../../shared/export/paste-rows.ts';
import type { ReconciledRow } from '../../shared/pipeline/reconcile.ts';
import { merchantKey } from '../domain/expense.ts';
import { baseOf, rowKey, type ImportNode, type ImportState } from './import-state.ts';
import { reconcile } from './reconciler.ts';

export const DEFAULT_EXPORT_PROFILE = 'default';
export const HELD_TEXT = 'The bank marks this row as pending. Import it again when it clears.';

const outcome = (row: ReconciledRow, end: LineEnd, detail: string): LineOutcome => ({ line_no: row.line_no, end, expense_id: null, income_id: null, detail });
const suggestionOf = (state: Readonly<ImportState>, row: ReconciledRow) => (row.status === 'new' && row.direction === 'out' ? (state.suggestions[merchantKey(row.description_clean)] ?? null) : null);

/** A row of the pipeline in the form of the proposal. */
function toLine(state: Readonly<ImportState>, row: ReconciledRow): ImportLine {
  const { line_no, raw, status, occurred_on, amount_cents, direction, description_clean, kind, problems, provenance } = row;
  return { line_no, raw, status, note: row.note ?? null, occurred_on, amount_cents, direction, description_clean, kind, problems, provenance, suggestion: suggestionOf(state, row) };
}

export const WRITE_NODES: ImportNode[] = [
  {
    id: 'await_person', type: 'person',
    act(state) {
      // The first visit: no decisions. The run stops here and the state is stored.
      if (state.decisions === null) return { note: 'The proposal waits for the person. The state is stored as a checkpoint.' };
      // The second visit, after the resume: the decisions of the person are input. Check them.
      const known = new Set(state.staged!.rows.map((row) => row.line_no));
      const strange = state.decisions.filter((d) => !known.has(d.line_no)).map((d) => d.line_no);
      const problems: Problem[] = strange.length ? [{ rule: 'R14', text: 'The decisions name lines that are not in the statement: ' + strange.join(', ') + '.' }] : [];
      const wanted = state.export_profile ?? DEFAULT_EXPORT_PROFILE;
      if (!EXPORT_PROFILES.some((p) => p.id === wanted)) problems.push({ rule: 'R14', text: 'The export profile "' + wanted + '" is not known. Permitted: ' + EXPORT_PROFILES.map((p) => p.id).join(', ') + '.' });
      return { writes: { decision_problems: problems }, result: problems.length ? 'FAIL' : 'PASS', note: problems.length ? 'The decisions are not for this statement.' : 'The person decided ' + state.decisions.filter((d) => d.category_id).length + ' lines.' };
    },
  },
  {
    id: 'apply', type: 'code',
    async act(state, deps) {
      const chosen = new Map(state.decisions!.map((d) => [d.line_no, d.category_id]));
      const outcomes: LineOutcome[] = [];
      // For each row of the file that comes more than one time: are all the copies so far in the ledger?
      // Only then the file confirms the next copy (two equal purchases on one day). A copy that waits,
      // for example because the ledger has a similar expense from the form, gives no confirmation.
      const copies = new Map<string, boolean>();
      // One line after the other: the ledger has one writer. Each line gets exactly one end.
      for (const row of state.staged!.rows) {
        const category_id = chosen.get(row.line_no) ?? null;
        const key = rowKey(row.fingerprint);
        if (row.status === 'problem') outcomes.push(outcome(row, 'REJECTED', row.problems.map((p) => p.rule + ': ' + p.text).join(' ')));
        else if (row.status === 'duplicate') outcomes.push(outcome(row, 'DUPLICATE', row.note ?? 'This row is already in the ledger.'));
        else if (row.status === 'held') outcomes.push(outcome(row, 'WAITING', HELD_TEXT));
        else if (row.status === 'transfer' || row.status === 'reversed') outcomes.push(outcome(row, 'PAIRED', (row.note ?? 'This row is not an expense and not income.') + ' The other row: ' + (row.pair_fingerprint ?? 'not known') + '.'));
        else if (row.direction === 'in') outcomes.push(deps.recordIncome(row, key));
        else if (!category_id) outcomes.push(outcome(row, 'WAITING', 'The person selected no category.'));
        else {
          // Each expense is its own run of the record graph, with the same gates as a line from the form.
          const suggestion = suggestionOf(state, row);
          outcomes.push(await deps.recordLine(row, category_id, key, suggestion?.category_id === category_id ? suggestion.run_id : null, state.run_id, copies.get(baseOf(row.fingerprint)) === true));
        }
        const last = outcomes[outcomes.length - 1]!;
        const base = baseOf(row.fingerprint);
        copies.set(base, (copies.get(base) ?? true) && (last.end === 'RECORDED' || last.end === 'DUPLICATE'));
      }
      const inLedger = outcomes.filter((o) => o.end === 'RECORDED' || o.end === 'DUPLICATE').length;
      return { writes: { outcomes }, note: outcomes.length + ' lines have an end. ' + (outcomes.length - inLedger) + ' are not in the ledger.' };
    },
  },
  {
    id: 'reconcile', type: 'code',
    act(state, deps) {
      const keys = new Map(state.staged!.rows.map((row) => [row.line_no, rowKey(row.fingerprint)]));
      const reconciliation = reconcile(state.staged!.rows, state.outcomes!, (line_no) => keys.get(line_no) ?? '', deps.ledger);
      return { writes: { reconciliation }, result: reconciliation.ok ? 'PASS' : 'FAIL', note: reconciliation.ok ? 'Each line has exactly one end, and the ledger agrees.' : 'R14: ' + reconciliation.problems.length + ' problems.' };
    },
  },
  {
    id: 'export', type: 'code',
    act(state, deps) {
      const profile = EXPORT_PROFILES.find((p) => p.id === (state.export_profile ?? DEFAULT_EXPORT_PROFILE))!;
      const recorded = new Set(state.outcomes!.filter((o) => o.end === 'RECORDED').map((o) => o.line_no));
      // The entries are read from the ledger again, by key. The text shows what is stored, not what the file said.
      const entries = state.staged!.rows.filter((row) => recorded.has(row.line_no)).flatMap((row): LedgerEntry[] => {
        const entry = deps.entryForKey(rowKey(row.fingerprint));
        return entry ? [entry] : [];
      });
      const text = pasteRows(entries, profile);
      const before = state.outcomes!.filter((o) => o.end === 'DUPLICATE').length;
      const notes = before > 0 ? [...text.notes, 'Already in the ledger before this import: ' + before + ' rows. They are not in this text, thus a second paste adds no row two times.'] : text.notes;
      return { writes: { export: { export_profile: profile.id, expenses_tsv: text.expenses_tsv, income_tsv: text.income_tsv, notes } }, note: entries.length + ' rows as text for the sheet template "' + profile.id + '". No sheet is opened or written.' };
    },
  },
  {
    id: 'respond', type: 'code',
    act(state) {
      const { batch_id, run_id, account } = state;
      if (!state.staged) {
        return { writes: { response: { step: 'mapping', batch_id, run_id, account, header: state.file!.header, rows: state.file!.preview, fields: MAPPING_FIELDS, problems: state.map!.problems } }, note: 'Answer: a mapping is necessary.' };
      }
      if (!state.outcomes) {
        const { profile, rows, summary, problems } = state.staged;
        return { writes: { response: { step: 'review', batch_id, run_id, account, profile, lines: rows.map((row) => toLine(state, row)), summary, problems, budget: state.budget! } }, note: 'Answer with the proposal.' };
      }
      const counts: Record<LineEnd, number> = { RECORDED: 0, DUPLICATE: 0, REJECTED: 0, WAITING: 0, PAIRED: 0 };
      for (const o of state.outcomes) counts[o.end] += 1;
      return { writes: { response: { batch_id, run_id, outcomes: state.outcomes, counts, reconciliation: state.reconciliation!, ...state.export! } }, note: 'Answer with the end of each line.' };
    },
  },
  {
    id: 'reject', type: 'code',
    act(state) {
      // The problems of the node that sent the run here.
      const problems = [state.decision_problems, state.mapping_problems, state.map?.source === 'given' ? state.map.problems : [], state.file?.refusal ?? []].find((list) => list.length > 0);
      return { writes: { rejection: { problems: problems ?? [{ rule: 'R14', text: 'The import was refused.' }] } }, result: 'FAIL', note: 'Refused. Nothing is recorded.' };
    },
  },
];
