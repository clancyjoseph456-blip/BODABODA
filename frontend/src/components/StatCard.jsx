import { formatMoney, formatProfit } from '../services/format';

/** Headline number tile. `tone` colours the value for profit/loss at a glance. */
export function StatCard({ label, value, sub, tone = 'default', prefix }) {
  const toneClass = {
    positive: 'text-success',
    negative: 'text-danger',
    default: ''
  }[tone];

  return (
    <div className="card stat-card h-100 shadow-sm">
      <div className="card-body">
        <p className="stat-label text-muted mb-1">{label}</p>
        <p className={`stat-value mb-1 ${toneClass}`}>
          {prefix}
          {value}
        </p>
        {sub ? <p className="stat-sub text-muted mb-0">{sub}</p> : null}
      </div>
    </div>
  );
}

/** Profit tile that always shows the sign, coloured red when the fleet loses money. */
export function ProfitStat({ label, value, sub }) {
  const amount = Number(value) || 0;
  return (
    <StatCard
      label={label}
      value={formatProfit(amount)}
      sub={sub}
      tone={amount >= 0 ? 'positive' : 'negative'}
    />
  );
}

export function MoneyStat({ label, value, sub }) {
  return <StatCard label={label} value={formatMoney(value)} sub={sub} />;
}

/** Consistent empty state so tables never look broken. */
export function EmptyState({ title, children, action }) {
  return (
    <div className="text-center py-5">
      <p className="fw-semibold mb-1">{title}</p>
      {children ? <p className="text-muted small mb-3">{children}</p> : null}
      {action}
    </div>
  );
}

/** Inline error banner used instead of a browser alert. */
export function ErrorAlert({ message, onDismiss }) {
  if (!message) return null;
  return (
    <div className="alert alert-danger d-flex justify-content-between align-items-start" role="alert">
      <span>{message}</span>
      {onDismiss ? (
        <button type="button" className="btn-close" aria-label="Dismiss" onClick={onDismiss} />
      ) : null}
    </div>
  );
}

/** Small spinner block used while a panel loads. */
export function Loading({ label = 'Loading…' }) {
  return (
    <div className="text-center py-5">
      <div className="spinner-border text-primary" role="status" />
      <p className="text-muted small mt-3 mb-0">{label}</p>
    </div>
  );
}
