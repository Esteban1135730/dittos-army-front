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
  FormControl,
  FormControlLabel,
  Radio,
  RadioGroup,
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
  API_CLIENT,
  API_RESERVA,
  emptyClienteForm,
  type ClienteFormState,
  type ClientItem,
  type ImportWhatsAppImportResponse,
  type ImportWhatsAppLineResult,
  type ImportWhatsAppPreviewResponse,
} from "./cliente-types";
import {
  clientNameDiffersFromMessage,
  extractClientNameFromStoreMessage,
} from "./import-whatsapp-client-name";
import { importWhatsAppPedidoActionCopy } from "./import-whatsapp-delivery-label";
import { extractAxiosErrorMessage } from "./extract-axios-error";
import { formatWhatsAppLineOwners } from "./import-whatsapp-owner-label";
import { formatCOP } from "../../utils/convert";
import { operationalRarezaLabel } from "../../constants/item-rareza";
import { CardThumb } from "../../components/card-thumb";
import { looksLikeTcgdexCardId, resolveCardImageSrc } from "./tcgdex-card-detail";
import { useTcgdexCardDetails } from "./use-tcgdex-card-details";
import { clientItemId, normalizeClientItem } from "./cliente-id";

const STEPS = ["Pegar mensaje", "Cliente", "Revisar y PVP", "Confirmar"] as const;

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
  clientes: ClientItem[];
  onImported: (summary: string) => void;
};

