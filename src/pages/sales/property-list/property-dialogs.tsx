import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from "@mui/material";
import type { KeepSale } from "./property-types";

type ReturnDialogProps = {
  open: boolean;
  cardName: string;
  loading: boolean;
  error?: string;
  onClose: () => void;
  onConfirm: () => void;
};

export function PropertyReturnDialog({
  open,
  cardName,
  loading,
  error,
  onClose,
  onConfirm,
}: ReturnDialogProps) {
  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Devolver a stock</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          La carta saldrá de propiedad y volverá a estar disponible en inventario.
        </Typography>
        <Typography variant="subtitle2" fontWeight={700}>
          {cardName}
        </Typography>
        {error ? (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        ) : null}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={loading}>
          Cancelar
        </Button>
        <Button variant="contained" color="warning" onClick={onConfirm} disabled={loading}>
          {loading ? "Devolviendo…" : "Confirmar devolución"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

type DeleteDialogProps = {
  open: boolean;
  cardName: string;
  loading: boolean;
  error?: string;
  onClose: () => void;
  onConfirm: () => void;
};

export function PropertyDeleteDialog({
  open,
  cardName,
  loading,
  error,
  onClose,
  onConfirm,
}: DeleteDialogProps) {
  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Eliminar definitivamente</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Esta acción es irreversible. Se borrará el registro de propiedad y la carta del
          inventario.
        </Typography>
        <Typography variant="subtitle2" fontWeight={700}>
          {cardName}
        </Typography>
        {error ? (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        ) : null}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={loading}>
          Cancelar
        </Button>
        <Button variant="contained" color="error" onClick={onConfirm} disabled={loading}>
          {loading ? "Eliminando…" : "Eliminar definitivamente"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

type NotesDialogProps = {
  open: boolean;
  cardName: string;
  notes: string;
  loading: boolean;
  error?: string;
  onChange: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
};

export function PropertyNotesDialog({
  open,
  cardName,
  notes,
  loading,
  error,
  onChange,
  onClose,
  onSave,
}: NotesDialogProps) {
  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Notas de propiedad</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {cardName}
        </Typography>
        <TextField
          label="Notas internas"
          placeholder="Motivo de retención, ubicación física, etc."
          value={notes}
          onChange={(e) => onChange(e.target.value)}
          multiline
          minRows={4}
          fullWidth
          disabled={loading}
        />
        {error ? (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        ) : null}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={loading}>
          Cancelar
        </Button>
        <Button variant="contained" onClick={onSave} disabled={loading}>
          {loading ? "Guardando…" : "Guardar notas"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function cardNameForSale(
  sale: KeepSale | null,
  stockMap: Record<string, { card_name?: string }>,
): string {
  if (!sale) return "";
  return stockMap[sale.stock_id]?.card_name || sale.card_id;
}
