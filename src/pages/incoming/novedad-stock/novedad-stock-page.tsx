import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
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
import { useExchangeRates } from '../../../utils/tasa';
import { formatFx } from '../../incoming-v2/homolog-format';
import { HomologCardImage } from '../../incoming-v2/homolog-card-image';
import { HomologPriceChip } from '../../incoming-v2/homolog-price-block';
import { normalizeCardsCostCurrency } from '../../../utils/purchase-currency';
import { NovedadStockPreviewPanel } from './novedad-stock-preview-panel';
import {
  useNovedadStockList,
  useNovedadStockPreview,
  useNovedadStockMutations,
  type NovedadStockRow,
} from './use-novedad-stock';

type FilterTab = 'all' | 'pending' | 'in_stock';

function statusChip(status: NovedadStockRow['status']) {
  if (status === 'pending') return <Chip size="small" color="warning" label="Pendiente stock" />;
  if (status === 'in_stock') return <Chip size="small" color="success" label="En stock" />;
  return <Chip size="small" label={status} />;
}

function NovedadStockCardRow({
  row,
  onResolve,
  resolving,
}: {
  row: NovedadStockRow;
  onResolve: (id: string) => void;
  resolving: boolean;
}) {
  const currency = normalizeCardsCostCurrency(row.price_currency);
  return (
    <Paper variant="outlined" sx={{ p: 1.5, display: 'flex', gap: 1.5, alignItems: 'stretch' }}>
      <HomologCardImage src={row.image_url} alt={row.card_name} variant="list" />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" mb={0.5}>
          <Typography variant="subtitle2" fontWeight={700}>
            {row.card_name}
          </Typography>
          {statusChip(row.status)}
        </Stack>
        <Typography variant="caption" color="text.secondary" display="block">
          {row.language.toUpperCase()} · {row.order_code}
          {row.expansion ? ` · ${row.expansion}` : ''}
        </Typography>
        {row.novedad_notes ? (
          <Typography variant="body2" color="warning.dark" sx={{ mt: 0.75 }}>
            {row.novedad_notes}
          </Typography>
        ) : null}
        {row.card_id ? (
          <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>
            ID: {row.card_id}
          </Typography>
        ) : null}
        {row.stock_id ? (
          <Button
            component={Link}
            to={`/stock/update/${row.stock_id}`}
            size="small"
            sx={{ mt: 0.5, px: 0 }}
          >
            Ver en stock
          </Button>
        ) : null}
      </Box>
      <Box textAlign="right" sx={{ minWidth: 100 }}>
        <HomologPriceChip
          cop={row.unit_cost_cop}
          fx={row.purchase_price_fx}
          currency={currency}
        />
        {row.purchase_price_fx != null ? (
          <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>
            TRM · {formatFx(row.purchase_price_fx, currency)}
          </Typography>
        ) : null}
        {row.status === 'in_stock' ? (
          <Button
            size="small"
            color="inherit"
            sx={{ mt: 1 }}
            disabled={resolving}
            onClick={() => onResolve(row.id)}
          >
            Archivar
          </Button>
        ) : null}
      </Box>
    </Paper>
  );
}

