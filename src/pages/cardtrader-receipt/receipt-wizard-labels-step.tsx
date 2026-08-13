import { Link, useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Stack,
  Typography,
} from '@mui/material';
import { useQueries } from '@tanstack/react-query';
import axios from 'axios';
import { useMemo, useState } from 'react';
import { apiUrl } from '../../config/api';
import type { StockListItem } from '../../types/stock';
import { useExchangeRates } from '../../utils/tasa';
import type { CreatedStockRef } from '../incoming-v2/use-incoming-homolog';
import type { OwnerKey } from '../../config/owners';

function pvpStoredCop(
  item: StockListItem | undefined,
  convert: ReturnType<typeof useExchangeRates>['convert'],
): number {
  if (!item?.pvp || item.pvp <= 0) return 0;
  if (item.pvp_currency === 'COP') return item.pvp;
  if (item.pvp_currency === 'EUR') return convert.toCopFromEur(item.pvp) ?? 0;
  if (item.pvp_currency === 'USD') return convert.toCopFromUsd(item.pvp) ?? 0;
  return 0;
}

type ReceiptWizardLabelsStepProps = {
  createdStocks: CreatedStockRef[];
  onFinish: () => void;
  onNewReceipt: () => void;
  onRevert?: () => Promise<void>;
};

export function ReceiptWizardLabelsStep({
  createdStocks,
  onFinish,
  onNewReceipt,
  onRevert,
}: ReceiptWizardLabelsStepProps) {
  const navigate = useNavigate();
  const { convert } = useExchangeRates();
  const [reverting, setReverting] = useState(false);

  const owners = useMemo(() => {
    const set = new Set<OwnerKey>();
    for (const ref of createdStocks) set.add(ref.owner);
    return [...set];
  }, [createdStocks]);

  const stockQueries = useQueries({
    queries: owners.map((owner) => ({
      queryKey: ['stock', owner] as const,
      queryFn: async () => {
        const res = await axios.get(apiUrl('/stock'), { ownerOverride: owner });
        return Array.isArray(res.data) ? (res.data as StockListItem[]) : [];
      },
      enabled: createdStocks.length > 0,
    })),
  });

  const stockByOwner = useMemo(() => {
    const map = new Map<OwnerKey, Map<string, StockListItem>>();
    owners.forEach((owner, i) => {
      const inner = new Map<string, StockListItem>();
      for (const s of stockQueries[i]?.data ?? []) {
        inner.set(String(s._id).toLowerCase(), s);
      }
      map.set(owner, inner);
    });
    return map;
  }, [owners, stockQueries]);

  const withPvp = createdStocks.filter((ref) => {
    const item = stockByOwner.get(ref.owner)?.get(ref.stock_id.toLowerCase());
    return pvpStoredCop(item, convert) > 0;
  }).length;

  const handleOpenLabels = () => {
    if (createdStocks.length === 0) return;
    const ids = createdStocks.map((r) => encodeURIComponent(r.stock_id)).join(',');
    const ownersParam = createdStocks
      .map((r) => encodeURIComponent(r.owner))
      .join(',');
    navigate(
      `/stock/imprimir-etiquetas-qr?stockIds=${ids}&stockOwners=${ownersParam}`,
    );
  };

  const handleRevert = async () => {
    if (!onRevert) return;
    const ok = window.confirm(
      '¿Deshacer la creación de stock?\n\nSe eliminará el inventario creado y la sesión de homologación volverá a abierta.',
    );
    if (!ok) return;
    setReverting(true);
    try {
      await onRevert();
    } finally {
      setReverting(false);
    }
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Etiquetas
      </Typography>

      {createdStocks.length === 0 ? (
        <Alert severity="info" sx={{ mb: 2 }}>
          No se creó inventario (solo inconsistencias).
        </Alert>
      ) : (
        <>
          <Typography variant="body1" mb={1}>
            {createdStocks.length} stock(s) creado(s) · {withPvp} con PVP (estimación)
          </Typography>
          <Alert severity="info" sx={{ mb: 2 }}>
            Una etiqueta por línea de stock; ajusta cantidad en la cola si
            necesitas más copias del mismo QR.
          </Alert>
        </>
      )}

      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <Button
          variant="contained"
          disabled={createdStocks.length === 0}
          onClick={handleOpenLabels}
        >
          Abrir Imprimir etiquetas
        </Button>
        <Button variant="outlined" onClick={onNewReceipt}>
          Nueva recepción
        </Button>
        <Button component={Link} to="/cardtrader-transit" variant="outlined">
          Ver lotes en tránsito
        </Button>
        <Button variant="text" onClick={onFinish}>
          Terminar
        </Button>
        {onRevert && (
          <Button
            variant="text"
            color="warning"
            disabled={reverting}
            onClick={() => void handleRevert()}
          >
            {reverting ? 'Revirtiendo…' : 'Deshacer recepción'}
          </Button>
        )}
      </Stack>
    </Box>
  );
}
