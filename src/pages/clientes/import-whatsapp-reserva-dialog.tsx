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
  MenuItem,
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
  type ImportUpcomingWhatsAppImportResponse,
  type ImportUpcomingWhatsAppLineResult,
  type ImportUpcomingWhatsAppPreviewResponse,
} from "./cliente-types";
import { clientNameDiffersFromMessage } from "./import-whatsapp-client-name";
import { extractAxiosErrorMessage } from "./extract-axios-error";
import { operationalRarezaLabel } from "../../constants/item-rareza";
import { CardThumb } from "../../components/card-thumb";
import { looksLikeTcgdexCardId, resolveCardImageSrc } from "./tcgdex-card-detail";
import { useTcgdexCardDetails } from "./use-tcgdex-card-details";

const STEPS = ["Pegar mensaje", "Revisar y PVP", "Confirmar"] as const;

const ISSUE_LABELS: Record<string, string> = {
  missing_card_id: "Sin ID en la línea",
  insufficient_incoming: "Sin cupo en camino",
  no_pvp: "Sin PVP (opcional)",
  invalid_line: "Línea no reconocida",
  ambiguous_rareza: "Hay varias variantes: elige una",
  race_or_unavailable: "Ya no hay cupo al importar",
  import_failed: "No se pudo reservar",
  not_matched: "Sin coincidencia",
};

const BASE_RAREZA = "__base__";

function lineStatusLabel(line: ImportUpcomingWhatsAppLineResult): string {
  if (line.issues.includes("ambiguous_rareza")) return "Elegir variante";
  if (line.matched === line.requested && line.requested > 0) return "OK";
  if (line.matched > 0) return "Parcial";
  return "Error";
}

function rarezaSelectValue(rareza: string | null | undefined): string {
  if (rareza == null || rareza === "") return BASE_RAREZA;
  return rareza;
}

function parseRarezaSelect(value: string): string | null {
  return value === BASE_RAREZA ? null : value;
}

function parsePvpDraft(raw: string | undefined): number | null {
  const t = raw?.trim() ?? "";
  if (!t) return null;
  const n = Number(t.replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n);
}

type Props = {
  open: boolean;
  onClose: () => void;
  client: ClientItem;
  onImported: (summary: string) => void;
};