export default function ImportWhatsAppFromListDialog({
  open,
  onClose,
  clientes,
  onImported,
}: Props) {
  const [step, setStep] = useState(0);
  const [message, setMessage] = useState("");
  const [clientMode, setClientMode] = useState<"nuevo" | "existente">("nuevo");
  const [form, setForm] = useState<ClienteFormState>(emptyClienteForm);
  const [clientFilter, setClientFilter] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [resolvedClient, setResolvedClient] = useState<ClientItem | null>(null);
  const [createdClient, setCreatedClient] = useState<ClientItem | null>(null);
  const [preview, setPreview] = useState<ImportWhatsAppPreviewResponse | null>(null);
  const [pvpDraft, setPvpDraft] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetState = () => {
    setStep(0);
    setPreview(null);
    setPvpDraft({});
    setError(null);
    setResolvedClient(null);
    setCreatedClient(null);
    setSelectedClientId(null);
    setClientFilter("");
    setClientMode("nuevo");
    setForm(emptyClienteForm());
  };

  const handleClose = () => {
    if (busy) return;
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

  const filteredClientes = useMemo(() => {
    const term = clientFilter.trim().toLowerCase();
    const list = term
      ? clientes.filter((c) => (c.nombre ?? "").toLowerCase().includes(term))
      : clientes;
    return [...list].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }, [clientes, clientFilter]);

  const unitsWithPrice = useMemo(() => {
    if (!preview) return 0;
    return preview.lines.reduce((sum, line) => {
      if (line.matched <= 0) return sum;
      const pvp = parsePvpDraft(pvpDraft[line.index]) ?? suggestedPvp(line);
      if (pvp == null || pvp <= 0) return sum;
      return sum + line.matched;
    }, 0);
  }, [preview, pvpDraft]);

  const blockedPagado = preview?.delivery?.pedido_action === "blocked_pagado";
  const canImport = unitsWithPrice > 0 && !blockedPagado;

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

  const goToClientStep = () => {
    const text = message.trim();
    if (!text) {
      setError("Pega el mensaje de WhatsApp de la compra en la tienda.");
      return;
    }
    setError(null);
    const fromMessage = extractClientNameFromStoreMessage(text);
    setForm((f) => ({ ...emptyClienteForm(), ...f, nombre: fromMessage ?? f.nombre }));
    setStep(1);
  };

  const createClient = async (): Promise<ClientItem> => {
    if (createdClient) return createdClient;
    if (!form.nombre.trim()) {
      throw new Error("El nombre es obligatorio.");
    }
    if (form.metodoContacto === "facebook" && !form.facebookUsuario.trim()) {
      throw new Error("Usuario de Facebook obligatorio para canal Facebook.");
    }
    const body = {
      nombre: form.nombre.trim(),
      celular: form.celular.trim() || undefined,
      metodo_contacto: form.metodoContacto,
      facebook_usuario:
        form.metodoContacto === "facebook" ? form.facebookUsuario.trim() : undefined,
      notas: form.notas.trim() || undefined,
    };
    const res = await axios.post(API_CLIENT, body);
    const created = normalizeClientItem(res.data);
    if (!created) {
      throw new Error("No se pudo crear el cliente.");
    }
    setCreatedClient(created);
    return created;
  };

  const handlePreview = async () => {
    const text = message.trim();
    if (!text) {
      setError("Pega el mensaje de WhatsApp de la compra en la tienda.");
      return;
    }

    let client: ClientItem | null = resolvedClient;
    if (clientMode === "nuevo") {
      try {
        setBusy(true);
        setError(null);
        client = createdClient ?? resolvedClient;
        if (!client) {
          client = await createClient();
        }
        setResolvedClient(client);
      } catch (e: unknown) {
        setError(
          axios.isAxiosError(e)
            ? extractAxiosErrorMessage(e, "No se pudo crear el cliente.")
            : e instanceof Error
              ? e.message
              : "No se pudo crear el cliente.",
        );
        setBusy(false);
        return;
      }
    } else {
      const picked = clientes.find((c) => clientItemId(c) === selectedClientId) ?? null;
      if (!picked) {
        setError("Elige un cliente existente.");
        return;
      }
      client = picked;
      setResolvedClient(picked);
    }

    setBusy(true);
    setError(null);
    try {
      const res = await axios.post<ImportWhatsAppPreviewResponse>(
        `${API_RESERVA}/import-store-whatsapp/preview`,
        { client_id: client._id, message: text },
      );
      applyPreview(res.data);
      setStep(2);
    } catch (e: unknown) {
      setError(extractAxiosErrorMessage(e, "No se pudo analizar el mensaje."));
      setPreview(null);
    } finally {
      setBusy(false);
    }
  };

  const handleImport = async () => {
    const text = message.trim();
    if (!text || !preview || !resolvedClient) return;
    if (!canImport) {
      setError(
        blockedPagado
          ? importWhatsAppPedidoActionCopy("blocked_pagado")
          : "No hay unidades con stock y PVP para importar.",
      );
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await axios.post<ImportWhatsAppImportResponse>(
        `${API_RESERVA}/import-store-whatsapp`,
        {
          client_id: resolvedClient._id,
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
      setBusy(false);
    }
  };

  const nameMismatch =
    preview != null &&
    resolvedClient != null &&
    clientNameDiffersFromMessage(resolvedClient.nombre, preview.client_name_from_message);

  const pvpToSaveCount = preview
    ? preview.lines.filter((l) => parsePvpDraft(pvpDraft[l.index]) != null).length
    : 0;

  const delivery = preview?.delivery;
  const canGoPreview =
    clientMode === "nuevo"
      ? Boolean(form.nombre.trim())
      : Boolean(selectedClientId);

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>Importar WhatsApp</DialogTitle>
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
                Pega el mensaje completo del carrito de la tienda (líneas con{" "}
                <strong>ID:</strong>). Luego eliges si el destinatario es un cliente
                nuevo o uno existente.
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
                  setResolvedClient(null);
                  setError(null);
                }}
                placeholder="Hola, quiero reservar las siguientes cartas:…"
              />
            </>
          ) : null}

          {step === 1 ? (
            <>
              <FormControl>
                <RadioGroup
                  row
                  value={clientMode}
                  onChange={(e) => {
                    setClientMode(e.target.value as "nuevo" | "existente");
                    setError(null);
                  }}
                >
                  <FormControlLabel value="nuevo" control={<Radio />} label="Cliente nuevo" />
                  <FormControlLabel
                    value="existente"
                    control={<Radio />}
                    label="Cliente existente"
                  />
                </RadioGroup>
              </FormControl>

              {clientMode === "nuevo" ? (
                <Stack spacing={2}>
                  {createdClient ? (
                    <Alert severity="info">
                      Cliente ya creado: {createdClient.nombre}. Si vuelves a
                      vista previa, se reutiliza este registro.
                    </Alert>
                  ) : null}
                  <TextField
                    label="Nombre"
                    required
                    fullWidth
                    value={form.nombre}
                    disabled={Boolean(createdClient)}
                    onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                  />
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                    <TextField
                      label="WhatsApp (número o @nick)"
                      fullWidth
                      value={form.celular}
                      onChange={(e) => setForm((f) => ({ ...f, celular: e.target.value }))}
                      helperText="Número (p. ej. 3001234567) o usuario @{nick}"
                    />
                    <TextField
                      select
                      label="Canal preferido"
                      fullWidth
                      value={form.metodoContacto}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          metodoContacto: e.target.value as "whatsapp" | "facebook",
                        }))
                      }
                      SelectProps={{ native: true }}
                    >
                      <option value="whatsapp">WhatsApp</option>
                      <option value="facebook">Facebook / Messenger</option>
                    </TextField>
                  </Stack>
                  {form.metodoContacto === "facebook" ? (
                    <TextField
                      label="Usuario de Facebook"
                      required
                      fullWidth
                      value={form.facebookUsuario}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, facebookUsuario: e.target.value }))
                      }
                      helperText="Sin @ ni URL"
                    />
                  ) : null}
                  <TextField
                    label="Notas internas"
                    fullWidth
                    multiline
                    minRows={3}
                    value={form.notas}
                    onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))}
                    helperText="Solo panel; no se envía al cliente automáticamente."
                  />
                </Stack>
              ) : (
                <Stack spacing={1.5}>
                  <TextField
                    size="small"
                    label="Buscar por nombre"
                    value={clientFilter}
                    onChange={(e) => setClientFilter(e.target.value)}
                    fullWidth
                  />
                  <Box
                    sx={{
                      maxHeight: 280,
                      overflowY: "auto",
                      border: 1,
                      borderColor: "divider",
                      borderRadius: 1,
                    }}
                  >
                    {filteredClientes.length === 0 ? (
                      <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                        No hay clientes que coincidan.
                      </Typography>
                    ) : (
                      filteredClientes.map((c) => {
                        const id = clientItemId(c);
                        const selected = selectedClientId === id;
                        return (
                          <Box
                            key={id}
                            component="button"
                            type="button"
                            onClick={() => setSelectedClientId(id)}
                            sx={{
                              display: "block",
                              width: "100%",
                              textAlign: "left",
                              border: 0,
                              borderBottom: 1,
                              borderColor: "divider",
                              px: 2,
                              py: 1.25,
                              cursor: "pointer",
                              bgcolor: selected ? "action.selected" : "transparent",
                              color: "text.primary",
                              "&:hover": { bgcolor: "action.hover" },
                            }}
                          >
                            <Typography variant="body2" fontWeight={selected ? 700 : 500}>
                              {c.nombre}
                            </Typography>
                            {c.celular ? (
                              <Typography variant="caption" color="text.secondary">
                                {c.celular}
                              </Typography>
                            ) : null}
                          </Box>
                        );
                      })
                    )}
                  </Box>
                </Stack>
              )}
            </>
          ) : null}

          {step === 2 && preview && resolvedClient ? (
            <>
              {nameMismatch ? (
                <Alert severity="warning">
                  El mensaje dice «A nombre de: {preview.client_name_from_message}»,
                  distinto del cliente {resolvedClient.nombre}. Se reservará a{" "}
                  {resolvedClient.nombre}.
                </Alert>
              ) : null}
              {blockedPagado ? (
                <Alert severity="error">
                  {importWhatsAppPedidoActionCopy("blocked_pagado")}
                </Alert>
              ) : null}
              <Alert severity="info">
                <Typography variant="body2" fontWeight={600}>
                  Entrega
                </Typography>
                <Typography variant="body2">
                  Tienda: {delivery?.store_name ?? (delivery?.store_id ? delivery.store_id : "no indicada")}
                  {delivery?.issues.includes("unknown_store_id") ? " (no reconocida)" : ""}
                </Typography>
                <Typography variant="body2">
                  Fecha: {delivery?.fecha_tentativa_entrega ?? "no indicada"}
                  {delivery?.issues.includes("invalid_fecha") ? " (inválida)" : ""}
                </Typography>
                {delivery?.pedido_action ? (
                  <Typography variant="body2" sx={{ mt: 0.5 }}>
                    {importWhatsAppPedidoActionCopy(delivery.pedido_action)}
                  </Typography>
                ) : null}
              </Alert>
              <Alert severity="info">
                El Precio del mensaje de la tienda se usa como PVP. Puedes ajustarlo o
                dejarlo vacío si esa línea no se va a importar.
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
                                  {line.card_name ??
                                    line.parsed?.card_name ??
                                    line.parsed?.card_id ??
                                    "—"}
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

          {step === 3 && preview && resolvedClient ? (
            <Stack spacing={1.5}>
              {blockedPagado ? (
                <Alert severity="error">
                  {importWhatsAppPedidoActionCopy("blocked_pagado")}
                </Alert>
              ) : null}
              <Typography variant="body2">
                Se reservarán <strong>{unitsWithPrice}</strong> unidad(es) de stock para{" "}
                <strong>{resolvedClient.nombre}</strong>.
              </Typography>
              {delivery?.pedido_action ? (
                <Typography variant="body2" color="text.secondary">
                  {importWhatsAppPedidoActionCopy(delivery.pedido_action)}
                </Typography>
              ) : null}
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
        <Button onClick={handleClose} color="inherit" disabled={busy}>
          Cancelar
        </Button>
        {step > 0 ? (
          <Button
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={busy}
          >
            Atrás
          </Button>
        ) : null}
        {step === 0 ? (
          <Button
            onClick={goToClientStep}
            variant="contained"
            disabled={busy || !message.trim()}
          >
            Siguiente
          </Button>
        ) : null}
        {step === 1 ? (
          <Button
            onClick={() => void handlePreview()}
            variant="contained"
            disabled={busy || !canGoPreview}
          >
            {busy ? <CircularProgress size={22} color="inherit" /> : "Siguiente"}
          </Button>
        ) : null}
        {step === 2 ? (
          <Button
            onClick={() => {
              setError(null);
              setStep(3);
            }}
            variant="contained"
            disabled={!canImport}
          >
            Siguiente
          </Button>
        ) : null}
        {step === 3 ? (
          <Button
            onClick={() => void handleImport()}
            variant="contained"
            disabled={!canImport || busy}
          >
            {busy ? <CircularProgress size={22} color="inherit" /> : "Importar"}
          </Button>
        ) : null}
      </DialogActions>
    </Dialog>
  );
}
