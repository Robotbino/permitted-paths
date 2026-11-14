// The expense: pure functions, no store, no HTTP.
import { DEFAULT_ACCOUNT, type Expense, type RecordExpenseRequest } from '../../shared/contracts.ts';

/** A request that passed the check of shape, without the fields that are only for the transport. */
export type ExpenseProposal = Omit<RecordExpenseRequest, 'idempotency_key' | 'confirm_duplicate' | 'suggest_run_id' | 'account'> & { merchant_key: string; account: string };

/** "  Woolworths  Food " and "WOOLWORTHS FOOD" are the same merchant: "woolworths food". */
export function merchantKey(name: string): string {
  // Letters and digits of each script stay ("Müller" and "Muller" are one merchant; a name in
  // Cyrillic or Japanese keeps its own key). Accents, case, spaces and punctuation go away.
  const key = name
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
  // A name with no letter and no digit ("***") must not have the empty key: all such names would be one merchant.
  return key !== '' ? key : name.trim().toLowerCase();
}

export function toProposal(request: RecordExpenseRequest): ExpenseProposal {
  return {
    amount_cents: request.amount_cents,
    currency: request.currency,
    occurred_on: request.occurred_on,
    merchant_name: request.merchant_name,
    merchant_key: merchantKey(request.merchant_name),
    category_id: request.category_id,
    note: request.note,
    account: request.account ?? DEFAULT_ACCOUNT,
  };
}

/** The month of a date: "2026-03-14" -> "2026-03". */
export function periodOf(date: string): string {
  return date.slice(0, 7);
}

export function toExpense(proposal: ExpenseProposal, id: string, idempotency_key: string, created_at: string): Expense {
  return {
    id,
    idempotency_key,
    occurred_on: proposal.occurred_on,
    amount_cents: proposal.amount_cents,
    currency: proposal.currency,
    merchant_name: proposal.merchant_name,
    merchant_key: proposal.merchant_key,
    category_id: proposal.category_id,
    note: proposal.note ?? null,
    account: proposal.account,
    created_at,
  };
}

/** Is the stored expense the record of this proposal? A replay of a request must have the same body. */
export function sameAsStored(stored: Expense, proposal: ExpenseProposal): boolean {
  return (
    stored.occurred_on === proposal.occurred_on &&
    stored.amount_cents === proposal.amount_cents &&
    stored.currency === proposal.currency &&
    stored.merchant_key === proposal.merchant_key &&
    stored.category_id === proposal.category_id &&
    stored.note === (proposal.note ?? null) &&
    stored.account === proposal.account
  );
}