export default function ImportWhatsAppReservaDialog({
  open,
  onClose,
  client,
  onImported,
}: Props) {
  const [step, setStep] = useState(0);
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState<ImportUpcomingWhatsAppPreviewResponse | null>(null);
  const [pvpDraft, setPvpDraft] = useState<Record<number, string>>({});
  const [rarezaDraft, setRarezaDraft] = useState<Record<number, string>>({});
  const [previewing, setPreviewing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetState = () => {
    setStep(0);
    setPreview(null);
    setPvpDraft({});
    setRarezaDraft({});
    setError(null);
  };

  const handleClose = () => {
    if (previewing || importing) return;
    setMessage("");
    resetState();
    onClose();
  };

  const applyPreview = (data: ImportUpcomingWhatsAppPreviewResponse) => {
    setPreview(data);
    const pvps: Record<number, string> = {};
    const rarezas: Record<number, string> = {};
    for (const line of data.lines) {
      pvps[line.index] =
        line.suggested_pvp_cop != null && line.suggested_pvp_cop > 0
          ? String(line.suggested_pvp_cop)
          : "";
      if (line.resolved_rareza != null) {
        rarezas[line.index] = rarezaSelectValue(line.resolved_rareza);
      } else if (line.available_variants.length === 1) {
        rarezas[line.index] = rarezaSelectValue(line.available_variants[0].rareza);
      } else {
        rarezas[line.index] = "";
      }
    }
    setPvpDraft(pvps);
    setRarezaDraft(rarezas);
  };

  const handlePreview = async () => {
    const text = message.trim();
    if (!text) {
      setError("Pega el mensaje de WhatsApp de Próximamente.");
      return;
    }
    setPreviewing(true);
    setError(null);
    try {
      const res = await axios.post<ImportUpcomingWhatsAppPreviewResponse>(
        `${API_RESERVA}/import-upcoming-whatsapp/preview`,
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

  const canImport = useMemo(() => {
    if (!preview) return false;
    return preview.lines.some((line) => {
      if (line.matched > 0 && !line.issues.includes("ambiguous_rareza")) return true;
      const chosen = rarezaDraft[line.index];
      return Boolean(chosen) && line.available_variants.some((v) => v.cupo > 0);
    });
  }, [preview, rarezaDraft]);

  const handleImport = async () => {
    const text = message.trim();
    if (!text || !preview) return;
    if (!canImport) {
      setError("No hay líneas reservables. Revisa cupo o elige variante.");
      return;
    }
    setImporting(true);
    setError(null);
    try {
      const res = await axios.post<ImportUpcomingWhatsAppImportResponse>(
        `${API_RESERVA}/import-upcoming-whatsapp`,
        {
          client_id: client._id,
          message: text,
          lines: preview.lines.map((line) => ({
            index: line.index,
            rareza: rarezaDraft[line.index]
              ? parseRarezaSelect(rarezaDraft[line.index])
              : line.resolved_rareza,
            pvp_cop: parsePvpDraft(pvpDraft[line.index]),
          })),
        },
      );
      const data = res.data;
      let summary = `${data.created.length} carta(s) en reserva.`;
      if (data.pvp_saved > 0) {
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
      setError(extractAxiosErrorMessage(e, "Error al importar la reserva."));
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

  const unitsToReserve = preview
    ? preview.lines.reduce((sum, line) => {
        if (line.matched > 0 && !line.issues.includes("ambiguous_rareza")) {
          return sum + line.matched;
        }
        const chosen = rarezaDraft[line.index];
        if (!chosen) return sum;
        const variant = line.available_variants.find(
          (v) => rarezaSelectValue(v.rareza) === chosen,
        );
        if (!variant) return sum;
        return sum + Math.min(line.requested, variant.cupo);
      }, 0)
    : 0;

  const previewCardIds = useMemo(
    () => (preview?.lines ?? []).map((line) => line.parsed?.card_id ?? ""),
    [preview],
  );
  const { detailsByCardId, isLoading: loadingCardImages } = useTcgdexCardDetails(previewCardIds);

  const lineThumb = (line: ImportUpcomingWhatsAppLineResult) => {
    const fromVariant = line.available_variants.find((v) => v.image_url?.trim())?.image_url;
    const src = resolveCardImageSrc(
      line.parsed?.card_id,
      line.image_url || fromVariant,
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
      <DialogTitle>Importar reserva desde WhatsApp</DialogTitle>
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
                Pega el mensaje de <strong>Próximamente</strong> (cada línea debe incluir{" "}
                <strong>ID:</strong>). Las cartas se apartan en camino para{" "}
                <strong>{client.nombre}</strong>, sin mezclarse con el pedido de stock.
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
                placeholder="Hola, quiero reservar / me interesan estas cartas de la sección Próximamente:…"
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
                El PVP es opcional y editable: si el mensaje o la carta ya lo tienen, aparece
                precargado. Ese valor queda en la reserva y se envía en el WhatsApp de confirmación.
              </Alert>
              <Box sx={{ overflowX: "auto" }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Carta</TableCell>
                      <TableCell align="right">Pedidas</TableCell>
                      <TableCell align="right">Cupo</TableCell>
                      <TableCell>Variante</TableCell>
                      <TableCell>PVP COP</TableCell>
                      <TableCell>Estado</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {preview.lines.map((line) => {
                      const blocking = line.issues.filter((i) => i !== "no_pvp");
                      const thumb = lineThumb(line);
                      return (
                        <TableRow key={line.index}>
                          <TableCell sx={{ maxWidth: 280 }}>
                            <Stack direction="row" spacing={1} alignItems="center">
                              <CardThumb
                                src={thumb.src}
                                alt={line.card_name ?? "Carta"}
                                size="md"
                                pending={thumb.pending}
                                enlargeOnHover={!!thumb.src}
                              />
                              <Box minWidth={0}>
                                <Typography variant="body2" noWrap title={line.raw}>
                                  {line.card_name ?? line.parsed?.card_id ?? "—"}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" display="block">
                                  {line.parsed?.card_id ?? "Sin ID"}
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
                          <TableCell align="right">
                            {line.available_variants.reduce((s, v) => s + v.cupo, 0)}
                          </TableCell>
                          <TableCell sx={{ minWidth: 160 }}>
                            {line.available_variants.length > 1 ? (
                              <TextField
                                select
                                size="small"
                                fullWidth
                                value={rarezaDraft[line.index] ?? ""}
                                onChange={(e) =>
                                  setRarezaDraft((prev) => ({
                                    ...prev,
                                    [line.index]: e.target.value,
                                  }))
                                }
                              >
                                <MenuItem value="">Elegir…</MenuItem>
                                {line.available_variants.map((v) => {
                                  const variantSrc = resolveCardImageSrc(
                                    line.parsed?.card_id,
                                    v.image_url,
                                    detailsByCardId,
                                    line.parsed?.language,
                                  );
                                  return (
                                  <MenuItem
                                    key={rarezaSelectValue(v.rareza)}
                                    value={rarezaSelectValue(v.rareza)}
                                  >
                                    <Stack direction="row" spacing={1} alignItems="center">
                                      <CardThumb
                                        src={variantSrc}
                                        alt={v.card_name}
                                        size="sm"
                                      />
                                      <span>
                                        {operationalRarezaLabel(v.rareza)} · {v.cupo} ud
                                      </span>
                                    </Stack>
                                  </MenuItem>
                                  );
                                })}
                              </TextField>
                            ) : (
                              <Typography variant="body2">
                                {operationalRarezaLabel(
                                  line.resolved_rareza ?? line.available_variants[0]?.rareza,
                                )}
                              </Typography>
                            )}
                          </TableCell>
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
                Se apartarán <strong>{unitsToReserve}</strong> unidad(es) en camino
                para <strong>{client.nombre}</strong>.
              </Typography>
              {pvpToSaveCount > 0 ? (
                <Typography variant="body2" color="text.secondary">
                  PVP a guardar: {pvpToSaveCount} línea(s). El resto queda sin precio en el mensaje
                  hasta que lo asignes en la reserva.
                </Typography>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Ningún PVP nuevo. Las cartas se reservan igual.
                </Typography>
              )}
              {preview.summary.lines_failed > 0 ? (
                <Alert severity="warning">
                  {preview.summary.lines_failed} línea(s) no se reservarán (sin cupo o sin
                  coincidencia).
                </Alert>
              ) : null}
              <Stack spacing={1.25}>
                {preview.lines
                  .filter((line) => line.matched > 0 || rarezaDraft[line.index])
                  .map((line) => {
                    const thumb = lineThumb(line);
                    return (
                      <Stack
                        key={line.index}
                        direction="row"
                        spacing={1.5}
                        alignItems="center"
                      >
                        <CardThumb
                          src={thumb.src}
                          alt={line.card_name ?? "Carta"}
                          size="lg"
                          pending={thumb.pending}
                          enlargeOnHover={!!thumb.src}
                        />
                        <Box minWidth={0}>
                          <Typography variant="body2" fontWeight={600} noWrap>
                            {line.card_name ?? line.parsed?.card_id ?? "Carta"}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {line.parsed?.card_id}
                            {line.matched > 0 ? ` · ${line.matched} ud` : ""}
                            {parsePvpDraft(pvpDraft[line.index]) != null
                              ? ` · PVP ${parsePvpDraft(pvpDraft[line.index])}`
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
            disabled={!canImport || unitsToReserve <= 0}
          >
            Siguiente
          </Button>
        ) : null}
        {step === 2 ? (
          <Button
            onClick={() => void handleImport()}
            variant="contained"
            disabled={!canImport || importing || unitsToReserve <= 0}
          >
            {importing ? <CircularProgress size={22} color="inherit" /> : "Importar reserva"}
          </Button>
        ) : null}
      </DialogActions>
    </Dialog>
  );
}
