export function money(value, compact = false) {
  const amount = Number(value) || 0;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: compact ? 'compact' : 'standard', minimumFractionDigits: compact || Number.isInteger(amount) ? 0 : 2, maximumFractionDigits: compact ? 1 : 2 }).format(amount);
}
export function percent(value) { return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(Number(value) || 0)}%`; }
export function date(value) { return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value)); }
