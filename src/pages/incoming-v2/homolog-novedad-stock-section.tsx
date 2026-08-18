import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Box, Button, Stack, Typography } from '@mui/material';
import { useExchangeRates } from '../../utils/tasa';
import { NovedadStockPreviewPanel } from './novedad-stock/novedad-stock-preview-panel';
import {
  useNovedadStockList,
  useNovedadStockPreview,
  useNovedadStockMutations,
} from './novedad-stock/use-novedad-stock';

type HomologNovedadStockSectionProps = {
  orphanNovedadCount: number;
  sessionId?: string;
  onStockCreated?: () => void;
  onError?: (message: string) => void;
  onInfo?: (message: string) => void;
};

/** Paso 1 en homologación v2: novedades sin inventario → stock (no tanda). */
export function HomologNovedadStockSection({
  orphanNovedadCount,
  sessionId,
  onStockCreated,
  onError,
  onInfo,
}: HomologNovedadStockSectionProps) {
  const { rates, isPrompting } = useExchangeRates();
  const { data: stockRows = [] } = useNovedadStockList();
  const { syncFromSession, materialize, undoMaterialize, axiosMessage } =
    useNovedadStockMutations();

  const pendingStock = stockRows.filter(
    (r) =>
      (!sessionId || r.session_id === sessionId) && r.status === 'pending',
  ).length;
  const inStock = stockRows.filter(
    (r) =>
      (!sessionId || r.session_id === sessionId) && r.status === 'in_stock',
  ).length;

  const showPreview =
    orphanNovedadCount > 0 || pendingStock > 0 || syncFromSession.isPending;
  const {
    data: preview,
    isLoading: previewLoading,
    isError: previewError,
    refetch: refetchPreview,
  } = useNovedadStockPreview(showPreview && pendingStock > 0, rates);

  useEffect(() => {
    if (!sessionId || orphanNovedadCount === 0) return;
    void (async () => {
      try {
        await syncFromSession.mutateAsync(sessionId);
        await refetchPreview();
      } catch {
        // El listado puede estar vacío hasta la primera sync manual.
      }
    })();
    // Solo al montar o cuando cambia la sesión / cantidad de huérfanas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, orphanNovedadCount]);

  if (
    orphanNovedadCount === 0 &&
    pendingStock === 0 &&
    inStock === 0 &&
    !syncFromSession.isPending
  ) {
    return null;
  }

  const handleMaterialize = async () => {
    if (rates.euroToCop == null || rates.usdToCop == null) {
      onError?.('Configura las tasas EUR/USD → COP en el panel lateral.');
      return;
    }
    try {
      const res = await materialize.mutateAsync({
        session_id: sessionId,
        euro_to_cop: rates.euroToCop,
        usd_to_cop: rates.usdToCop,
      });
      onInfo?.(`Creadas ${res.created} cartas en stock con precio TRM.`);
      onStockCreated?.();
    } catch (e) {
      onError?.(axiosMessage(e));
    }
  };

  const handleUndo = async () => {
    try {
      const res = await undoMaterialize.mutateAsync({ session_id: sessionId });
      onInfo?.(`Deshizo ${res.reverted} línea(s) de stock.`);
      await refetchPreview();
    } catch (e) {
      onError?.(axiosMessage(e));
    }
  };

  const tandaBlocked = pendingStock > 0;

  return (
    <Box mb={2}>
      <Typography variant="subtitle1" fontWeight={700} gutterBottom>
        Paso 1 · Novedades → Stock
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        Las cartas marcadas como novedad <strong>sin inventario en camino</strong> se crean en
        stock con precio TRM. No van en la tanda de llegada.
      </Typography>

      {isPrompting ? (
        <Alert severity="warning" sx={{ mb: 1.5 }}>
          Configura las tasas EUR/USD → COP en el panel lateral para calcular precios.
        </Alert>
      ) : null}

      {tandaBlocked ? (
        <Alert severity="info" sx={{ mb: 1.5 }}>
          Hay {pendingStock} novedad(es) pendiente(s) de pasar a stock. Completa este paso antes de
          crear la tanda.
        </Alert>
      ) : inStock > 0 ? (
        <Alert severity="success" sx={{ mb: 1.5 }}>
          {inStock} novedad(es) ya están en stock. Puedes continuar con la tanda de verificadas.
        </Alert>
      ) : null}

      {orphanNovedadCount > 0 && pendingStock === 0 && !syncFromSession.isPending ? (
        <Alert severity="warning" sx={{ mb: 1.5 }}>
          Hay {orphanNovedadCount} novedad(es) sin inventario. Sincroniza y confirma la
          previsualización para crearlas en stock.
        </Alert>
      ) : null}

      {pendingStock > 0 || syncFromSession.isPending ? (
        <NovedadStockPreviewPanel
          preview={preview}
          isLoading={previewLoading || syncFromSession.isPending}
          isError={previewError}
          onConfirm={() => void handleMaterialize()}
          confirming={materialize.isPending}
          canConfirm={!isPrompting && pendingStock > 0}
        />
      ) : orphanNovedadCount > 0 ? (
        <Button
          size="small"
          variant="contained"
          sx={{ mb: 1 }}
          onClick={() => {
            if (!sessionId) return;
            void (async () => {
              try {
                await syncFromSession.mutateAsync(sessionId);
                await refetchPreview();
              } catch (e) {
                onError?.(axiosMessage(e));
              }
            })();
          }}
          disabled={syncFromSession.isPending || !sessionId}
        >
          {syncFromSession.isPending ? 'Sincronizando…' : 'Sincronizar novedades para stock'}
        </Button>
      ) : null}

      <Stack direction="row" spacing={1} flexWrap="wrap" mt={1}>
        {inStock > 0 ? (
          <Button
            size="small"
            variant="outlined"
            color="error"
            onClick={() => void handleUndo()}
            disabled={undoMaterialize.isPending}
          >
            Deshacer stock de novedades
          </Button>
        ) : null}
        <Button component={Link} to="/incoming-v2/novedad-stock" size="small">
          Ver módulo completo
        </Button>
      </Stack>
    </Box>
  );
}

export function countOrphanNovedadUnits(
  units: Array<{ status: string; transit_line_id?: string | null; batch_item_id?: string | null }>,
): number {
  return units.filter(
    (u) =>
      u.status === 'novedad' &&
      !u.transit_line_id?.trim() &&
      !u.batch_item_id?.trim(),
  ).length;
}
