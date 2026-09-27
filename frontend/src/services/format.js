/** Shared formatting helpers so currency and dates look identical everywhere. */

const KES = new Intl.NumberFormat('en-KE', {
  style: 'currency',
  currency: 'KES',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const NUM = new Intl.NumberFormat('en-KE', { maximumFractionDigits: 1 });

/** 2450 -> "KSh 2,450.00" */
export function formatMoney(value) {
  const amount = Number(value);
  return KES.format(Number.isFinite(amount) ? amount : 0);
}

/** 1234.5 -> "1,234.5" */
export function formatNumber(value) {
  const amount = Number(value);
  return NUM.format(Number.isFinite(amount) ? amount : 0);
}

/** "2026-03-04T10:00:00Z" -> "4 Mar 2026" */
export function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** "2026-03-04T10:00:00Z" -> "4 Mar 2026, 10:00" */
export function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return `${formatDate(value)}, ${date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit'
  })}`;
}

/** Profit is the headline number, so sign is never hidden. */
export function formatProfit(value) {
  const amount = Number(value) || 0;
  return `${amount < 0 ? '-' : ''}${KES.format(Math.abs(amount))}`;
}

export function seasonTone(seasonKey) {
  return { dry: 'success', rainy: 'info', holiday: 'warning' }[seasonKey] || 'secondary';
}

export function roleLabel(role) {
  return { admin: 'Fleet Admin', owner: 'Fleet Owner', rider: 'Rider' }[role] || role;
}
