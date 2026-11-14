// The reconciler: the independent check of an import. Rule R14: each line of the statement has
// exactly one end. It reads the ledger through the read-only view of the verifier, not through
// the code that recorded the lines.
import type { Problem } from '../../shared/contracts.ts';
import { LINE_ENDS, type LineOutcome, type StatementLine } from '../../shared/contracts.import.ts';
import type { LedgerReader } from '../graph/verifier.ts';

export type Reconciliation = { ok: boolean; problems: Problem[] };

export function reconcile(lines: StatementLine[], outcomes: LineOutcome[], keyOf: (line_no: number) => string, ledger: LedgerReader): Reconciliation {
  const problems: Problem[] = [];
  const say = (text: string) => void problems.push({ rule: 'R14', text });
  for (const line of lines) {
    const ends = outcomes.filter((o) => o.line_no === line.line_no);
    if (ends.length !== 1) { say('Line ' + line.line_no + ' has ' + ends.length + ' ends. It must have exactly 1.'); continue; }
    const end = ends[0]!;
    if (!LINE_ENDS.includes(end.end)) { say('Line ' + line.line_no + ' has the end "' + end.end + '", which is not permitted.'); continue; }
    const rows = ledger.rowsForKey(keyOf(line.line_no));
    const inLedger = end.end === 'RECORDED' || end.end === 'DUPLICATE';
    if (inLedger && rows.length !== 1) say('Line ' + line.line_no + ' is ' + end.end + ', but the ledger has ' + rows.length + ' rows for it.');
    if (!inLedger && rows.length !== 0) say('Line ' + line.line_no + ' is ' + end.end + ', but the ledger has a row for it.');
    if (inLedger && rows[0] && rows[0].amount_cents !== line.amount_cents) say('Line ' + line.line_no + ' says ' + line.amount_cents + ' cents. The ledger says ' + rows[0].amount_cents + '.');
  }
  const unknown = outcomes.filter((o) => !lines.some((l) => l.line_no === o.line_no));
  if (unknown.length > 0) say('There are ' + unknown.length + ' ends for lines that are not in the statement.');
  return { ok: problems.length === 0, problems };
}
