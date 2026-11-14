// Level 4. The review of an import. The application proposes; the person decides each line;
// only "Record the selected lines" records. A category from the memory is selected already,
// because the person selected it before. A category from the model is only a button.
import { useState } from 'react';
import type { Category } from '../../shared/contracts.ts';
import type { ImportProposal, ImportResult } from '../../shared/contracts.import.ts';
import { formatMoney } from '../../shared/money.ts';
import { postDecisions, postImport } from './api.ts';

type Props = { categories: Category[]; onRecorded: () => void };

export function ImportReview({ categories, onRecorded }: Props) {
  const [csv, setCsv] = useState('');
  const [proposal, setProposal] = useState<ImportProposal | null>(null);
  const [chosen, setChosen] = useState<Record<number, string>>({});
  const [result, setResult] = useState<ImportResult | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function read() {
    setBusy(true);
    setResult(null);
    const answer = await postImport(csv);
    setBusy(false);
    if (!answer.ok) return setMessage(answer.problems.map((p) => p.text).join(' '));
    setMessage('');
    setProposal(answer.value);
    // Only what the person decided before is selected at the start.
    setChosen(Object.fromEntries(answer.value.lines.filter((l) => l.suggestion?.source === 'memory').map((l) => [l.line_no, l.suggestion!.category_id])));
  }

  async function record() {
    if (!proposal) return;
    setBusy(true);
    const answer = await postDecisions(proposal.batch_id, proposal.lines.map((l) => ({ line_no: l.line_no, category_id: chosen[l.line_no] || null })));
    setBusy(false);
    if (!answer.ok) return setMessage(answer.problems.map((p) => p.text).join(' '));
    setResult(answer.value);
    setProposal(null);
    onRecorded();
  }

  const selected = proposal ? proposal.lines.filter((l) => chosen[l.line_no]).length : 0;

  return (
    <section className="card import">
      <h2>Import a statement</h2>
      {!proposal && (
        <>
          <label>
            Paste the lines of a CSV file: Date,Description,Amount
            <textarea rows={5} value={csv} onChange={(e) => setCsv(e.target.value)} placeholder={'Date,Description,Amount\n2026-03-02,Woolworths,-642.35'} />
          </label>
          <button type="button" disabled={busy || csv.trim() === ''} onClick={() => void read()}>
            {busy ? 'Reading…' : 'Read the statement'}
          </button>
        </>
      )}
      {message && <p className="problems" role="alert">{message}</p>}

      {proposal && (
        <>
          <p className="muted">
            {proposal.lines.length} lines. Model calls: {proposal.budget.model_calls_made} of {proposal.budget.model_calls_allowed} allowed for {proposal.budget.unknown_merchants} merchants that the memory does not know. Nothing is recorded yet.
          </p>
          <ul className="lines">
            {proposal.lines.map((line) => (
              <li key={line.line_no} className={line.problem ? 'bad' : undefined}>
                <div className="row">
                  <span>{line.problem ? line.raw : line.occurred_on + ' · ' + line.merchant_name}</span>
                  {line.amount_cents !== null && <span className="num">{formatMoney(line.amount_cents)}</span>}
                </div>
                {line.problem ? (
                  <span className="state over">{line.problem.text}</span>
                ) : (
                  <div className="row pick">
                    <select aria-label={'Category of line ' + line.line_no} value={chosen[line.line_no] ?? ''} onChange={(e) => setChosen({ ...chosen, [line.line_no]: e.target.value })}>
                      <option value="">Do not record</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    {line.suggestion?.source === 'model' && chosen[line.line_no] !== line.suggestion.category_id && (
                      <button type="button" className="secondary small" onClick={() => setChosen({ ...chosen, [line.line_no]: line.suggestion!.category_id })}>
                        Use {line.suggestion.category_name}
                      </button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
          <button type="button" disabled={busy || selected === 0} onClick={() => void record()}>
            {busy ? 'Recording…' : 'Record the ' + selected + ' selected lines'}
          </button>
        </>
      )}

      {result && (
        <div aria-live="polite">
          <p className={result.reconciliation.ok ? 'ok' : 'problems'}>
            Recorded {result.counts.RECORDED}. Already imported {result.counts.DUPLICATE}. Rejected {result.counts.REJECTED}. Waiting {result.counts.WAITING}.{' '}
            {result.reconciliation.ok ? 'Each line has one end, and the ledger agrees.' : 'The check of the import found a problem: ' + result.reconciliation.problems.map((p) => p.text).join(' ')}
          </p>
          <ul className="recent">
            {result.outcomes.filter((o) => o.end !== 'RECORDED').map((o) => (
              <li key={o.line_no}>
                Line {o.line_no}: <strong>{o.end}</strong>. {o.detail}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