export default function NovedadStockPage() {
  const { rates, isPrompting } = useExchangeRates();
  const { data: rows = [], isLoading, error } = useNovedadStockList();
  const { syncFromSession, materialize, undoMaterialize, resolveRow, axiosMessage } =
    useNovedadStockMutations();
  const [tab, setTab] = useState<FilterTab>('all');
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionInfo, setActionInfo] = useState<string | null>(null);

  const counts = useMemo(
    () => ({
      all: rows.length,
      pending: rows.filter((r) => r.status === 'pending').length,
      in_stock: rows.filter((r) => r.status === 'in_stock').length,
    }),
    [rows],
  );

  const showPreview = counts.pending > 0;
  const {
    data: preview,
    isLoading: previewLoading,
    isError: previewError,
    refetch: refetchPreview,
  } = useNovedadStockPreview(showPreview, rates);

  const filtered = useMemo(() => {
    if (tab === 'all') return rows;
    return rows.filter((r) => r.status === tab);
  }, [rows, tab]);

  const handleSync = async () => {
    setActionError(null);
    setActionInfo(null);
    try {
      const res = await syncFromSession.mutateAsync(undefined);
      setActionInfo(`Sincronizadas ${res.synced} cartas desde la homologación activa.`);
      await refetchPreview();
    } catch (e) {
      setActionError(axiosMessage(e));
    }
  };

  const handleConfirmMaterialize = async () => {
    if (rates.euroToCop == null || rates.usdToCop == null) {
      setActionError('Configura las tasas EUR/USD → COP en el panel lateral antes de crear stock.');
      return;
    }
    setActionError(null);
    setActionInfo(null);
    try {
      const res = await materialize.mutateAsync({
        euro_to_cop: rates.euroToCop,
        usd_to_cop: rates.usdToCop,
      });
      setActionInfo(`Creadas ${res.created} líneas de stock con precio TRM.`);
    } catch (e) {
      setActionError(axiosMessage(e));
    }
  };

  const handleUndoMaterialize = async () => {
    setActionError(null);
    setActionInfo(null);
    try {
      const res = await undoMaterialize.mutateAsync({});
      if (res.failed.length > 0) {
        setActionError(
          `Revertidas ${res.reverted}. No se pudieron ${res.failed.length}: ${res.failed
            .map((f) => `${f.card_name} (${f.reason})`)
            .join('; ')}`,
        );
      } else {
        setActionInfo(`Se deshizo la creación de ${res.reverted} carta(s) en stock.`);
      }
    } catch (e) {
      setActionError(axiosMessage(e));
    }
  };

  const handleResolve = async (id: string) => {
    setActionError(null);
    try {
      await resolveRow.mutateAsync(id);
    } catch (e) {
      setActionError(axiosMessage(e));
    }
  };

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" py={6}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box maxWidth={960} mx="auto">
      <Typography variant="h5" fontWeight={700} gutterBottom>
        Cartas con novedad
      </Typography>
      <Typography color="text.secondary" paragraph>
        Revisa la previsualización antes de crear stock. Si algo sale mal, puedes deshacer la
        creación mientras las líneas sigan disponibles y sin reserva.
      </Typography>

      {error ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          No se pudo cargar el listado.
        </Alert>
      ) : null}
      {actionError ? (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setActionError(null)}>
          {actionError}
        </Alert>
      ) : null}
      {actionInfo ? (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setActionInfo(null)}>
          {actionInfo}
        </Alert>
      ) : null}
      {isPrompting ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Configura las tasas de cambio en el panel lateral para calcular precios TRM.
        </Alert>
      ) : null}

      {showPreview ? (
        <NovedadStockPreviewPanel
          preview={preview}
          isLoading={previewLoading}
          isError={previewError}
          onConfirm={() => void handleConfirmMaterialize()}
          confirming={materialize.isPending}
          canConfirm={!isPrompting && counts.pending > 0}
        />
      ) : null}

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} mb={2} flexWrap="wrap">
        <Button
          variant="outlined"
          onClick={() => void handleSync()}
          disabled={syncFromSession.isPending}
        >
          {syncFromSession.isPending ? 'Sincronizando…' : 'Sincronizar desde homologación'}
        </Button>
        {counts.in_stock > 0 ? (
          <Button
            variant="outlined"
            color="error"
            onClick={() => void handleUndoMaterialize()}
            disabled={undoMaterialize.isPending}
          >
            {undoMaterialize.isPending
              ? 'Deshaciendo…'
              : `Deshacer creación en stock (${counts.in_stock})`}
          </Button>
        ) : null}
        <Button component={Link} to="/incoming-v2" variant="text">
          Ir a homologación v2
        </Button>
      </Stack>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab value="all" label={`Todas (${counts.all})`} />
        <Tab value="pending" label={`Pendientes (${counts.pending})`} />
        <Tab value="in_stock" label={`En stock (${counts.in_stock})`} />
      </Tabs>

      {filtered.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">
            {tab === 'pending'
              ? 'No hay cartas pendientes de pasar a stock.'
              : tab === 'in_stock'
                ? 'Aún no hay cartas creadas en stock desde novedades.'
                : 'Sin cartas con novedad registradas. Marca novedades en homologación v2 o sincroniza.'}
          </Typography>
        </Paper>
      ) : (
        <Stack spacing={1.25}>
          {filtered.map((row) => (
            <NovedadStockCardRow
              key={row.id}
              row={row}
              onResolve={handleResolve}
              resolving={resolveRow.isPending}
            />
          ))}
        </Stack>
      )}
    </Box>
  );
}
