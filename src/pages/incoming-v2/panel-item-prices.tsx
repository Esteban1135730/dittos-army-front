import { Box, Typography } from '@mui/material';
import type { CardsCostCurrency } from '../../utils/purchase-currency';
import { formatCop, formatFx } from './homolog-format';

/** Precios del registro panel (IncomingBatchItem) — sin datos CardTrader. */
export function PanelItemPrices(props: {
  unitCostCop: number;
  eurUnitPrice: number;
  eurTotalLot: number;
  currency?: CardsCostCurrency;
  size?: 'sm' | 'md';
  align?: 'left' | 'right';
}) {
  const {
    unitCostCop,
    eurUnitPrice,
    eurTotalLot,
    currency = 'EUR',
    size = 'sm',
    align = 'right',
  } = props;
  const copVariant = size === 'md' ? 'subtitle1' : 'body2';

  return (
    <Box sx={{ textAlign: align, minWidth: size === 'sm' ? 100 : 120 }}>
      <Typography variant={copVariant} fontWeight={700} color="success.dark" lineHeight={1.2}>
        {formatCop(unitCostCop)}
      </Typography>
      <Typography variant="caption" color="text.secondary" display="block">
        COP / ud
      </Typography>
      <Typography variant="caption" color="text.secondary" display="block" mt={0.25}>
        {formatFx(eurUnitPrice, currency)} / ud
      </Typography>
      <Typography variant="caption" color="text.secondary" display="block">
        {formatFx(eurTotalLot, currency)} lote
      </Typography>
    </Box>
  );
}

export function PanelItemPriceChip(props: {
  unitCostCop: number;
  eurUnitPrice: number;
  eurTotalLot: number;
  currency?: CardsCostCurrency;
}) {
  const { unitCostCop, eurUnitPrice, eurTotalLot, currency = 'EUR' } = props;
  return (
    <Box
      sx={{
        px: 1,
        py: 0.5,
        borderRadius: 1,
        bgcolor: '#e8f5e9',
        border: '1px solid #a5d6a7',
        display: 'inline-block',
        textAlign: 'right',
      }}
    >
      <Typography variant="caption" fontWeight={700} color="success.dark" display="block">
        {formatCop(unitCostCop)}
      </Typography>
      <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: 10 }}>
        {formatFx(eurUnitPrice, currency)}/ud · {formatFx(eurTotalLot, currency)} lote
      </Typography>
    </Box>
  );
}
