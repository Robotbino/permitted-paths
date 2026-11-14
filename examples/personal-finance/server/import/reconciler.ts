// The reconciler: the independent check of an import. Rule R14: each line of the statement has
// exactly one end. It reads the ledger through the read-only view of the verifier, not through
// the code that recorded the lines. The ledger is the expenses and the income together.
// A RECORDED or DUPLICATE line has exactly one ledger row under its key, with the same amount.
// A line with a different end (REJECTED, WAITING, PAIRED) has no ledger row from this import. One case has a
// ledger row from before: a row with a problem whose values the ledger had already (in_ledger). It ends
// REJECTED, and the ledger row of the earlier import is correct.
import type { Problem } from '../../shared/contracts.ts';
import { LINE_ENDS, type LineOutcome } from '../../shared/contracts.import.ts';
import type { LedgerReader } from '../graph/verifier.ts';

export type Reconciliation = { ok: boolean; problems: Problem[] };

export function reconcile(lines: ReadonlyArray<{ line_no: number; amount_cents: number | null; in_ledger?: true }>, outcomes: LineOutcome[], keyOf: (line_no: number) => string, ledger: LedgerReader): Reconciliation {
  const problems: Problem[] = [];
  const say = (text: string) => void problems.push({ rule: 'R14', text });
  for (const line of lines) {
    const ends = outcomes.filter((o) => o.line_no === line.line_no);
    if (ends.length !== 1) { say('Line ' + line.line_no + ' has ' + ends.length + ' ends. It must have exactly 1.'); continue; }
    const end = ends[0]!;
    if (!LINE_ENDS.includes(end.end)) { say('Line ' + line.line_no + ' has the end "' + end.end + '", which is not permitted.'); continue; }
    const key = keyOf(line.line_no);
    const rows: Array<{ amount_cents: number }> = [...ledger.rowsForKey(key), ...ledger.incomeRowsForKey(key)];
    const inLedger = end.end === 'RECORDED' || end.end === 'DUPLICATE';
    if (inLedger && rows.length !== 1) say('Line ' + line.line_no + ' is ' + end.end + ', but the ledger has ' + rows.length + ' rows for it.');
    const before = !inLedger && end.end === 'REJECTED' && line.in_ledger === true;
    if (before && rows.length !== 1) say('Line ' + line.line_no + ' is REJECTED and its values were in the ledger before, but the ledger has ' + rows.length + ' rows for it.');
    if (!inLedger && !before && rows.length !== 0) say('Line ' + line.line_no + ' is ' + end.end + ', but the ledger has a row for it.');
    if (inLedger && rows[0] && rows[0].amount_cents !== line.amount_cents) say('Line ' + line.line_no + ' says ' + line.amount_cents + ' cents. The ledger says ' + rows[0].amount_cents + '.');
  }
  const unknown = outcomes.filter((o) => !lines.some((l) => l.line_no === o.line_no));
  if (unknown.length > 0) say('There are ' + unknown.length + ' ends for lines that are not in the statement.');
  return { ok: problems.length === 0, problems };
}
