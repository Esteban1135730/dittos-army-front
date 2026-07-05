import { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Tab,
  Tabs,
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

type PreviewFilter = 'all' | 'no_tcgdex_image' | 'warnings';

function TcgdexPreviewImage({
  tcgdxImageUrl,
  cardName,
  hasTcgdexImage,
}: {
  tcgdxImageUrl: string;
  cardName: string;
  hasTcgdexImage: boolean;
}) {
  return (
    <Box sx={{ position: 'relative', flexShrink: 0 }}>
      <HomologCardImage
        src={hasTcgdexImage ? tcgdxImageUrl : undefined}
        alt={cardName}
        variant="candidate"
        width={72}
        height={100}
      />
      {!hasTcgdexImage ? (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'rgba(255, 243, 224, 0.92)',
            borderRadius: 1,
            border: '2px dashed',
            borderColor: 'warning.main',
            px: 0.5,
          }}
        >
          <Typography
            variant="caption"
            color="warning.dark"
            fontWeight={700}
            sx={{ fontSize: 9, textAlign: 'center', lineHeight: 1.2 }}
          >
            Sin imagen TCGdex
          </Typography>
        </Box>
      ) : null}
    </Box>
  );
}

function PreviewRow({ item }: { item: NovedadStockPreviewItem }) {
  const hasError = item.errors.length > 0;
  const missingTcgdexImage = !item.has_tcgdex_image;
  const currency = normalizeCardsCostCurrency(item.price_currency);

  const borderColor = hasError ? '#d32f2f' : missingTcgdexImage ? '#ed6c02' : '#e0e0e0';
  const bgcolor = hasError ? '#ffebee' : missingTcgdexImage ? '#fff8e1' : '#fff';

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.25,
        display: 'flex',
        gap: 1.25,
        alignItems: 'flex-start',
        borderColor,
        borderWidth: missingTcgdexImage || hasError ? 2 : 1,
        bgcolor,
      }}
    >
      <TcgdexPreviewImage
        tcgdxImageUrl={item.tcgdx_image_url}
        cardName={item.card_name}
        hasTcgdexImage={item.has_tcgdex_image}
      />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" spacing={0.5} flexWrap="wrap" alignItems="center" mb={0.25}>
          <Typography
            variant="subtitle2"
            fontWeight={700}
            color={hasError ? 'error.dark' : 'text.primary'}
          >
            {item.card_name}
          </Typography>
          {item.tcgdx_resolved ? (
            <Chip
              size="small"
              label={item.has_tcgdex_image ? 'TCGdex OK' : 'TCGdex sin img'}
              color={item.has_tcgdex_image ? 'success' : 'warning'}
              variant="outlined"
              sx={{ height: 20, fontSize: 10 }}
            />
          ) : (
            <Chip
              size="small"
              label="ID no resuelto"
              color="error"
              variant="outlined"
              sx={{ height: 20, fontSize: 10 }}
            />
          )}
          {item.image_source === 'cardtrader' && !item.has_tcgdex_image ? (
            <Chip
              size="small"
              label="Solo CardTrader"
              color="default"
              variant="outlined"
              sx={{ height: 20, fontSize: 10 }}
            />
          ) : null}
        </Stack>
        <Typography variant="caption" color="text.secondary" display="block">
          {item.language.toUpperCase()} · ×{item.quantity}
          {item.expansion ? ` · ${item.expansion}` : ''}
        </Typography>
        {item.card_id ? (
          <Typography
            variant="caption"
            color={item.tcgdx_resolved ? 'text.secondary' : 'error.main'}
            display="block"
            fontWeight={item.tcgdx_resolved ? 400 : 600}
          >
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
  const [filter, setFilter] = useState<PreviewFilter>('all');

  const filteredItems = useMemo(() => {
    if (!preview) return [];
    if (filter === 'no_tcgdex_image') {
      return preview.items.filter((item) => !item.has_tcgdex_image);
    }
    if (filter === 'warnings') {
      return preview.items.filter((item) => item.errors.length > 0);
    }
    return preview.items;
  }, [preview, filter]);

  if (isLoading) {
    return (
      <Paper variant="outlined" sx={{ p: 3, mb: 2, textAlign: 'center' }}>
        <CircularProgress size={28} />
        <Typography variant="body2" color="text.secondary" mt={1}>
          Resolviendo cartas en TCGdex y calculando precios…
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
        Previsualización TCGdex antes de crear stock
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph sx={{ mt: -0.5, mb: 1.5 }}>
        Revisa la imagen de cada carta en TCGdex. Las filas en naranja no tienen imagen en catálogo;
        las rojas tienen otros avisos (ID, precio, etc.).
      </Typography>

      <Stack direction="row" spacing={1} flexWrap="wrap" mb={1.5}>
        <Chip label={`${summary.total_cards} cartas`} color="primary" size="small" />
        <Chip
          label={formatCop(summary.total_cop)}
          color="success"
          size="small"
          variant="outlined"
        />
        <Chip label={`${summary.ok_count} OK`} color="success" size="small" />
        {summary.no_tcgdex_image_count > 0 ? (
          <Chip
            label={`${summary.no_tcgdex_image_count} sin imagen TCGdex`}
            color="warning"
            size="small"
          />
        ) : null}
        {summary.no_tcgdex_id_count > 0 ? (
          <Chip
            label={`${summary.no_tcgdex_id_count} sin ID TCGdex`}
            color="error"
            size="small"
            variant="outlined"
          />
        ) : null}
        {summary.error_count > 0 ? (
          <Chip label={`${summary.error_count} con aviso`} color="error" size="small" />
        ) : null}
      </Stack>

      <Tabs
        value={filter}
        onChange={(_, v: PreviewFilter) => setFilter(v)}
        sx={{ mb: 1.5, minHeight: 36, '& .MuiTab-root': { minHeight: 36, py: 0.5 } }}
      >
        <Tab value="all" label={`Todas (${preview.items.length})`} />
        {summary.no_tcgdex_image_count > 0 ? (
          <Tab
            value="no_tcgdex_image"
            label={`Sin imagen TCGdex (${summary.no_tcgdex_image_count})`}
          />
        ) : null}
        {summary.error_count > 0 ? (
          <Tab value="warnings" label={`Con avisos (${summary.error_count})`} />
        ) : null}
      </Tabs>

      <Stack spacing={1} sx={{ maxHeight: 420, overflow: 'auto', mb: 2 }}>
        {filteredItems.length === 0 ? (
          <Typography variant="body2" color="text.secondary" textAlign="center" py={2}>
            Ninguna carta coincide con este filtro.
          </Typography>
        ) : (
          filteredItems.map((item) => <PreviewRow key={item.tracking_id} item={item} />)
        )}
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
        {summary.no_tcgdex_image_count > 0 ? (
          <Typography variant="caption" color="warning.dark" fontWeight={600}>
            {summary.no_tcgdex_image_count} carta(s) sin imagen TCGdex — revisa antes de confirmar.
          </Typography>
        ) : summary.error_count > 0 ? (
          <Typography variant="caption" color="error">
            Las filas en rojo tienen avisos; puedes corregir TRM o datos antes de confirmar.
          </Typography>
        ) : (
          <Typography variant="caption" color="success.main">
            Todas las cartas tienen imagen TCGdex.
          </Typography>
        )}
      </Stack>
    </Paper>
  );
}
