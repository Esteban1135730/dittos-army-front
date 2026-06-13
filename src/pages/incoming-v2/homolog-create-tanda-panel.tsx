import { useState } from 'react';
import { Alert, Button, Paper, TextField, Typography } from '@mui/material';

type HomologCreateTandaPanelProps = {
  pendingCount: number;
  totalUnits: number;
  isSubmitting: boolean;
  onCreate: (shippingTotalCop: number) => void | Promise<void>;
};

/** Bloque crear tanda con input de envío local. */
export function HomologCreateTandaPanel({
  pendingCount,
  totalUnits,
  isSubmitting,
  onCreate,
}: HomologCreateTandaPanelProps) {
  const [shippingInput, setShippingInput] = useState('');
  const [shippingError, setShippingError] = useState<string | null>(null);

  const handleCreate = () => {
    const val = parseFloat(shippingInput.replace(',', '.'));
    if (!Number.isFinite(val) || val <= 0) {
      setShippingError('Ingresa el total COP del envío.');
      return;
    }
    setShippingError(null);
    void onCreate(val);
  };

  const canCreate = pendingCount === 0 && totalUnits > 0 && !isSubmitting;

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="subtitle2" fontWeight={600} gutterBottom>
        Crear tanda
      </Typography>
      <TextField
        fullWidth
        size="small"
        label="Total COP envío"
        value={shippingInput}
        onChange={(e) => {
          setShippingInput(e.target.value);
          if (shippingError) setShippingError(null);
        }}
        placeholder="Ej: 350000"
        sx={{ mb: 1.5 }}
      />
      {shippingError ? (
        <Alert severity="error" sx={{ mb: 1.5 }}>
          {shippingError}
        </Alert>
      ) : null}
      <Button
        fullWidth
        variant="contained"
        color="success"
        disabled={!canCreate}
        onClick={handleCreate}
      >
        {isSubmitting
          ? 'Creando…'
          : pendingCount > 0
            ? `Faltan ${pendingCount} cartas`
            : 'Crear tanda'}
      </Button>
      {pendingCount > 0 ? (
        <Typography variant="caption" color="text.secondary" display="block" mt={1}>
          Verifica o marca novedad en todas las cartas sent antes de continuar.
        </Typography>
      ) : null}
    </Paper>
  );
}
