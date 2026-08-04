import { useState } from 'react';
import { Alert, Button, Paper, TextField, Typography } from '@mui/material';

type HomologCreateTandaPanelProps = {
  pendingCount: number;
  totalUnits: number;
  isSubmitting: boolean;
  novedadStockPending?: number;
  verifiedCount?: number;
  onCreate: (shippingTotalCop: number) => void | Promise<void>;
  title?: string;
  description?: string;
  createButtonLabel?: string;
};

/** Bloque crear tanda con input de envío local. */
export function HomologCreateTandaPanel({
  pendingCount,
  totalUnits,
  isSubmitting,
  novedadStockPending = 0,
  verifiedCount = 0,
  onCreate,
  title = 'Paso 2 · Crear tanda (solo verificadas)',
  description = 'Las cartas homologadas con inventario en camino entran en la tanda de llegada. Las novedades sin inventario ya deben estar en stock (paso 1).',
  createButtonLabel,
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

  const canCreate =
    pendingCount === 0 &&
    novedadStockPending === 0 &&
    verifiedCount > 0 &&
    !isSubmitting;

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="subtitle2" fontWeight={600} gutterBottom>
        {title}
      </Typography>
      <Typography variant="caption" color="text.secondary" display="block" mb={1.5}>
        {description}
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
            : novedadStockPending > 0
              ? `Pasa ${novedadStockPending} novedad(es) a stock`
              : verifiedCount === 0
                ? 'Sin cartas verificadas'
                : (createButtonLabel ?? 'Crear tanda')}
      </Button>
      {pendingCount > 0 ? (
        <Typography variant="caption" color="text.secondary" display="block" mt={1}>
          Verifica o marca novedad en todas las cartas sent antes de continuar.
        </Typography>
      ) : novedadStockPending > 0 ? (
        <Typography variant="caption" color="error" display="block" mt={1}>
          Primero crea las novedades en stock (paso 1 arriba).
        </Typography>
      ) : null}
    </Paper>
  );
}
