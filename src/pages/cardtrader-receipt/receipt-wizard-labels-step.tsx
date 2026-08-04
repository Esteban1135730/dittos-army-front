import { Link, useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Stack,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useState } from 'react';
import { apiUrl } from '../../config/api';
import type { StockListItem } from '../../types/stock';
import { useExchangeRates } from '../../utils/tasa';

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
  stockIds: string[];
  onFinish: () => void;
  onNewReceipt: () => void;
  onRevert?: () => Promise<void>;
};

export function ReceiptWizardLabelsStep({
  stockIds,
  onFinish,
  onNewReceipt,
  onRevert,
}: ReceiptWizardLabelsStepProps) {
  const navigate = useNavigate();
  const { convert } = useExchangeRates();
  const [reverting, setReverting] = useState(false);

  const { data: stock = [] } = useQuery<StockListItem[]>({
    queryKey: ['stock'],
    queryFn: async () => {
      const res = await axios.get(apiUrl('/stock'));
      return Array.isArray(res.data) ? res.data : [];
    },
    enabled: stockIds.length > 0,
  });

  const stockById = new Map(stock.map((s) => [s._id, s]));
  const withPvp = stockIds.filter(
    (id) => pvpStoredCop(stockById.get(id), convert) > 0,
  ).length;

  const handleOpenLabels = () => {
    if (stockIds.length === 0) return;
    navigate(
      `/stock/imprimir-etiquetas-qr?stockIds=${stockIds.map(encodeURIComponent).join(',')}`,
    );
  };

  const handleRevert = async () => {
    if (!onRevert) return;
    const ok = window.confirm(
      '¿Deshacer la finalización?\n\nSe eliminará el stock creado y la sesión volverá a abierta.',
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

      {stockIds.length === 0 ? (
        <Alert severity="info" sx={{ mb: 2 }}>
          No se creó inventario (solo inconsistencias).
        </Alert>
      ) : (
        <>
          <Typography variant="body1" mb={1}>
            {stockIds.length} stock(s) creado(s) · {withPvp} con PVP (estimación)
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
          disabled={stockIds.length === 0}
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
