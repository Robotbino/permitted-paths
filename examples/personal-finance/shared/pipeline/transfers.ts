// The transfer rule of the reconcile stage: a move between two own accounts is not an expense and not income.
// The rule has two signals only: the same amount, and dates that are near. It has no proof that the two rows
// are one move. For this reason the note says that it is a match by amount and date. The review has no way to undo a pair.
// Limit: a row pairs with a row of the same file or with a row that the ledger has already. When the money in
// was imported first, it is in the ledger as income, and it stays income; the note of the pair says so.
// The candidates are found through an index (amount, direction, day), not by a comparison of each row with each row.
import type { OtherAccountRow, ReconciledRow } from './reconcile.ts';
import { dayNumber, type Direction } from './values.ts';

type Candidate = { order: number; account: string; day: number; fingerprint: string; row: ReconciledRow | null };

/** The two sides of a transfer between own accounts are not more than this number of days apart. */
export const TRANSFER_DAYS = 3;

/** Adds a value to the list of a key. */
export function addTo<T>(index: Map<string, T[]>, key: string, value: T): void {
  const list = index.get(key);
  if (list) list.push(value);
  else index.set(key, [value]);
}

/** The text that is added to each transfer note. */
export const TRANSFER_CHECK = 'This is a match by amount and date only. The review cannot undo it.';

/**
 * Money out of one tracked account and the same amount into a different tracked account, not more than 3 days apart:
 * both rows become 'transfer'. A fee row is never a side of a transfer.
 */
export function pairTransfers(out: ReconciledRow[], others: OtherAccountRow[]): void {
  const open = (row: ReconciledRow): boolean => row.status === 'new' && (row.kind === 'expense' || row.kind === 'income');
  const index = new Map<string, Candidate[]>();
  let order = 0;
  const add = (c: { account: string; occurred_on: string | null; amount_cents: number | null; direction: Direction | null; fingerprint: string }, row: ReconciledRow | null): void => {
    if (c.occurred_on === null || c.amount_cents === null || c.direction === null) return;
    const day = dayNumber(c.occurred_on);
    if (!Number.isFinite(day)) return;
    addTo(index, [c.amount_cents, c.direction, day].join('|'), { order: order++, account: c.account, day, fingerprint: c.fingerprint, row });
  };
  for (const row of out) if (open(row)) add(row, row);
  for (const other of others) add(other, null);

  // Each possible pair, then the pairs with the fewest days between the two sides first.
  // Thus a row does not take a partner that is nearer to a different row.
  const pairs: Array<{ row: ReconciledRow; partner: Candidate; gap: number }> = [];
  for (const row of out) {
    if (!open(row) || row.occurred_on === null || row.direction === null) continue;
    const opposite: Direction = row.direction === 'out' ? 'in' : 'out';
    const day = dayNumber(row.occurred_on);
    const found: Candidate[] = [];
    for (let d = day - TRANSFER_DAYS; d <= day + TRANSFER_DAYS; d++) {
      for (const partner of index.get([row.amount_cents, opposite, d].join('|')) ?? []) {
        if (partner.row !== row && partner.account !== row.account) found.push(partner);
      }
    }
    found.sort((a, b) => a.order - b.order); // the order of the file, then the order of the other rows
    for (const partner of found) pairs.push({ row, partner, gap: Math.abs(partner.day - day) });
  }
  pairs.sort((a, b) => a.gap - b.gap); // a stable sort: with equal gaps, the order of the file stays
  const used = new Set<Candidate>();

  for (const { row, partner } of pairs) {
    if (!open(row) || used.has(partner) || (partner.row !== null && !open(partner.row))) continue;
    used.add(partner);
    const from = row.direction === 'out' ? row.account : partner.account;
    const to = row.direction === 'out' ? partner.account : row.account;
    // The other side is a ledger row of money in: it was recorded as income before this file, and the application does not change it.
    const income = partner.row === null && row.direction === 'out';
    const note = 'This is a move between your own accounts, from ' + from + ' to ' + to + '. '
      + (income ? 'It is not an expense. The other side is already in the ledger as income, and it stays income. Next time, import the account that the money left first. ' : 'It is not an expense and not income. ')
      + TRANSFER_CHECK;
    row.status = 'transfer';
    row.pair_fingerprint = partner.fingerprint;
    row.note = note;
    if (partner.row !== null) {
      partner.row.status = 'transfer';
      partner.row.pair_fingerprint = row.fingerprint;
      partner.row.note = note;
    }
  }
}
