// Level 3. The review of an import. The application proposes; the person decides each line;
// only "Record the selected lines" records. A category from the memory is selected already,
// because the person selected it before. A category from the model is only a button.
// A row that is not 'new' (a duplicate, a transfer, a pending row, a reversal, a problem) shows its
// note and has no category: the pipeline already decided that it does not go to the ledger.
import { useState } from 'react';
import type { Category } from '../../shared/contracts.ts';
import type { ImportLine, ImportProposal, ImportResult, MappingNeeded } from '../../shared/contracts.import.ts';
import { EXPORT_PROFILES } from '../../shared/export/paste-rows.ts';
import { formatMoney } from '../../shared/money.ts';
import { HARBOUR_ACCOUNT, NORTHBANK_ACCOUNT } from '../../shared/pipeline/samples.ts';
import { postDecisions, postImport, postMapping, type ApiResult } from './api.ts';
import { ImportOutcome, MappingForm } from './ImportOutcome.tsx';

type Props = { categories: Category[]; onRecorded: () => void };

const ACCOUNTS = [NORTHBANK_ACCOUNT, HARBOUR_ACCOUNT];
const needsCategory = (line: ImportLine) => line.status === 'new' && line.direction === 'out';

export function ImportReview({ categories, onRecorded }: Props) {
  const [csv, setCsv] = useState('');
  const [account, setAccount] = useState(NORTHBANK_ACCOUNT);
  const [exportProfile, setExportProfile] = useState(EXPORT_PROFILES[0]!.id);
  const [needed, setNeeded] = useState<MappingNeeded | null>(null);
  const [proposal, setProposal] = useState<ImportProposal | null>(null);
  const [chosen, setChosen] = useState<Record<number, string>>({});
  const [result, setResult] = useState<ImportResult | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  /** The answer of step 1 or of the mapping step: a proposal, or "a mapping is necessary". */
  function show(answer: ApiResult<ImportProposal | MappingNeeded>) {
    setBusy(false);
    if (!answer.ok) return setMessage(answer.problems.map((p) => p.text).join(' '));
    setMessage('');
    if (answer.value.step === 'mapping') return setNeeded(answer.value);
    setNeeded(null);
    setProposal(answer.value);
    // Only what the person decided before is selected at the start.
    setChosen(Object.fromEntries(answer.value.lines.filter((l) => l.suggestion?.source === 'memory').map((l) => [l.line_no, l.suggestion!.category_id])));
  }

  async function read() {
    setBusy(true);
    setResult(null);
    show(await postImport(csv, account));
  }

  async function map(mapping: unknown) {
    if (!needed) return;
    setBusy(true);
    show(await postMapping(needed.batch_id, mapping));
  }

  async function record() {
    if (!proposal) return;
    setBusy(true);
    const answer = await postDecisions(proposal.batch_id, proposal.lines.map((l) => ({ line_no: l.line_no, category_id: (needsCategory(l) && chosen[l.line_no]) || null })), exportProfile);
    setBusy(false);
    if (!answer.ok) return setMessage(answer.problems.map((p) => p.text).join(' '));
    setResult(answer.value);
    setProposal(null);
    onRecorded();
  }

  const selected = proposal ? proposal.lines.filter((l) => needsCategory(l) && chosen[l.line_no]).length : 0;
  const incomeRows = proposal ? proposal.lines.filter((l) => l.status === 'new' && l.direction === 'in').length : 0;

  return (
    <section className="card import">
      <h2>Import a statement</h2>
      {!proposal && !needed && (
        <>
          <label>
            The account of the file
            <select value={account} onChange={(e) => setAccount(e.target.value)}>
              {ACCOUNTS.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </label>
          <label>
            Paste the text of a CSV file that the bank made
            <textarea rows={5} value={csv} onChange={(e) => setCsv(e.target.value)} placeholder={'Posting Date;Details;Debit;Credit;Balance\n01/03/2026;CARD PURCHASE GREENLEAF MARKET CARD 4821;842,35;;19 357,65'} />
          </label>
          <button type="button" disabled={busy || csv.trim() === ''} onClick={() => void read()}>
            {busy ? 'Reading…' : 'Read the statement'}
          </button>
        </>
      )}
      {message && <p className="problems" role="alert">{message}</p>}
      {needed && <MappingForm needed={needed} busy={busy} onMapping={(mapping) => void map(mapping)} />}

      {proposal && (
        <>
          <p className="muted">
            {proposal.lines.length} lines for {proposal.account}, read with the mapping "{proposal.profile.id}". Model calls: {proposal.budget.model_calls_made} of {proposal.budget.model_calls_allowed} allowed for {proposal.budget.unknown_merchants} merchants that the memory does not know. Nothing is recorded yet.
          </p>
          {proposal.problems.length > 0 && <p className="problems">{proposal.problems.map((p) => p.text).join(' ')}</p>}
          <ul className="lines">
            {proposal.lines.map((line) => (
              <li key={line.line_no} className={line.status === 'new' ? undefined : 'bad'}>
                <div className="row">
                  <span>{line.occurred_on === null ? line.raw : line.occurred_on + ' · ' + line.description_clean}</span>
                  {line.amount_cents !== null && <span className="num">{(line.direction === 'in' ? '+' : '') + formatMoney(line.amount_cents)}</span>}
                </div>
                {line.status !== 'new' ? (
                  <span className={'state' + (line.status === 'problem' ? ' over' : '')}>{line.status}: {line.status === 'problem' ? line.problems.map((p) => p.text).join(' ') : line.note}</span>
                ) : line.direction === 'in' ? (
                  <span className="state">Money in. It is recorded as income.</span>
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
          <label>
            The template of the budget sheet, for the export text
            <select value={exportProfile} onChange={(e) => setExportProfile(e.target.value)}>
              {EXPORT_PROFILES.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </label>
          <button type="button" disabled={busy || selected + incomeRows === 0} onClick={() => void record()}>
            {busy ? 'Recording…' : 'Record ' + selected + ' expenses and ' + incomeRows + ' income rows'}
          </button>
        </>
      )}

      {result && <ImportOutcome result={result} />}
    </section>
  );
}
