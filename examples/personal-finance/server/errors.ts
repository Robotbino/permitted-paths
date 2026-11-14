// The errors that the application expects, and the one table that gives each a status code.
// A handler does not select a status code. It throws an AppError and this table decides.
import type { ErrorCode, Problem } from '../shared/contracts.ts';

export const STATUS_OF: Record<ErrorCode, number> = {
  BAD_REQUEST: 400, // not JSON, too large, wrong content type
  SHAPE: 400, // the request does not obey the contract (rules R1 to R4)
  RULE: 422, // the shape is correct, but the request is not sensible against the current facts
  NEEDS_CONFIRMATION: 409, // rule R7: a similar expense exists; the person must confirm
  KEY_CONFLICT: 409, // rule R8: the same request key with a different body
  NOT_FOUND: 404,
  STORAGE_UNAVAILABLE: 503, // the store did not answer; the client can try again with the same key
  VERIFICATION_FAILED: 500, // level 2: the expense is saved, but the independent check of the ledger gave FAIL
  INTERNAL: 500, // a defect of the program; the response gives no detail
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly problems: Problem[];
  /** Level 2: the run of the execution graph that ended with this error. */
  readonly run_id: string | undefined;
  constructor(code: ErrorCode, problems: Problem[] = [], run_id?: string) {
    super(code + (problems.length ? ': ' + problems.map((p) => p.rule).join(', ') : ''));
    this.code = code;
    this.problems = problems;
    this.run_id = run_id;
  }
}

/** A repository throws this when the store cannot do the operation now. */
export class StorageUnavailable extends Error {
  readonly detail: string;
  readonly run_id: string | undefined;
  constructor(detail: string, run_id?: string) {
    super('The store is not available.');
    this.detail = detail;
    this.run_id = run_id;
  }
}

/** A repository throws this when an insert has a request key that is already in the store. */
export class DuplicateKey extends Error {
  constructor() {
    super('The request key is already in the store.');
  }
}
