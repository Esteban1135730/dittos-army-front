import { useState } from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import type { ReceiptLine } from './use-receipt-session';
import { INCONSISTENCY_LABELS } from './use-receipt-session';
import { CardThumb } from '../../components/card-thumb';

type ReceiptLineRowProps = {
  line: ReceiptLine;
  /** URL ya resuelta (image_url o blueprint CT). */
  imageSrc?: string | null;
  onReceive: (lineId: string, qty: number) => Promise<void>;
  onInconsistency: (line: ReceiptLine) => void;
  onUndo: (lineId: string) => Promise<void>;
  disabled?: boolean;
  /** Tamaño del thumb; default `lg` para apoyo visual en recepción. */
  thumbSize?: 'md' | 'lg' | 'xl';
};

export function ReceiptLineRow({
  line,
  imageSrc,
  onReceive,
  onInconsistency,
  onUndo,
  disabled = false,
  thumbSize = 'lg',
}: ReceiptLineRowProps) {
  const [qty, setQty] = useState<number>(line.quantity_expected);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleReceive = async () => {
    if (qty < 1 || qty > line.quantity_expected) {
      setError(`La cantidad debe estar entre 1 y ${line.quantity_expected}.`);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await onReceive(line.line_id, qty);
    } catch (e: unknown) {
      const err = e as { message?: string };
      setError(err?.message ?? 'Error al marcar como recibida.');
    } finally {
      setLoading(false);
    }
  };

  const handleUndo = async () => {
    setError(null);
    setLoading(true);
    try {
      await onUndo(line.line_id);
    } catch (e: unknown) {
      const err = e as { message?: string };
      setError(err?.message ?? 'Error al deshacer.');
    } finally {
      setLoading(false);
    }
  };

  const resolvedSrc = imageSrc || line.image_url || null;

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 2,
        py: 1.5,
        px: 1,
        borderRadius: 1,
        '&:hover': { bgcolor: 'grey.50' },
      }}
    >
      <CardThumb
        src={resolvedSrc}
        alt={line.card_name}
        size={thumbSize}
        enlargeOnHover
      />

      {/* Card info */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="subtitle2" noWrap>
          {line.card_name}
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block">
          {[line.expansion, line.collector_number, line.rareza, line.language]
            .filter(Boolean)
            .join(' · ')}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Esperadas: <strong>{line.quantity_expected}</strong> · COP{' '}
          {Math.round(line.unit_cost_cop).toLocaleString('es-CO')}/u
        </Typography>

        {error && (
          <Typography variant="caption" color="error" display="block" mt={0.5}>
            {error}
          </Typography>
        )}
      </Box>

      {/* Status + actions */}
      <Stack direction="row" spacing={1} alignItems="center" flexShrink={0}>
        {line.status === 'pending' && (
          <>
            <TextField
              type="number"
              size="small"
              value={qty}
              onChange={(e) => setQty(Number(e.target.value))}
              inputProps={{ min: 1, max: line.quantity_expected, step: 1 }}
              sx={{ width: 72 }}
              disabled={disabled || loading}
            />
            <Button
              size="small"
              variant="contained"
              color="success"
              onClick={handleReceive}
              disabled={disabled || loading}
              sx={{ whiteSpace: 'nowrap' }}
            >
              {loading ? <CircularProgress size={14} color="inherit" /> : 'Recibida'}
            </Button>
            <Button
              size="small"
              variant="outlined"
              color="warning"
              onClick={() => onInconsistency(line)}
              disabled={disabled || loading}
              sx={{ whiteSpace: 'nowrap' }}
            >
              Inconsistencia
            </Button>
          </>
        )}

        {line.status === 'received' && (
          <>
            <Chip
              label={`✓ ${line.received_qty ?? line.quantity_expected} recibida(s)`}
              color="success"
              size="small"
            />
            <Button
              size="small"
              variant="outlined"
              onClick={handleUndo}
              disabled={disabled || loading}
            >
              {loading ? <CircularProgress size={14} color="inherit" /> : 'Deshacer'}
            </Button>
          </>
        )}

        {line.status === 'inconsistency' && (
          <>
            <Chip
              label={
                line.inconsistency_type
                  ? INCONSISTENCY_LABELS[line.inconsistency_type]
                  : 'Inconsistencia'
              }
              color="warning"
              size="small"
            />
            <Button
              size="small"
              variant="outlined"
              onClick={handleUndo}
              disabled={disabled || loading}
            >
              {loading ? <CircularProgress size={14} color="inherit" /> : 'Deshacer'}
            </Button>
          </>
        )}
      </Stack>
    </Box>
  );
}
