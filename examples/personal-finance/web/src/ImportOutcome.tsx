// Level 3. Two small parts of the import card.
// ImportOutcome: the end of each line, the result of the independent check, and the export text.
// The export text is in two read-only text areas. The person copies it into a budget sheet;
// the application does not open or write a sheet.
// MappingForm: the answer "a mapping is necessary", and a text area where the person gives the mapping.
import { useState } from 'react';
import type { ImportResult, MappingNeeded } from '../../shared/contracts.import.ts';

function CopyArea({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false); // the browser did not permit it: the person can select the text
    }
  }
  return (
    <div>
      <label>
        {label}
        <textarea readOnly rows={Math.min(8, Math.max(2, text.split('\n').length))} value={text} />
      </label>
      <button type="button" className="secondary small" disabled={text === ''} onClick={() => void copy()}>
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

export function ImportOutcome({ result }: { result: ImportResult }) {
  const { counts, reconciliation } = result;
  return (
    <div aria-live="polite">
      <p className={reconciliation.ok ? 'ok' : 'problems'}>
        Recorded {counts.RECORDED}. Already in the ledger {counts.DUPLICATE}. Rejected {counts.REJECTED}. Waiting {counts.WAITING}. Paired {counts.PAIRED}.{' '}
        {reconciliation.ok ? 'Each line has one end, and the ledger agrees.' : 'The check of the import found a problem: ' + reconciliation.problems.map((p) => p.text).join(' ')}
      </p>
      <ul className="recent">
        {result.outcomes.filter((o) => o.end !== 'RECORDED').map((o) => (
          <li key={o.line_no}>
            Line {o.line_no}: <strong>{o.end}</strong>. {o.detail}
          </li>
        ))}
      </ul>
      <h3>Text for the budget sheet ({result.export_profile})</h3>
      <CopyArea label="Expenses rows" text={result.expenses_tsv} />
      <CopyArea label="Income rows" text={result.income_tsv} />
      <ul className="recent">
        {result.notes.map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>
    </div>
  );
}

type MappingProps = { needed: MappingNeeded; busy: boolean; onMapping: (mapping: unknown) => void };

export function MappingForm({ needed, busy, onMapping }: MappingProps) {
  const [text, setText] = useState('');
  const [message, setMessage] = useState('');
  function send() {
    try {
      setMessage('');
      onMapping(JSON.parse(text));
    } catch {
      setMessage('The mapping must be JSON text.');
    }
  }
  return (
    <>
      <p className="muted">
        The application does not know the layout of this file. Columns: {needed.header.join(', ')}. First row: {(needed.rows[0] ?? []).join(' | ')}. Nothing is recorded.
      </p>
      {needed.problems.length > 0 && <p className="problems">{needed.problems.map((p) => p.text).join(' ')}</p>}
      <ul className="recent">
        {needed.fields.map((f) => (
          <li key={f.field}>
            <strong>{f.field}</strong>{f.required ? ' (necessary)' : ''}: {f.text}
          </li>
        ))}
      </ul>
      <label>
        The mapping, as JSON
        <textarea rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder={'{ "id": "my-bank", "name": "My bank", "columns": { "date": "When", "description": "What", "debit": "Money out", "credit": "Money in" }, "date_format": "MM/DD/YYYY", "decimal": "." }'} />
      </label>
      {message && <p className="problems" role="alert">{message}</p>}
      <button type="button" disabled={busy || text.trim() === ''} onClick={send}>
        {busy ? 'Reading…' : 'Use this mapping'}
      </button>
    </>
  );
}
