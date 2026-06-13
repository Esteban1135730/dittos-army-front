export function formatHomologDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatHomologDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function formatEur(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `€${value.toFixed(2)}`;
}

export { formatFx, formatCopRateFx, fxSymbol } from '../../utils/purchase-currency';
export type { CardsCostCurrency } from '../../utils/purchase-currency';

export function formatCop(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `COP ${Math.round(value).toLocaleString('es-CO')}`;
}

export function formatCopRate(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${Math.round(value).toLocaleString('es-CO')} COP/EUR`;
}

export function computeCopFromEur(
  eur: number | null | undefined,
  rate: number | null | undefined,
): number | null {
  if (eur == null || rate == null || eur <= 0 || rate <= 0) return null;
  return eur * rate;
}
