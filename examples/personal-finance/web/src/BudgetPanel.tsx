// The month: the budget of each category and the last expenses. It only shows data from the server.
import type { BudgetStatus, MonthSummary } from '../../shared/contracts.ts';
import { formatMoney } from '../../shared/money.ts';

const STATE_TEXT: Record<BudgetStatus['state'], string> = { NO_BUDGET: 'No budget', WITHIN: 'Within budget', NEAR: 'Near the limit', OVER: 'Over budget' };

function Bar({ budget }: { budget: BudgetStatus }) {
  if (budget.limit_cents === null) return null;
  const percent = Math.min(100, Math.round((budget.spent_cents * 100) / budget.limit_cents));
  return (
    <div className="bar" role="img" aria-label={percent + '% of the budget is used'}>
      <div className={'fill ' + budget.state.toLowerCase()} style={{ width: percent + '%' }} />
    </div>
  );
}

export function BudgetPanel({ summary, highlight }: { summary: MonthSummary | null; highlight: string | null }) {
  if (!summary) return <section className="card">Loading the month…</section>;
  return (
    <section className="card">
      <h2>
        {summary.period} <span className="muted">spent {formatMoney(summary.total_spent_cents)}</span>
      </h2>
      <ul className="budgets">
        {summary.categories.map(({ category, budget }) => (
          <li key={category.id} className={category.id === highlight ? 'changed' : undefined}>
            <div className="row">
              <span>{category.name}</span>
              <span className="num">
                {formatMoney(budget.spent_cents)}
                {budget.limit_cents !== null && ' of ' + formatMoney(budget.limit_cents)}
              </span>
            </div>
            <Bar budget={budget} />
            <span className={'state ' + budget.state.toLowerCase()}>{STATE_TEXT[budget.state]}</span>
          </li>
        ))}
      </ul>
      <h3>Last expenses</h3>
      <ul className="recent">
        {summary.recent.length === 0 && <li className="muted">No expense in this month.</li>}
        {summary.recent.map((e) => (
          <li key={e.id} className="row">
            <span>
              {e.occurred_on} · {e.merchant_name}
            </span>
            <span className="num">{formatMoney(e.amount_cents)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
