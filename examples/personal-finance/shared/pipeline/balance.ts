// The balance check of a batch. Some banks give a running balance on each row.
// Then one rule must hold for each row: the balance before + the signed amount = the balance of this row.
// If the rule breaks, rows are absent between two lines (a cut file) or a value was read incorrectly.
// The check reports only the first line where the rule breaks: the lines after it tell nothing new.
import type { Problem } from '../contracts.ts';
import { formatMoney } from '../money.ts';
import type { StagedRow } from './normalise.ts';

type BalanceRow = Pick<StagedRow, 'line_no' | 'occurred_on' | 'amount_cents' | 'direction' | 'balance_after_cents'>;

/** One walk through the rows: the number of steps where the rule holds, and the first step where it breaks. */
function walk(ordered: BalanceRow[]): { holds: number; firstBreak: Problem | null } {
  let holds = 0;
  let firstBreak: Problem | null = null;
  let previous: BalanceRow | null = null;
  for (const row of ordered) {
    if (row.balance_after_cents === null) {
      previous = null;
      continue;
    }
    if (previous !== null && previous.balance_after_cents !== null && row.amount_cents !== null && row.direction !== null) {
      const expected = previous.balance_after_cents + (row.direction === 'out' ? -row.amount_cents : row.amount_cents);
      if (expected === row.balance_after_cents) holds += 1;
      else if (firstBreak === null) {
        firstBreak = {
          rule: 'BATCH-BALANCE',
          text:
            'Line ' + row.line_no + ': the balance does not continue from line ' + previous.line_no + '. The calculation gives ' +
            formatMoney(expected) + ' and the file has ' + formatMoney(row.balance_after_cents) +
            '. Possibly the file is cut and rows are absent between these lines.',
        };
      }
    }
    previous = row;
  }
  return { holds, firstBreak };
}

/**
 * An empty list is PASS. Rows without a balance are not checked, and the chain starts again after them.
 * Some files have the oldest row first and some have the newest row first. The dates do not always show the order
 * (all rows can have one date), thus the check reads the rows in both orders and uses the order in which
 * the rule holds for more rows. Only if that gives no answer, the dates of the first and the last row decide.
 */
export function checkBalance(rows: BalanceRow[]): Problem[] {
  const forward = walk(rows);
  if (forward.firstBreak === null) return [];
  const backward = walk([...rows].reverse());
  if (backward.firstBreak === null) return [];
  if (forward.holds !== backward.holds) return [forward.holds > backward.holds ? forward.firstBreak : backward.firstBreak];
  const dated = rows.filter((row) => row.occurred_on !== null);
  const first = dated[0]?.occurred_on ?? '';
  const last = dated[dated.length - 1]?.occurred_on ?? '';
  return [first > last ? backward.firstBreak : forward.firstBreak];
}
