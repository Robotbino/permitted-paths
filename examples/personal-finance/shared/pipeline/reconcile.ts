// Stage 5 of the import pipeline: reconcile. It compares the staged rows with each other and with what is known,
// and gives each row a status. Only a 'new' row is a candidate for the ledger.
// The order of the rules is fixed: problem, duplicate, held, reversed, transfer. Then the balance of the batch is checked.
// Each row that is not 'new' gets a note in plain words, thus the person who reviews sees the reason.
// The rows are found through an index (amount, direction, day), thus a large file takes time in proportion to its size.
import type { Problem } from '../contracts.ts';
import { checkBalance } from './balance.ts';
import type { StagedRow } from './normalise.ts';
import { addTo, pairTransfers } from './transfers.ts';

export { TRANSFER_DAYS } from './transfers.ts';
import { dayNumber, type Direction } from './values.ts';

export const ROW_STATUSES = ['new', 'duplicate', 'transfer', 'held', 'reversed', 'problem'] as const;
export type RowStatus = (typeof ROW_STATUSES)[number];

/** in_ledger: a row with a problem whose fingerprint the ledger has already. The reconciler then expects that ledger row. */
export type ReconciledRow = Omit<StagedRow, 'status'> & { status: RowStatus; pair_fingerprint?: string; note?: string; in_ledger?: true };

export type OtherAccountRow = { account: string; occurred_on: string; amount_cents: number; direction: Direction; fingerprint: string };

/**
 * What is known before this batch: the fingerprints in the ledger, and rows of the other tracked accounts.
 * Give only the other-account rows that have no partner yet. A row that is given again can pair again.
 */
export type Known = { fingerprints: string[]; other_account_rows?: OtherAccountRow[] };

export type Reconciled = { rows: ReconciledRow[]; summary: Record<RowStatus, number>; problems: Problem[] };

/** A reversal cancels a row that is not more than this number of days before it. */
export const REVERSAL_DAYS = 10;

export function reconcile(rows: StagedRow[], known: Known): Reconciled {
  const ledger = new Set(known.fingerprints);
  const out: ReconciledRow[] = rows.map((row) => {
    const copy = { ...row, problems: [...row.problems] };
    if (row.problems.length > 0) {
      // A row with a problem is not trusted, thus it is not called a duplicate. But the ledger can have a row with its values already.
      const note = 'This row has a problem. It stays out of the ledger until it is corrected.';
      return ledger.has(row.fingerprint) ? { ...copy, status: 'problem', note: note + ' The ledger already has a row with these values.', in_ledger: true } : { ...copy, status: 'problem', note };
    }
    if (ledger.has(row.fingerprint)) return { ...copy, status: 'duplicate', note: 'This row is already in the ledger. It is not added again.' };
    if (row.kind === 'pending') {
      return { ...copy, status: 'held', note: 'This payment is pending. No money moved yet. The row comes again when the payment clears.' };
    }
    return { ...copy, status: 'new' };
  });
  pairReversals(out);
  pairTransfers(out, known.other_account_rows ?? []);

  const summary: Record<RowStatus, number> = { new: 0, duplicate: 0, transfer: 0, held: 0, reversed: 0, problem: 0 };
  for (const row of out) summary[row.status] += 1;
  return { rows: out, summary, problems: checkBalance(rows) };
}

/**
 * A reversal cancels the nearest earlier row of the same account with the same amount and the opposite direction.
 * "Earlier" is by date, because some files have the newest row first. Both rows become 'reversed'.
 * If the cancelled row is already in the ledger, it stays 'duplicate' and the reversal points at it.
 */
function pairReversals(out: ReconciledRow[]): void {
  // The rows that a reversal can cancel, by account, amount, direction and day.
  const index = new Map<string, ReconciledRow[]>();
  for (const row of out) {
    if (row.kind === 'reversal' || row.kind === 'pending' || (row.status !== 'new' && row.status !== 'duplicate')) continue;
    if (row.occurred_on === null || row.amount_cents === null || row.direction === null) continue;
    addTo(index, [row.account, row.amount_cents, row.direction, dayNumber(row.occurred_on)].join('|'), row);
  }
  const used = new Set<ReconciledRow>();
  for (const reversal of out) {
    if (reversal.status !== 'new' || reversal.kind !== 'reversal' || reversal.occurred_on === null) continue;
    const opposite: Direction = reversal.direction === 'out' ? 'in' : 'out';
    const day = dayNumber(reversal.occurred_on);
    let partner: ReconciledRow | null = null;
    // The same day first, then one day earlier, and so on. On one day, the row with the nearest line wins.
    for (let gap = 0; gap <= REVERSAL_DAYS && partner === null; gap++) {
      for (const row of index.get([reversal.account, reversal.amount_cents, opposite, day - gap].join('|')) ?? []) {
        if (used.has(row)) continue;
        if (partner === null || Math.abs(row.line_no - reversal.line_no) < Math.abs(partner.line_no - reversal.line_no)) partner = row;
      }
    }
    if (partner === null) {
      const text = 'This reversal has no earlier row with the same amount in the ' + REVERSAL_DAYS + ' days before it. Possibly that row is in a different file.';
      reversal.status = 'problem';
      reversal.problems.push({ rule: 'ROW-REVERSAL', text });
      reversal.note = text;
      continue;
    }
    used.add(partner);
    reversal.status = 'reversed';
    reversal.pair_fingerprint = partner.fingerprint;
    if (partner.status === 'new') {
      reversal.note = 'This row cancels the row of ' + partner.occurred_on + ' with the same amount. The two rows together change nothing.';
      partner.status = 'reversed';
      partner.pair_fingerprint = reversal.fingerprint;
      partner.note = 'The reversal of ' + reversal.occurred_on + ' cancels this row. The two rows together change nothing.';
    } else {
      reversal.note = 'This row cancels the row of ' + partner.occurred_on + ' with the same amount. That row is already in the ledger: remove it there.';
    }
  }
}
