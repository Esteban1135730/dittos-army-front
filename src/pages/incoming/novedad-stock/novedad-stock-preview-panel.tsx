import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { formatCop, formatFx } from '../../incoming-v2/homolog-format';
import { HomologCardImage } from '../../incoming-v2/homolog-card-image';
import { normalizeCardsCostCurrency } from '../../../utils/purchase-currency';
import type { NovedadStockPreviewItem, NovedadStockPreviewResponse } from './use-novedad-stock';

type NovedadStockPreviewPanelProps = {
  preview: NovedadStockPreviewResponse | undefined;
  isLoading: boolean;
  isError: boolean;
  onConfirm: () => void;
  confirming: boolean;
  canConfirm: boolean;
};

function PreviewRow({ item }: { item: NovedadStockPreviewItem }) {
  const hasError = item.errors.length > 0;
  const currency = normalizeCardsCostCurrency(item.price_currency);

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.25,
        display: 'flex',
        gap: 1.25,
        alignItems: 'flex-start',
        borderColor: hasError ? '#d32f2f' : '#e0e0e0',
        bgcolor: hasError ? '#ffebee' : '#fff',
      }}
    >
      <HomologCardImage src={item.image_url} alt={item.card_name} variant="list" />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          variant="subtitle2"
          fontWeight={700}
          color={hasError ? 'error.dark' : 'text.primary'}
        >
          {item.card_name}
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block">
          {item.language.toUpperCase()} · ×{item.quantity}
          {item.expansion ? ` · ${item.expansion}` : ''}
        </Typography>
        {item.card_id ? (
          <Typography variant="caption" color="text.secondary" display="block">
            {item.card_id}
          </Typography>
        ) : null}
        {hasError ? (
          <Stack spacing={0.25} mt={0.75}>
            {item.errors.map((err) => (
              <Typography key={err} variant="caption" color="error" fontWeight={600}>
                {err}
              </Typography>
            ))}
          </Stack>
        ) : null}
      </Box>
      <Box textAlign="right" sx={{ minWidth: 96 }}>
        <Typography
          variant="subtitle2"
          fontWeight={700}
          color={hasError ? 'error.dark' : 'success.dark'}
        >
          {formatCop(item.unit_cost_cop)}
        </Typography>
        {item.purchase_price_fx != null ? (
          <Typography variant="caption" color="text.secondary" display="block">
            {formatFx(item.purchase_price_fx, currency)}
          </Typography>
        ) : null}
      </Box>
    </Paper>
  );
}

export function NovedadStockPreviewPanel({
  preview,
  isLoading,
  isError,
  onConfirm,
  confirming,
  canConfirm,
}: NovedadStockPreviewPanelProps) {
  if (isLoading) {
    return (
      <Paper variant="outlined" sx={{ p: 3, mb: 2, textAlign: 'center' }}>
        <CircularProgress size={28} />
        <Typography variant="body2" color="text.secondary" mt={1}>
          Calculando previsualización…
        </Typography>
      </Paper>
    );
  }

  if (isError) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        No se pudo cargar la previsualización.
      </Alert>
    );
  }

  if (!preview || preview.items.length === 0) {
    return null;
  }

  const { summary } = preview;

  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 2, bgcolor: '#fafafa' }}>
      <Typography variant="subtitle1" fontWeight={700} gutterBottom>
        Previsualización antes de crear stock
      </Typography>

      <Stack direction="row" spacing={1} flexWrap="wrap" mb={2}>
        <Chip label={`${summary.total_cards} cartas`} color="primary" size="small" />
        <Chip
          label={formatCop(summary.total_cop)}
          color="success"
          size="small"
          variant="outlined"
        />
        <Chip
          label={`${summary.ok_count} OK`}
          color="success"
          size="small"
        />
        {summary.error_count > 0 ? (
          <Chip
            label={`${summary.error_count} con aviso`}
            color="error"
            size="small"
          />
        ) : null}
      </Stack>

      <Stack spacing={1} sx={{ maxHeight: 360, overflow: 'auto', mb: 2 }}>
        {preview.items.map((item) => (
          <PreviewRow key={item.tracking_id} item={item} />
        ))}
      </Stack>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems="center">
        <Button
          variant="contained"
          color="warning"
          onClick={onConfirm}
          disabled={!canConfirm || confirming}
        >
          {confirming ? 'Creando stock…' : 'Confirmar y crear en stock'}
        </Button>
        {summary.error_count > 0 ? (
          <Typography variant="caption" color="error">
            Las filas en rojo tienen avisos; puedes corregir TRM o datos antes de confirmar.
          </Typography>
        ) : null}
      </Stack>
    </Paper>
  );
}
