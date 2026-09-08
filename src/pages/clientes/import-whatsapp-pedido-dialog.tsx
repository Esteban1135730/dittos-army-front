import axios from "axios";
import { useMemo, useState } from "react";
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
  Step,
  StepLabel,
  Stepper,
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
  type ImportWhatsAppLineResult,
  type ImportWhatsAppPreviewResponse,
} from "./cliente-types";
import { clientNameDiffersFromMessage } from "./import-whatsapp-client-name";
import { extractAxiosErrorMessage } from "./extract-axios-error";
import { formatWhatsAppLineOwners } from "./import-whatsapp-owner-label";
import { formatCOP } from "../../utils/convert";
import { operationalRarezaLabel } from "../../constants/item-rareza";
import { CardThumb } from "../../components/card-thumb";
import { looksLikeTcgdexCardId, resolveCardImageSrc } from "./tcgdex-card-detail";
import { useTcgdexCardDetails } from "./use-tcgdex-card-details";

const STEPS = ["Pegar mensaje", "Revisar y PVP", "Confirmar"] as const;

const ISSUE_LABELS: Record<string, string> = {
  missing_card_id: "Sin ID en la línea",
  insufficient_stock: "Stock insuficiente",
  no_pvp: "Sin PVP (opcional)",
  invalid_line: "Línea no reconocida",
  race_or_unavailable: "Ya no disponible al importar",
};

function lineStatusLabel(line: ImportWhatsAppLineResult): string {
  if (line.matched === line.requested && line.requested > 0) return "OK";
  if (line.matched > 0) return "Parcial";
  return "Error";
}

function parsePvpDraft(raw: string | undefined): number | null {
  const t = raw?.trim() ?? "";
  if (!t) return null;
  const n = Number(t.replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n);
}

function suggestedPvp(line: ImportWhatsAppLineResult): number | null {
  if (line.suggested_pvp_cop != null && line.suggested_pvp_cop > 0) {
    return line.suggested_pvp_cop;
  }
  const fromUnits = line.precio_cop_por_unidad.find((p) => p > 0);
  if (fromUnits != null) return fromUnits;
  if (line.parsed?.unit_price_cop != null && line.parsed.unit_price_cop > 0) {
    return line.parsed.unit_price_cop;
  }
  return null;
}

type Props = {
  open: boolean;
  onClose: () => void;
  client: ClientItem;
  onImported: (summary: string) => void;
};

