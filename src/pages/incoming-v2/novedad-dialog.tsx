import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from '@mui/material';
import type { PanelHomologItem } from '../../utils/sent-unit-homolog';

export type NovedadDialogSubmit = {
  notes: string;
  batchItemId?: string;
};

type NovedadDialogProps = {
  open: boolean;
  onClose: () => void;
  panelItems: PanelHomologItem[];
  onSubmit: (payload: NovedadDialogSubmit) => void | Promise<void>;
  isSubmitting?: boolean;
};

/** Formulario de novedad aislado: escribir notas no re-renderiza la página principal. */
export function NovedadDialog({
  open,
  onClose,
  panelItems,
  onSubmit,
  isSubmitting = false,
}: NovedadDialogProps) {
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const [batchItemId, setBatchItemId] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      if (notesRef.current) notesRef.current.value = '';
      setBatchItemId('');
      setLocalError(null);
    }
  }, [open]);

  const handleSubmit = async () => {
    const notes = notesRef.current?.value ?? '';
    if (!notes.trim()) {
      setLocalError('Escribe una nota para la novedad.');
      return;
    }
    setLocalError(null);
    await onSubmit({
      notes: notes.trim(),
      batchItemId: batchItemId || undefined,
    });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Marcar novedad</DialogTitle>
      <DialogContent>
        {localError ? (
          <Alert severity="error" sx={{ mt: 1, mb: 1 }}>
            {localError}
          </Alert>
        ) : null}
        <TextField
          fullWidth
          multiline
          minRows={3}
          label="Notas"
          inputRef={notesRef}
          defaultValue=""
          sx={{ mt: 1, mb: 2 }}
        />
        <TextField
          fullWidth
          select
          label="Ítem panel relacionado (opcional)"
          value={batchItemId}
          onChange={(e) => setBatchItemId(e.target.value)}
          SelectProps={{ native: true }}
        >
          <option value="">— Ninguno —</option>
          {panelItems.map((p) => (
            <option key={p.batch_item_id} value={p.batch_item_id}>
              {p.card_name} (disp. {p.available_in_session})
            </option>
          ))}
        </TextField>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button
          variant="contained"
          color="warning"
          onClick={() => void handleSubmit()}
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Guardando…' : 'Guardar novedad'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
