import { Box, Typography } from '@mui/material';
import type { CardsCostCurrency } from '../../utils/purchase-currency';
import { formatCop, formatFx } from './homolog-format';

type HomologPriceBlockProps = {
  cop?: number | null | undefined;
  fx?: number | null;
  /** @deprecated use fx */
  eur?: number | null;
  currency?: CardsCostCurrency;
  copLabel?: string;
  fxLabel?: string;
  size?: 'sm' | 'md' | 'lg';
};

const SIZE = {
  sm: { primary: 'body2', secondary: 'caption' },
  md: { primary: 'subtitle1', secondary: 'caption' },
  lg: { primary: 'h6', secondary: 'body2' },
} as const;

/** Precio: COP si está guardado; si no, solo el valor FX tal cual (sin conversiones). */
export function HomologPriceBlock(props: HomologPriceBlockProps) {
  const {
    cop,
    fx,
    eur,
    currency = 'EUR',
    copLabel = 'Compra',
    fxLabel,
    size = 'sm',
  } = props;
  const s = SIZE[size];
  const fxAmount = fx ?? eur;
  const hasCop = cop != null && Number.isFinite(cop) && cop > 0;
  const hasFx = fxAmount != null && Number.isFinite(fxAmount) && fxAmount > 0;

  if (hasCop) {
    return (
      <Box>
        <Typography
          variant={s.primary}
          fontWeight={700}
          color="success.dark"
          lineHeight={1.2}
        >
          {formatCop(cop)}
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block">
          {copLabel}
        </Typography>
        {hasFx ? (
          <Typography variant={s.secondary} color="text.secondary" display="block" mt={0.25}>
            {fxLabel ? `${fxLabel}: ` : ''}
            {formatFx(fxAmount, currency)}
          </Typography>
        ) : null}
      </Box>
    );
  }

  if (hasFx) {
    return (
      <Box>
        <Typography
          variant={s.primary}
          fontWeight={700}
          color="text.primary"
          lineHeight={1.2}
        >
          {formatFx(fxAmount, currency)}
        </Typography>
        {fxLabel ? (
          <Typography variant="caption" color="text.secondary" display="block">
            {fxLabel}
          </Typography>
        ) : null}
      </Box>
    );
  }

  return (
    <Typography variant={s.primary} color="text.secondary">
      —
    </Typography>
  );
}

export function HomologPriceChip(props: {
  cop?: number | null | undefined;
  fx?: number | null;
  /** @deprecated use fx */
  eur?: number | null;
  currency?: CardsCostCurrency;
}) {
  const { cop, fx, eur, currency = 'EUR' } = props;
  const fxAmount = fx ?? eur;
  const hasCop = cop != null && Number.isFinite(cop) && cop > 0;
  const hasFx = fxAmount != null && Number.isFinite(fxAmount) && fxAmount > 0;

  if (!hasCop && !hasFx) return null;

  return (
    <Box
      sx={{
        px: 1,
        py: 0.5,
        borderRadius: 1,
        bgcolor: hasCop ? '#e8f5e9' : '#f5f5f5',
        border: `1px solid ${hasCop ? '#a5d6a7' : '#e0e0e0'}`,
        display: 'inline-block',
        textAlign: 'right',
      }}
    >
      {hasCop ? (
        <Typography variant="caption" fontWeight={700} color="success.dark" display="block">
          {formatCop(cop)}
        </Typography>
      ) : null}
      {hasFx ? (
        <Typography
          variant="caption"
          fontWeight={hasCop ? 400 : 700}
          color={hasCop ? 'text.secondary' : 'text.primary'}
          display="block"
        >
          {formatFx(fxAmount, currency)}
        </Typography>
      ) : null}
    </Box>
  );
}