export default function ImportWhatsAppPedidoDialog({ open, onClose, client, onImported }: Props) {
  const [step, setStep] = useState(0);
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState<ImportWhatsAppPreviewResponse | null>(null);
  const [pvpDraft, setPvpDraft] = useState<Record<number, string>>({});
  const [previewing, setPreviewing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetState = () => {
    setStep(0);
    setPreview(null);
    setPvpDraft({});
    setError(null);
  };

  const handleClose = () => {
    if (previewing || importing) return;
    setMessage("");
    resetState();
    onClose();
  };

  const applyPreview = (data: ImportWhatsAppPreviewResponse) => {
    setPreview(data);
    const pvps: Record<number, string> = {};
    for (const line of data.lines) {
      const suggested = suggestedPvp(line);
      pvps[line.index] = suggested != null ? String(suggested) : "";
    }
    setPvpDraft(pvps);
  };

  const handlePreview = async () => {
    const text = message.trim();
    if (!text) {
      setError("Pega el mensaje de WhatsApp de la compra en la tienda.");
      return;
    }
    setPreviewing(true);
    setError(null);
    try {
      const res = await axios.post<ImportWhatsAppPreviewResponse>(
        `${API_RESERVA}/import-store-whatsapp/preview`,
        { client_id: client._id, message: text },
      );
      applyPreview(res.data);
      setStep(1);
    } catch (e: unknown) {
      setError(extractAxiosErrorMessage(e, "No se pudo analizar el mensaje."));
      setPreview(null);
    } finally {
      setPreviewing(false);
    }
  };

  const unitsWithPrice = useMemo(() => {
    if (!preview) return 0;
    return preview.lines.reduce((sum, line) => {
      if (line.matched <= 0) return sum;
      const pvp = parsePvpDraft(pvpDraft[line.index]) ?? suggestedPvp(line);
      if (pvp == null || pvp <= 0) return sum;
      return sum + line.matched;
    }, 0);
  }, [preview, pvpDraft]);

  const canImport = unitsWithPrice > 0;

  const handleImport = async () => {
    const text = message.trim();
    if (!text || !preview) return;
    if (!canImport) {
      setError("No hay unidades con stock y PVP para importar.");
      return;
    }
    setImporting(true);
    setError(null);
    try {
      const res = await axios.post<ImportWhatsAppImportResponse>(
        `${API_RESERVA}/import-store-whatsapp`,
        {
          client_id: client._id,
          message: text,
          lines: preview.lines.map((line) => ({
            index: line.index,
            pvp_cop: parsePvpDraft(pvpDraft[line.index]),
          })),
        },
      );
      const data = res.data;
      let summary = `${data.created.length} carta(s) del catálogo reservada(s).`;
      if ((data.pvp_saved ?? 0) > 0) {
        summary += ` PVP guardado en ${data.pvp_saved} línea(s).`;
      }
      if (data.skipped.length > 0) {
        summary += ` ${data.skipped.length} línea(s) con incidencias.`;
      }
      onImported(summary);
      setMessage("");
      resetState();
      onClose();
    } catch (e: unknown) {
      setError(extractAxiosErrorMessage(e, "Error al importar la compra."));
    } finally {
      setImporting(false);
    }
  };

  const nameMismatch =
    preview != null &&
    clientNameDiffersFromMessage(client.nombre, preview.client_name_from_message);

  const pvpToSaveCount = preview
    ? preview.lines.filter((l) => parsePvpDraft(pvpDraft[l.index]) != null).length
    : 0;

  const previewCardIds = useMemo(
    () => (preview?.lines ?? []).map((line) => line.parsed?.card_id ?? ""),
    [preview],
  );
  const { detailsByCardId, isLoading: loadingCardImages } = useTcgdexCardDetails(previewCardIds);

  const lineThumb = (line: ImportWhatsAppLineResult) => {
    const src = resolveCardImageSrc(
      line.parsed?.card_id,
      line.image_url,
      detailsByCardId,
      line.parsed?.language,
    );
    return {
      src,
      pending: loadingCardImages && !src && looksLikeTcgdexCardId(line.parsed?.card_id),
    };
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>Importar compra desde WhatsApp</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          <Stepper activeStep={step} alternativeLabel>
            {STEPS.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          {step === 0 ? (
            <>
              <Typography variant="body2" color="text.secondary">
                Pega el mensaje del <strong>carrito de la tienda</strong> (compras del catálogo, cada
                línea con <strong>ID:</strong> y Precio). Las cartas se reservan en el pedido de stock
                de <strong>{client.nombre}</strong>, no en la reserva en camino.
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
                  setError(null);
                }}
                placeholder="Hola, quiero reservar las siguientes cartas:…"
              />
            </>
          ) : null}

          {step === 1 && preview ? (
            <>
              {nameMismatch ? (
                <Alert severity="warning">
                  El mensaje dice «A nombre de: {preview.client_name_from_message}», distinto del
                  cliente abierto. Se reservará a {client.nombre}.
                </Alert>
              ) : null}
              <Alert severity="info">
                El Precio del mensaje de la tienda se usa como PVP. Puedes ajustarlo o dejarlo vacío
                si esa línea no se va a importar. No es obligatorio guardar PVP nuevo.
              </Alert>
              <Box sx={{ overflowX: "auto" }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Carta</TableCell>
                      <TableCell align="right">Pedidas</TableCell>
                      <TableCell align="right">En stock</TableCell>
                      <TableCell>PVP COP</TableCell>
                      <TableCell>Owner</TableCell>
                      <TableCell>Estado</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {preview.lines.map((line) => {
                      const blocking = line.issues.filter((i) => i !== "no_pvp");
                      const thumb = lineThumb(line);
                      return (
                        <TableRow key={line.index}>
                          <TableCell sx={{ maxWidth: 320 }}>
                            <Stack direction="row" spacing={1.25} alignItems="center">
                              <CardThumb
                                src={thumb.src}
                                alt={line.card_name ?? line.parsed?.card_name ?? "Carta"}
                                size="md"
                                pending={thumb.pending}
                                enlargeOnHover={!!thumb.src}
                              />
                              <Box minWidth={0}>
                            <Typography variant="body2" noWrap title={line.raw}>
                              {line.card_name ?? line.parsed?.card_name ?? line.parsed?.card_id ?? "—"}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" display="block">
                              {line.parsed?.card_id ?? "Sin ID"}
                              {line.parsed?.rareza
                                ? ` · ${operationalRarezaLabel(line.parsed.rareza)}`
                                : ""}
                            </Typography>
                            {blocking.length > 0 ? (
                              <Typography variant="caption" color="error">
                                {blocking.map((i) => ISSUE_LABELS[i] ?? i).join("; ")}
                              </Typography>
                            ) : line.issues.includes("no_pvp") ? (
                              <Typography variant="caption" color="text.secondary">
                                {ISSUE_LABELS.no_pvp}
                              </Typography>
                            ) : null}
                              </Box>
                            </Stack>
                          </TableCell>
                          <TableCell align="right">{line.requested}</TableCell>
                          <TableCell align="right">{line.matched}</TableCell>
                          <TableCell sx={{ minWidth: 120 }}>
                            <TextField
                              size="small"
                              label="Opcional"
                              value={pvpDraft[line.index] ?? ""}
                              onChange={(e) => {
                                const value = e.target.value;
                                if (value === "" || /^[0-9]*[.,]?[0-9]*$/.test(value)) {
                                  setPvpDraft((prev) => ({
                                    ...prev,
                                    [line.index]: value.replace(",", "."),
                                  }));
                                }
                              }}
                              placeholder="Sin PVP"
                              slotProps={{ htmlInput: { inputMode: "decimal" } }}
                            />
                            {suggestedPvp(line) != null ? (
                              <Typography variant="caption" color="text.secondary" display="block">
                                Tienda: {formatCOP(suggestedPvp(line)!)}
                              </Typography>
                            ) : null}
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption">
                              {formatWhatsAppLineOwners(line.stock_owners) || "—"}
                            </Typography>
                          </TableCell>
                          <TableCell>{lineStatusLabel(line)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </Box>
            </>
          ) : null}

          {step === 2 && preview ? (
            <Stack spacing={1.5}>
              <Typography variant="body2">
                Se reservarán <strong>{unitsWithPrice}</strong> unidad(es) de stock en el pedido de{" "}
                <strong>{client.nombre}</strong>.
              </Typography>
              {pvpToSaveCount > 0 ? (
                <Typography variant="body2" color="text.secondary">
                  PVP a guardar: {pvpToSaveCount} línea(s).
                </Typography>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Ningún PVP nuevo. Las líneas con precio del mensaje se importan igual.
                </Typography>
              )}
              {preview.summary.lines_failed > 0 ? (
                <Alert severity="warning">
                  {preview.summary.lines_failed} línea(s) no se reservarán (sin stock o sin
                  coincidencia).
                </Alert>
              ) : null}
              <Stack spacing={1.25}>
                {preview.lines.map((line) => {
                  const thumb = lineThumb(line);
                  const pvp = parsePvpDraft(pvpDraft[line.index]) ?? suggestedPvp(line);
                  return (
                    <Stack key={line.index} direction="row" spacing={1.5} alignItems="center">
                      <CardThumb
                        src={thumb.src}
                        alt={line.card_name ?? line.parsed?.card_name ?? "Carta"}
                        size="lg"
                        pending={thumb.pending}
                        enlargeOnHover={!!thumb.src}
                      />
                      <Box minWidth={0}>
                        <Typography variant="body2" fontWeight={600} noWrap>
                          {line.card_name ?? line.parsed?.card_name ?? line.parsed?.card_id ?? "Carta"}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {line.parsed?.card_id}
                          {line.matched > 0 ? ` · ${line.matched} ud` : " · sin stock"}
                          {pvp != null ? ` · PVP ${formatCOP(pvp)}` : ""}
                          {formatWhatsAppLineOwners(line.stock_owners)
                            ? ` · ${formatWhatsAppLineOwners(line.stock_owners)}`
                            : ""}
                        </Typography>
                      </Box>
                    </Stack>
                  );
                })}
              </Stack>
            </Stack>
          ) : null}

          {error ? <Alert severity="error">{error}</Alert> : null}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} color="inherit" disabled={previewing || importing}>
          Cancelar
        </Button>
        {step > 0 ? (
          <Button
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={previewing || importing}
          >
            Atrás
          </Button>
        ) : null}
        {step === 0 ? (
          <Button
            onClick={() => void handlePreview()}
            variant="contained"
            disabled={previewing || !message.trim()}
          >
            {previewing ? <CircularProgress size={22} color="inherit" /> : "Siguiente"}
          </Button>
        ) : null}
        {step === 1 ? (
          <Button
            onClick={() => {
              setError(null);
              setStep(2);
            }}
            variant="contained"
            disabled={!canImport}
          >
            Siguiente
          </Button>
        ) : null}
        {step === 2 ? (
          <Button
            onClick={() => void handleImport()}
            variant="contained"
            disabled={!canImport || importing}
          >
            {importing ? <CircularProgress size={22} color="inherit" /> : "Importar compra"}
          </Button>
        ) : null}
      </DialogActions>
    </Dialog>
  );
}
