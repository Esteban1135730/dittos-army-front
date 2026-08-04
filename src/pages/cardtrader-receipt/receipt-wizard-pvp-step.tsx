import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { apiUrl } from '../../config/api';
import type { StockListItem } from '../../types/stock';
import { useExchangeRates } from '../../utils/tasa';
import type { ReceiptLine } from './use-receipt-session';

function rarezaFromLine(line: ReceiptLine): string | null {
  const rz =
    line.rareza != null && String(line.rareza).trim() !== ''
      ? String(line.rareza).trim()
      : '';
  return rz === '' ? null : rz;
}

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

type PvpRowProps = {
  line: ReceiptLine;
  stockItem: StockListItem | undefined;
  sessionId: string;
  onOutcome: (message: string, severity: 'success' | 'error') => void;
};

function ReceiptPvpRow({ line, stockItem, sessionId, onOutcome }: PvpRowProps) {
  const { convert } = useExchangeRates();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const storedCop = Math.round(pvpStoredCop(stockItem, convert));
  const [draft, setDraft] = useState(storedCop > 0 ? String(storedCop) : '');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (busy) return;
    setDraft(storedCop > 0 ? String(storedCop) : '');
  }, [storedCop, busy, line.stock_id]);

  const hasPvp = storedCop > 0;
  const returnPath = `/cardtrader-receipt?step=3&session=${encodeURIComponent(sessionId)}`;

  const savePvp = async () => {
    if (busy) return;
    const normalized = draft.trim().replace(',', '.');
    if (normalized === '' || normalized === '.') {
      setDraft(storedCop > 0 ? String(storedCop) : '');
      return;
    }
    const num = parseFloat(normalized);
    if (!Number.isFinite(num) || num <= 0) {
      setDraft(storedCop > 0 ? String(storedCop) : '');
      return;
    }
    const nextCop = Math.round(num);
    if (storedCop > 0 && nextCop === storedCop) {
      setDraft(String(storedCop));
      return;
    }
    setBusy(true);
    try {
      await axios.post(apiUrl('/pvp'), {
        card_id: line.card_id,
        pvp: nextCop,
        currency: 'COP',
        rareza: rarezaFromLine(line),
      });
      onOutcome('PVP actualizado.', 'success');
      await queryClient.invalidateQueries({ queryKey: ['stock'] });
    } catch (err: unknown) {
      setDraft(storedCop > 0 ? String(storedCop) : '');
      const ax = err as { response?: { data?: { message?: string | string[] } } };
      const msg = ax.response?.data?.message;
      const text = Array.isArray(msg) ? msg[0] : msg;
      onOutcome(
        typeof text === 'string' ? text : 'Error al actualizar el PVP.',
        'error',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 2,
        py: 1.5,
        px: 1,
        borderBottom: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Box
        sx={{
          width: 48,
          height: 68,
          bgcolor: 'grey.100',
          borderRadius: 0.5,
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        {line.image_url ? (
          <img
            src={line.image_url}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : null}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="subtitle2" noWrap>
          {line.card_name}
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block">
          {[line.rareza, line.language].filter(Boolean).join(' · ')}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Costo unitario: COP{' '}
          {Math.round(line.unit_cost_cop).toLocaleString('es-CO')}
        </Typography>
      </Box>
      <Stack direction="row" spacing={1} alignItems="center" flexShrink={0}>
        <Chip
          size="small"
          label={hasPvp ? 'Con PVP' : 'Sin PVP'}
          color={hasPvp ? 'success' : 'default'}
          variant={hasPvp ? 'filled' : 'outlined'}
        />
        <TextField
          size="small"
          label="PVP (COP)"
          value={draft}
          disabled={busy}
          onChange={(e) => {
            const value = e.target.value;
            if (value === '' || /^[0-9]*[.,]?[0-9]*$/.test(value)) {
              setDraft(value.replace(',', '.'));
            }
          }}
          onBlur={() => void savePvp()}
          sx={{ width: 120 }}
          placeholder="Sin asignar"
        />
        {busy && <CircularProgress size={18} />}
        <Button
          size="small"
          variant="text"
          onClick={() =>
            navigate(
              `/add-pvp/${line.card_id}?return=${encodeURIComponent(returnPath)}`,
            )
          }
        >
          PVP avanzado
        </Button>
      </Stack>
    </Box>
  );
}

type ReceiptWizardPvpStepProps = {
  sessionId: string;
  lines: ReceiptLine[];
  onContinue: () => void;
  onSkip: () => void;
  onRevert?: () => Promise<void>;
};

export function ReceiptWizardPvpStep({
  sessionId,
  lines,
  onContinue,
  onSkip,
  onRevert,
}: ReceiptWizardPvpStepProps) {
  const { convert } = useExchangeRates();
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({ open: false, message: '', severity: 'success' });
  const [reverting, setReverting] = useState(false);

  const receivedWithStock = lines.filter(
    (l) => l.status === 'received' && l.stock_id,
  );

  const { data: stock = [], isLoading } = useQuery<StockListItem[]>({
    queryKey: ['stock'],
    queryFn: async () => {
      const res = await axios.get(apiUrl('/stock'));
      return Array.isArray(res.data) ? res.data : [];
    },
  });

  const stockById = new Map(stock.map((s) => [s._id, s]));

  const withoutPvp = receivedWithStock.filter((l) => {
    const item = l.stock_id ? stockById.get(l.stock_id) : undefined;
    return pvpStoredCop(item, convert) <= 0;
  });

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
        Asignar PVP
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={2}>
        Precio de venta en COP por línea recibida. Puedes saltar este paso.
      </Typography>

      {receivedWithStock.length === 0 ? (
        <Alert severity="info" sx={{ mb: 2 }}>
          No se creó inventario (solo inconsistencias). Continúa o termina el
          wizard.
        </Alert>
      ) : isLoading ? (
        <CircularProgress size={28} />
      ) : (
        <Box sx={{ mb: 2 }}>
          {receivedWithStock.map((line) => (
            <ReceiptPvpRow
              key={line.line_id}
              line={line}
              stockItem={
                line.stock_id ? stockById.get(line.stock_id) : undefined
              }
              sessionId={sessionId}
              onOutcome={(message, severity) =>
                setSnackbar({ open: true, message, severity })
              }
            />
          ))}
        </Box>
      )}

      {!isLoading && withoutPvp.length > 0 && receivedWithStock.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {withoutPvp.length} línea(s) sin PVP &gt; 0. Las etiquetas QR no serán
          elegibles hasta asignar precio.
        </Alert>
      )}

      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <Button variant="contained" onClick={onContinue}>
          Continuar a etiquetas
        </Button>
        <Button variant="outlined" onClick={onSkip}>
          Saltar
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
        <Button component={Link} to="/cardtrader-transit" variant="text">
          Ver lotes en tránsito
        </Button>
      </Stack>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
      >
        <Alert severity={snackbar.severity}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}
