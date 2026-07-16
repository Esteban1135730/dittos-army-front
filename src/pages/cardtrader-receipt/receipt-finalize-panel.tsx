import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import type { ReceiptSession } from './use-receipt-session';

type ReceiptFinalizePanelProps = {
  session: ReceiptSession;
  onFinalize: (shippingCop: number) => Promise<void>;
  onCancel: () => Promise<void>;
  error?: string | null;
};

export function ReceiptFinalizePanel({
  session,
  onFinalize,
  onCancel,
  error,
}: ReceiptFinalizePanelProps) {
  const [shippingCop, setShippingCop] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const summary = session.summary ?? {
    total: session.lines?.length ?? 0,
    pending: session.lines?.filter((l) => l.status === 'pending').length ?? 0,
    received: session.lines?.filter((l) => l.status === 'received').length ?? 0,
    inconsistency: session.lines?.filter((l) => l.status === 'inconsistency').length ?? 0,
  };
  const shippingNum = parseFloat(shippingCop);
  const shippingValid = !isNaN(shippingNum) && shippingNum > 0;
  const canFinalize = summary.pending === 0 && shippingValid;

  const disabledReason = !canFinalize
    ? summary.pending > 0 && !shippingValid
      ? `Quedan ${summary.pending} línea(s) pendiente(s) y falta el costo de envío.`
      : summary.pending > 0
        ? `Quedan ${summary.pending} línea(s) pendiente(s) por revisar.`
        : 'Ingresa un costo de envío mayor a 0.'
    : '';

  const handleFinalize = async () => {
    if (!canFinalize) return;
    const ok = window.confirm(
      `¿Confirmar finalización de la recepción?\n\n` +
        `• ${summary.received} carta(s) recibida(s)\n` +
        `• ${summary.inconsistency} inconsistencia(s)\n` +
        `• Envío: COP ${Math.round(shippingNum).toLocaleString('es-CO')}\n\n` +
        `El sistema creará el stock automáticamente.`,
    );
    if (!ok) return;
    setLoading(true);
    try {
      await onFinalize(shippingNum);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    const ok = window.confirm(
      '¿Cancelar la sesión de recepción?\n\nLas líneas de tránsito no se modificarán.',
    );
    if (!ok) return;
    setLoading(true);
    try {
      await onCancel();
    } finally {
      setLoading(false);
    }
  };

  const progress =
    summary.total > 0
      ? Math.round(((summary.received + summary.inconsistency) / summary.total) * 100)
      : 0;

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="subtitle1" fontWeight={600} gutterBottom>
        Resumen de recepción
      </Typography>

      <Stack direction="row" spacing={1} flexWrap="wrap" mb={2}>
        <Chip
          label={`${summary.received} recibida(s)`}
          color="success"
          size="small"
          variant="filled"
        />
        <Chip
          label={`${summary.inconsistency} inconsistencia(s)`}
          color="warning"
          size="small"
          variant="filled"
        />
        <Chip
          label={`${summary.pending} pendiente(s)`}
          color="default"
          size="small"
          variant="outlined"
        />
      </Stack>

      <Box sx={{ mb: 2 }}>
        <Typography variant="caption" color="text.secondary">
          Progreso: {progress}% ({summary.received + summary.inconsistency}/{summary.total})
        </Typography>
        <Box
          sx={{
            height: 6,
            bgcolor: 'grey.200',
            borderRadius: 3,
            mt: 0.5,
            overflow: 'hidden',
          }}
        >
          <Box
            sx={{
              height: '100%',
              width: `${progress}%`,
              bgcolor: summary.pending === 0 ? 'success.main' : 'primary.main',
              transition: 'width 0.3s ease',
            }}
          />
        </Box>
      </Box>

      <Divider sx={{ mb: 2 }} />

      <TextField
        label="Costo de envío total (COP)"
        type="number"
        fullWidth
        size="small"
        value={shippingCop}
        onChange={(e) => setShippingCop(e.target.value)}
        disabled={loading}
        inputProps={{ min: 1, step: 100 }}
        sx={{ mb: 2 }}
        placeholder="Ej: 25000"
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2, fontSize: '0.8rem' }}>
          {error}
        </Alert>
      )}

      <Tooltip title={disabledReason} disableHoverListener={canFinalize} arrow>
        <span>
          <Button
            variant="contained"
            color="primary"
            fullWidth
            onClick={handleFinalize}
            disabled={!canFinalize || loading}
            sx={{ mb: 1 }}
          >
            {loading ? 'Finalizando…' : 'Finalizar recepción'}
          </Button>
        </span>
      </Tooltip>

      <Button
        variant="outlined"
        color="error"
        fullWidth
        size="small"
        onClick={handleCancel}
        disabled={loading}
      >
        Cancelar sesión
      </Button>
    </Paper>
  );
}
