// The expense: pure functions, no store, no HTTP.
import type { Expense, RecordExpenseRequest } from '../../shared/contracts.ts';

/** A request that passed the check of shape, without the fields that are only for the transport. */
export type ExpenseProposal = Omit<RecordExpenseRequest, 'idempotency_key' | 'confirm_duplicate' | 'suggest_run_id'> & { merchant_key: string };

/** "  Woolworths  Food " and "WOOLWORTHS FOOD" are the same merchant: "woolworths food". */
export function merchantKey(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
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
    stored.note === (proposal.note ?? null)
  );
}
