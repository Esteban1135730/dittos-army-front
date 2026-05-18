import axios from "axios";
import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import {
  API_RESERVA,
  type ClientItem,
  type ImportWhatsAppImportResponse,
  type ImportWhatsAppPreviewResponse,
} from "./cliente-types";
import { clientNameDiffersFromMessage } from "./import-whatsapp-client-name";
import { formatCOP } from "../../utils/convert";

const ISSUE_LABELS: Record<string, string> = {
  missing_card_id: "Sin ID en la línea",
  insufficient_stock: "Stock insuficiente",
  no_pvp: "Sin PVP definido",
  invalid_line: "Línea no reconocida",
  race_or_unavailable: "Ya no disponible al importar",
};

function lineStatusLabel(line: ImportWhatsAppPreviewResponse["lines"][0]): string {
  if (line.matched === line.requested && line.requested > 0) return "OK";
  if (line.matched > 0) return "Parcial";
  return "Error";
}

type Props = {
  open: boolean;
  onClose: () => void;
  client: ClientItem;
  onImported: (summary: string) => void;
};

export default function ImportWhatsAppPedidoDialog({ open, onClose, client, onImported }: Props) {
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState<ImportWhatsAppPreviewResponse | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetState = () => {
    setPreview(null);
    setError(null);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handlePreview = async () => {
    const text = message.trim();
    if (!text) {
      setError("Pega el mensaje de WhatsApp del cliente.");
      return;
    }
    setPreviewing(true);
    setError(null);
    try {
      const res = await axios.post<ImportWhatsAppPreviewResponse>(
        `${API_RESERVA}/import-store-whatsapp/preview`,
        { client_id: client._id, message: text },
      );
      setPreview(res.data);
    } catch (e: unknown) {
      const msg =
        axios.isAxiosError(e) && typeof e.response?.data?.message === "string"
          ? e.response.data.message
          : "No se pudo analizar el mensaje.";
      setError(Array.isArray(msg) ? msg.join(", ") : msg);
      setPreview(null);
    } finally {
      setPreviewing(false);
    }
  };

  const handleImport = async () => {
    const text = message.trim();
    if (!text || !preview) return;
    const units = preview.summary.units_reserved;
    if (units <= 0) {
      setError("No hay unidades reservables en la vista previa.");
      return;
    }
    setImporting(true);
    setError(null);
    try {
      const res = await axios.post<ImportWhatsAppImportResponse>(
        `${API_RESERVA}/import-store-whatsapp`,
        { client_id: client._id, message: text },
      );
      const data = res.data;
      const createdCount = data.created.length;
      const skippedCount = data.skipped.length;
      let summary = `${createdCount} carta(s) reservada(s).`;
      if (skippedCount > 0) {
        summary += ` ${skippedCount} línea(s) con incidencias.`;
      }
      onImported(summary);
      setMessage("");
      resetState();
      onClose();
    } catch {
      setError("Error al importar las reservas.");
    } finally {
      setImporting(false);
    }
  };

  const nameMismatch =
    preview != null &&
    clientNameDiffersFromMessage(client.nombre, preview.client_name_from_message);

  const canImport = preview != null && preview.summary.units_reserved > 0;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>Importar desde WhatsApp</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          <Typography variant="body2" color="text.secondary">
            Pega el mensaje del carrito catálogo (cada línea debe incluir{" "}
            <strong>ID:</strong>). Las reservas se asignan a <strong>{client.nombre}</strong>.
          </Typography>
          <TextField
            label="Mensaje de WhatsApp"
            multiline
            minRows={8}
            maxRows={16}
            fullWidth
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              setPreview(null);
            }}
            placeholder="Hola, quiero reservar las siguientes cartas:…"
          />
          {error ? <Alert severity="error">{error}</Alert> : null}
          {nameMismatch ? (
            <Alert severity="warning">
              El mensaje dice «A nombre de: {preview?.client_name_from_message}», distinto del cliente
              abierto. Las cartas se reservarán igualmente a {client.nombre}.
            </Alert>
          ) : null}
          {preview ? (
            <Box sx={{ overflowX: "auto" }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Carta / ID</TableCell>
                    <TableCell align="right">Pedidas</TableCell>
                    <TableCell align="right">A reservar</TableCell>
                    <TableCell align="right">PVP COP</TableCell>
                    <TableCell>Estado</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {preview.lines.map((line) => (
                    <TableRow key={line.index}>
                      <TableCell sx={{ maxWidth: 280 }}>
                        <Typography variant="body2" noWrap title={line.raw}>
                          {line.parsed?.card_id ?? "—"}
                        </Typography>
                        {line.issues.length > 0 ? (
                          <Typography variant="caption" color="error">
                            {line.issues.map((i) => ISSUE_LABELS[i] ?? i).join("; ")}
                          </Typography>
                        ) : null}
                      </TableCell>
                      <TableCell align="right">{line.requested}</TableCell>
                      <TableCell align="right">{line.matched}</TableCell>
                      <TableCell align="right">
                        {line.precio_cop_por_unidad.length > 0
                          ? line.precio_cop_por_unidad.map((p) => formatCOP(p)).join(", ")
                          : "—"}
                      </TableCell>
                      <TableCell>{lineStatusLabel(line)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} color="inherit" disabled={previewing || importing}>
          Cancelar
        </Button>
        <Button onClick={handlePreview} variant="outlined" disabled={previewing || importing || !message.trim()}>
          {previewing ? <CircularProgress size={22} /> : "Vista previa"}
        </Button>
        <Button
          onClick={handleImport}
          variant="contained"
          disabled={!canImport || importing || previewing}
        >
          {importing ? <CircularProgress size={22} color="inherit" /> : "Importar reservas"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
