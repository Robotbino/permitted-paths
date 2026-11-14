// Level 3. The store of the assist path: the audit records and the proposals that wait for the person.
// The port, the implementation in memory (tests) and the implementation in SQLite (migration 007).
// The same contract suite (assist-contract.test.ts) runs on the two implementations.
// The store has no method that changes an audit record, and a proposal is decided one time.
import type { DatabaseSync } from 'node:sqlite';
import type { AssistAudit, AssistDecision, AssistProposal } from '../../shared/contracts.assist.ts';
import { DuplicateKey, StorageUnavailable, StoreRejected } from '../errors.ts';

export interface AssistStore {
  /** Adds one audit record. Throws DuplicateKey if the request id is already in the store. */
  addAudit(record: AssistAudit): void;
  /** All records, the oldest first. */
  listAudit(): AssistAudit[];
  /** The number of records of one UTC day ("2026-03-14") that have a model call. The cost control reads it. */
  countModelCalls(utcDay: string): number;
  /** Adds one proposal. Throws DuplicateKey if the id is already in the store. */
  insertProposal(proposal: AssistProposal): void;
  getProposal(id: string): AssistProposal | null;
  /** All proposals, the oldest first. */
  listProposals(): AssistProposal[];
  /** PENDING becomes the status of the outcome, one time. false: the proposal is absent or was decided before; nothing changes. */
  decideProposal(id: string, outcome: AssistDecision): boolean;
}

export function memoryAssistStore(): AssistStore {
  const audit: AssistAudit[] = [];
  const proposals = new Map<string, AssistProposal>();
  return {
    addAudit(record) {
      if (audit.some((a) => a.request_id === record.request_id)) throw new DuplicateKey();
      audit.push({ ...record });
    },
    listAudit: () => [...audit].sort((a, b) => a.at.localeCompare(b.at) || a.request_id.localeCompare(b.request_id)).map((a) => ({ ...a })),
    countModelCalls: (utcDay) => audit.filter((a) => a.model !== null && a.at.startsWith(utcDay)).length,
    insertProposal(proposal) {
      if (proposals.has(proposal.id)) throw new DuplicateKey();
      proposals.set(proposal.id, structuredClone(proposal));
    },
    getProposal(id) {
      const proposal = proposals.get(id);
      return proposal ? structuredClone(proposal) : null;
    },
    listProposals: () => [...proposals.values()].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)).map((p) => structuredClone(p)),
    decideProposal(id, outcome) {
      const proposal = proposals.get(id);
      if (!proposal || proposal.status !== 'PENDING') return false;
      proposals.set(id, { ...proposal, status: outcome.status, outcome: structuredClone(outcome) });
      return true;
    },
  };
}

type ProposalRow = Omit<AssistProposal, 'input' | 'consequences' | 'outcome'> & { input: string; consequences: string | null; outcome: string | null };

const AUDIT_COLUMNS = 'request_id, at, capability, status, reason, input_summary, model';
const PROPOSAL_COLUMNS = 'id, request_id, capability, input, consequences, description, created_at, status, outcome';

/** Runs one database operation. A failure becomes an error of the application, as in sqlite.ts. */
function guard<T>(operation: () => T): T {
  try {
    return operation();
  } catch (error) {
    const text = error instanceof Error ? error.message : String(error);
    if (/UNIQUE constraint failed: (assist_audit\.request_id|assist_proposals\.id)/.test(text)) throw new DuplicateKey();
    if (/constraint failed|datatype mismatch|cannot store/i.test(text)) throw new StoreRejected(text);
    throw new StorageUnavailable(text);
  }
}

const toProposal = (row: ProposalRow): AssistProposal => ({
  ...row,
  input: JSON.parse(row.input) as object,
  consequences: row.consequences === null ? null : (JSON.parse(row.consequences) as object),
  outcome: row.outcome === null ? null : (JSON.parse(row.outcome) as AssistDecision),
});

export function sqliteAssistStore(db: DatabaseSync): AssistStore {
  return {
    addAudit: (a) =>
      guard(() => void db.prepare('INSERT INTO assist_audit (' + AUDIT_COLUMNS + ') VALUES (?, ?, ?, ?, ?, ?, ?)').run(a.request_id, a.at, a.capability, a.status, a.reason, a.input_summary, a.model)),
    listAudit: () => guard(() => db.prepare('SELECT ' + AUDIT_COLUMNS + ' FROM assist_audit ORDER BY at, request_id').all().map((row) => ({ ...row }) as AssistAudit)),
    countModelCalls: (utcDay) =>
      guard(() => Number(db.prepare("SELECT COUNT(*) AS n FROM assist_audit WHERE model IS NOT NULL AND at LIKE ? || '%'").get(utcDay)!.n)),
    insertProposal: (p) =>
      guard(() => void db.prepare('INSERT INTO assist_proposals (' + PROPOSAL_COLUMNS + ') VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
        p.id, p.request_id, p.capability, JSON.stringify(p.input), p.consequences === null ? null : JSON.stringify(p.consequences), p.description, p.created_at,
        p.status, p.outcome === null ? null : JSON.stringify(p.outcome),
      )),
    getProposal: (id) =>
      guard(() => {
        const row = db.prepare('SELECT ' + PROPOSAL_COLUMNS + ' FROM assist_proposals WHERE id = ?').get(id);
        return row ? toProposal({ ...row } as ProposalRow) : null;
      }),
    listProposals: () => guard(() => db.prepare('SELECT ' + PROPOSAL_COLUMNS + ' FROM assist_proposals ORDER BY created_at, id').all().map((row) => toProposal({ ...row } as ProposalRow))),
    // One statement: two requests that arrive together cannot both decide the proposal.
    decideProposal: (id, outcome) =>
      guard(() => Number(db.prepare("UPDATE assist_proposals SET status = ?, outcome = ? WHERE id = ? AND status = 'PENDING'").run(outcome.status, JSON.stringify(outcome), id).changes) === 1),
  };
}
