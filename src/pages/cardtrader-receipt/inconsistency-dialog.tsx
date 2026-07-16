import { useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import type { InconsistencyType, ReceiptLine } from './use-receipt-session';
import { INCONSISTENCY_LABELS } from './use-receipt-session';

type InconsistencyDialogProps = {
  open: boolean;
  line: ReceiptLine | null;
  onConfirm: (lineId: string, type: InconsistencyType, notes: string) => Promise<void>;
  onClose: () => void;
};

const INCONSISTENCY_OPTIONS: { value: InconsistencyType; label: string }[] = [
  { value: 'not_arrived', label: INCONSISTENCY_LABELS.not_arrived },
  { value: 'wrong_quantity', label: INCONSISTENCY_LABELS.wrong_quantity },
  { value: 'wrong_card', label: INCONSISTENCY_LABELS.wrong_card },
];

export function InconsistencyDialog({
  open,
  line,
  onConfirm,
  onClose,
}: InconsistencyDialogProps) {
  const [type, setType] = useState<InconsistencyType>('not_arrived');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const notesValid = notes.trim().length >= 10;

  const handleConfirm = async () => {
    if (!line) return;
    if (!notesValid) {
      setError('Las notas deben tener al menos 10 caracteres.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await onConfirm(line.line_id, type, notes.trim());
      handleClose();
    } catch (e: unknown) {
      const err = e as { message?: string };
      setError(err?.message ?? 'Error al registrar inconsistencia.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (loading) return;
    setType('not_arrived');
    setNotes('');
    setError(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Registrar inconsistencia</DialogTitle>
      <DialogContent>
        <Stack spacing={2} mt={1}>
          {line && (
            <Typography variant="body2" color="text.secondary">
              Carta: <strong>{line.card_name}</strong> · Esperadas:{' '}
              <strong>{line.quantity_expected}</strong>
            </Typography>
          )}

          <FormControl fullWidth size="small">
            <InputLabel id="inconsistency-type-label">Tipo de inconsistencia</InputLabel>
            <Select
              labelId="inconsistency-type-label"
              value={type}
              label="Tipo de inconsistencia"
              onChange={(e) => setType(e.target.value as InconsistencyType)}
              disabled={loading}
            >
              {INCONSISTENCY_OPTIONS.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            label="Notas (obligatorio)"
            multiline
            minRows={3}
            fullWidth
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={loading}
            error={notes.length > 0 && !notesValid}
            helperText={
              notes.length > 0 && !notesValid
                ? `Mínimo 10 caracteres (${notes.trim().length}/10)`
                : `${notes.trim().length} caracteres`
            }
            placeholder="Describe el problema con esta carta..."
          />

          <Alert severity="info" sx={{ fontSize: '0.8rem' }}>
            La línea de tránsito queda abierta para resolución desde el detalle del lote.
          </Alert>

          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          Cancelar
        </Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          color="warning"
          disabled={loading || !notesValid}
        >
          {loading ? 'Registrando…' : 'Confirmar inconsistencia'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
