import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import {
  parseCartExportJsonText,
  type CardtraderCartExportPayload,
} from "../../utils/cardtrader-cart-transfer";

type Props = {
  open: boolean;
  importing: boolean;
  onClose: () => void;
  onConfirm: (payload: CardtraderCartExportPayload) => void;
};

export function ImportEstebanCartDialog({
  open,
  importing,
  onClose,
  onConfirm,
}: Props) {
  const [raw, setRaw] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setRaw("");
      setFileName(null);
      setParseError(null);
    }
  }, [open]);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const text = await file.text();
      setRaw(text);
      setFileName(file.name);
      setParseError(null);
    } catch {
      setParseError("No se pudo leer el archivo.");
    }
  };

  const handleConfirm = () => {
    try {
      const payload = parseCartExportJsonText(raw);
      setParseError(null);
      onConfirm(payload);
    } catch (e: unknown) {
      setParseError(e instanceof Error ? e.message : "JSON inválido.");
    }
  };

  return (
    <Dialog open={open} onClose={importing ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>Importar carrito de Esteban</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ mt: 0.5 }}>
          <Typography variant="body2" color="text.secondary">
            Carga o pega el JSON que Esteban exportó. Se añadirán a tu carrito las
            líneas que CardTrader acepte; las que no estén disponibles se omiten.
          </Typography>
          <Button variant="outlined" component="label" disabled={importing}>
            Elegir archivo JSON
            <input
              type="file"
              hidden
              accept="application/json,.json"
              onChange={(event) => {
                void handleFile(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
          </Button>
          {fileName ? (
            <Typography variant="caption" color="text.secondary">
              Archivo: {fileName}
            </Typography>
          ) : null}
          <TextField
            label="JSON del carrito"
            multiline
            minRows={8}
            maxRows={16}
            value={raw}
            disabled={importing}
            onChange={(event) => {
              setRaw(event.target.value);
              setParseError(null);
            }}
            placeholder='{"version":1,"sourceOwner":"esteban","items":[...]}'
          />
          {parseError ? <Alert severity="error">{parseError}</Alert> : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={importing}>
          Cancelar
        </Button>
        <Button variant="contained" onClick={handleConfirm} disabled={importing}>
          {importing ? "Importando…" : "Importar lo posible"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
