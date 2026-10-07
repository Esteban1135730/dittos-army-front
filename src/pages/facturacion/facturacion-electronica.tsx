import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Chip,
  Divider,
  FormControl,
  FormControlLabel,
  FormHelperText,
  InputLabel,
  MenuItem,
  Paper,
  Select,
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
import { apiClient, getApiBaseUrl, isAxiosError } from "../../api/client";
import { API_CLIENT, type ClientItem } from "../clientes/cliente-types";
import {
  CO_DEPARTMENTS,
  FORM_STEPS,
  ID_DOCUMENT_TYPES,
  LEGAL_ORGANIZATION,
  LINE_PRESETS,
  PAYMENT_FORMS,
  PAYMENT_METHODS,
  TRIBUTE_CODES,
} from "./facturacion-electronica.constants";
import FacturacionProductosPicker from "./facturacion-productos-picker";
import {
  applyClientToForm,
  buildApiPayload,
  calcNitVerificationDigit,
  defaultForm,
  emptyLine,
  formatCop,
  formTotalCop,
  lineSubtotal,
  optionLabel,
  validateStep,
  type FacturaElectronicaForm,
  type InvoiceLineForm,
} from "./facturacion-electronica.utils";

type InvoiceResponse = Record<string, unknown>;

const inputProps = { size: "small" as const, fullWidth: true };

export default function FacturacionElectronicaPage() {
  const [activeStep, setActiveStep] = useState(0);
  const [form, setForm] = useState<FacturaElectronicaForm>(defaultForm);
  const [stepErrors, setStepErrors] = useState<string[]>([]);
  const [invoiceId, setInvoiceId] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageSeverity, setMessageSeverity] = useState<"success" | "error" | "info">(
    "info"
  );
  const [invoice, setInvoice] = useState<InvoiceResponse | null>(null);
  const [linkedClientId, setLinkedClientId] = useState<string | null>(null);
  const [linkedClientName, setLinkedClientName] = useState("");

  const { data: clients = [], isLoading: loadingClients } = useQuery<ClientItem[]>({
    queryKey: ["clientes-facturacion"],
    queryFn: async () => {
      const res = await apiClient.get<ClientItem[]>(API_CLIENT);
      return Array.isArray(res.data) ? res.data : [];
    },
  });

  const department = useMemo(
    () => CO_DEPARTMENTS.find((d) => d.code === form.departmentCode),
    [form.departmentCode]
  );

  const municipalities = department?.municipalities ?? [];
  const totalCop = useMemo(() => formTotalCop(form), [form]);
  const isNit = form.idDocumentCode === "31";
  const isCredito = form.paymentForm === "2";

  const patchForm = (patch: Partial<FacturaElectronicaForm>) =>
    setForm((prev) => ({ ...prev, ...patch }));

  const patchLine = (index: number, patch: Partial<InvoiceLineForm>) =>
    setForm((prev) => ({
      ...prev,
      lines: prev.lines.map((row, i) =>
        i === index ? { ...row, ...patch } : row
      ),
    }));

  const goNext = () => {
    const errors = validateStep(activeStep, form);
    setStepErrors(errors);
    if (errors.length > 0) return;
    setActiveStep((s) => Math.min(s + 1, FORM_STEPS.length - 1));
  };

  const goBack = () => {
    setStepErrors([]);
    setActiveStep((s) => Math.max(s - 1, 0));
  };

  const handleCalcDv = () => {
    const dv = calcNitVerificationDigit(form.identification);
    if (dv) patchForm({ dv });
  };

  const handlePersonKindChange = (personKind: "1" | "2") => {
    patchForm({
      personKind,
      idDocumentCode: personKind === "1" ? "31" : "13",
    });
  };

  const handleDepartmentChange = (code: string) => {
    const dept = CO_DEPARTMENTS.find((d) => d.code === code);
    const firstMun = dept?.municipalities[0]?.code ?? "";
    patchForm({ departmentCode: code, municipalityCode: firstMun });
  };

  const createInvoice = async () => {
    const allErrors = [0, 1, 2, 3].flatMap((s) => validateStep(s, form));
    setStepErrors(allErrors);
    if (allErrors.length > 0) {
      setMessage("Corrige los campos marcados antes de guardar.");
      setMessageSeverity("error");
      return;
    }

    setLoading(true);
    setMessage("");
    try {
      const res = await apiClient.post(`/billing/factus/invoice`, buildApiPayload(form));
      const created = res.data?.invoice as InvoiceResponse;
      setInvoice(created);
      const id = created?._id;
      if (typeof id === "string") setInvoiceId(id);
      setMessage("Borrador guardado en MongoDB (estado draft). Ya puedes enviar a Factus.");
      setMessageSeverity("success");
      setActiveStep(3);
    } catch {
      setMessage("No fue posible crear la factura. ¿Está el backend en marcha?");
      setMessageSeverity("error");
    } finally {
      setLoading(false);
    }
  };

  const sendInvoice = async () => {
    if (!invoiceId) return;
    setLoading(true);
    setMessage("");
    try {
      const res = await apiClient.post(
        `/billing/factus/invoice/${invoiceId}/send`
      );
      setInvoice(res.data?.invoice ?? null);
      setMessage("Enviado a Factus (o modo simulado si no hay token).");
      setMessageSeverity("success");
    } catch (err) {
      let detail = "No fue posible enviar la factura.";
      if (isAxiosError(err)) {
        const data = err.response?.data as {
          message?: string | string[] | { message?: string };
        };
        const raw = data?.message;
        if (typeof raw === "string") detail = raw;
        else if (Array.isArray(raw)) detail = raw.join(" ");
        else if (raw && typeof raw === "object" && "message" in raw) {
          detail = String(raw.message);
        }
      }
      setMessage(detail);
      setMessageSeverity("error");
    } finally {
      setLoading(false);
    }
  };

  const checkStatus = async () => {
    if (!invoiceId) return;
    setLoading(true);
    setMessage("");
    try {
      const res = await apiClient.get(
        `/billing/factus/invoice/${invoiceId}/status`
      );
      setInvoice(res.data?.invoice ?? null);
      setMessage("Estado actualizado desde Factus.");
      setMessageSeverity("success");
    } catch (err) {
      let detail = "No fue posible consultar el estado.";
      if (isAxiosError(err)) {
        const data = err.response?.data as { message?: string | string[] };
        const msg = data?.message;
        if (typeof msg === "string") detail = msg;
        else if (Array.isArray(msg)) detail = msg.join(" ");
      }
      setMessage(detail);
      setMessageSeverity("error");
    } finally {
      setLoading(false);
    }
  };

  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return (
          <Stack spacing={2.5}>
            <Alert severity="info" variant="outlined">
              Paso 1 — Datos del <strong>adquiriente</strong> (comprador), como en la
              factura electrónica DIAN. Puedes cargar un cliente de la tienda y completar
              identificación y ubicación.
            </Alert>

            <Autocomplete
              options={clients}
              loading={loadingClients}
              getOptionLabel={(c) => `${c.nombre} · ${c.tienda_entrega}`}
              onChange={(_, value) => {
                if (value) {
                  setForm((prev) => applyClientToForm(prev, value));
                  setLinkedClientId(value._id);
                  setLinkedClientName(value.nombre);
                } else {
                  setLinkedClientId(null);
                  setLinkedClientName("");
                }
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Cargar desde cliente de la tienda (opcional)"
                  placeholder="Buscar por nombre o tienda…"
                />
              )}
            />

            <FormControl fullWidth size="small">
              <InputLabel>Tipo de persona</InputLabel>
              <Select
                label="Tipo de persona"
                value={form.personKind}
                onChange={(e) =>
                  handlePersonKindChange(e.target.value as "1" | "2")
                }
              >
                {LEGAL_ORGANIZATION.map((o) => (
                  <MenuItem key={o.value} value={o.value}>
                    {o.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Tipo de documento</InputLabel>
                <Select
                  label="Tipo de documento"
                  value={form.idDocumentCode}
                  onChange={(e) =>
                    patchForm({ idDocumentCode: e.target.value })
                  }
                >
                  {ID_DOCUMENT_TYPES.map((o) => (
                    <MenuItem key={o.value} value={o.value}>
                      {o.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                {...inputProps}
                required
                label="Número de identificación"
                value={form.identification}
                onChange={(e) => patchForm({ identification: e.target.value })}
                helperText={
                  isNit
                    ? "Solo números del NIT, sin guión ni DV"
                    : "Sin puntos ni espacios"
                }
              />
              {isNit && (
                <Stack direction="row" spacing={1} sx={{ minWidth: 140 }}>
                  <TextField
                    {...inputProps}
                    required
                    label="DV"
                    value={form.dv}
                    onChange={(e) => patchForm({ dv: e.target.value })}
                    inputProps={{ maxLength: 1 }}
                  />
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={handleCalcDv}
                    sx={{ mt: 0.5, whiteSpace: "nowrap" }}
                  >
                    Calcular DV
                  </Button>
                </Stack>
              )}
            </Stack>

            {form.personKind === "2" ? (
              <TextField
                {...inputProps}
                required
                label="Nombres y apellidos"
                value={form.names}
                onChange={(e) => patchForm({ names: e.target.value })}
              />
            ) : (
              <>
                <TextField
                  {...inputProps}
                  required
                  label="Razón social"
                  value={form.company}
                  onChange={(e) => patchForm({ company: e.target.value })}
                />
                <TextField
                  {...inputProps}
                  label="Nombre comercial (opcional)"
                  value={form.tradeName}
                  onChange={(e) => patchForm({ tradeName: e.target.value })}
                />
              </>
            )}

            {form.personKind === "2" && (
              <TextField
                {...inputProps}
                label="Nombre comercial (opcional)"
                value={form.tradeName}
                onChange={(e) => patchForm({ tradeName: e.target.value })}
              />
            )}

            <FormControl fullWidth size="small">
              <InputLabel>Responsabilidad fiscal</InputLabel>
              <Select
                label="Responsabilidad fiscal"
                value={form.tributeCode}
                onChange={(e) => patchForm({ tributeCode: e.target.value })}
              >
                {TRIBUTE_CODES.map((o) => (
                  <MenuItem key={o.value} value={o.value}>
                    {o.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Divider />
            <Typography variant="subtitle2" color="text.secondary">
              Ubicación y contacto
            </Typography>

            <TextField
              {...inputProps}
              label="Dirección"
              value={form.address}
              onChange={(e) => patchForm({ address: e.target.value })}
            />

            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Departamento</InputLabel>
                <Select
                  label="Departamento"
                  value={form.departmentCode}
                  onChange={(e) => handleDepartmentChange(e.target.value)}
                >
                  {CO_DEPARTMENTS.map((d) => (
                    <MenuItem key={d.code} value={d.code}>
                      {d.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl fullWidth size="small" required>
                <InputLabel>Municipio (código DIAN)</InputLabel>
                <Select
                  label="Municipio (código DIAN)"
                  value={form.municipalityCode}
                  onChange={(e) =>
                    patchForm({ municipalityCode: e.target.value })
                  }
                >
                  {municipalities.map((m) => (
                    <MenuItem key={m.code} value={m.code}>
                      {m.name} ({m.code})
                    </MenuItem>
                  ))}
                </Select>
                <FormHelperText>Código enviado a Factus como municipio</FormHelperText>
              </FormControl>
            </Stack>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                {...inputProps}
                type="email"
                label="Correo (envío PDF/XML)"
                value={form.email}
                onChange={(e) => patchForm({ email: e.target.value })}
              />
              <TextField
                {...inputProps}
                label="Teléfono / WhatsApp"
                value={form.phone}
                onChange={(e) => patchForm({ phone: e.target.value })}
              />
            </Stack>
          </Stack>
        );

      case 1:
        return (
          <Stack spacing={2.5}>
            <Alert severity="info" variant="outlined">
              Paso 2 — Condiciones de <strong>pago</strong> y datos del documento
              (referencias, observaciones).
            </Alert>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <FormControl fullWidth size="small" required>
                <InputLabel>Forma de pago</InputLabel>
                <Select
                  label="Forma de pago"
                  value={form.paymentForm}
                  onChange={(e) => patchForm({ paymentForm: e.target.value })}
                >
                  {PAYMENT_FORMS.map((o) => (
                    <MenuItem key={o.value} value={o.value}>
                      {o.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl fullWidth size="small" required>
                <InputLabel>Método de pago</InputLabel>
                <Select
                  label="Método de pago"
                  value={form.paymentMethodCode}
                  onChange={(e) =>
                    patchForm({ paymentMethodCode: e.target.value })
                  }
                >
                  {PAYMENT_METHODS.map((o) => (
                    <MenuItem key={o.value} value={o.value}>
                      {o.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>

            {isCredito && (
              <TextField
                {...inputProps}
                required
                type="date"
                label="Fecha de vencimiento (crédito)"
                value={form.dueDate}
                onChange={(e) => patchForm({ dueDate: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            )}

            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                {...inputProps}
                label="Orden de pedido / compra (opcional)"
                value={form.orderReference}
                onChange={(e) => patchForm({ orderReference: e.target.value })}
              />
              <TextField
                {...inputProps}
                label="Referencia interna (reserva, venta…)"
                value={form.internalReference}
                onChange={(e) =>
                  patchForm({ internalReference: e.target.value })
                }
              />
            </Stack>

            <TextField
              {...inputProps}
              multiline
              minRows={2}
              label="Observaciones del documento"
              value={form.observation}
              onChange={(e) => patchForm({ observation: e.target.value })}
              helperText={`${form.observation.length}/250 — límite Factus`}
              inputProps={{ maxLength: 250 }}
            />

            <FormControlLabel
              control={
                <Checkbox
                  checked={form.sendEmail}
                  onChange={(e) => patchForm({ sendEmail: e.target.checked })}
                />
              }
              label="Enviar factura por correo al cliente (cuando Factus esté configurado)"
            />
          </Stack>
        );

      case 2:
        return (
          <Stack spacing={2}>
            <Alert severity="info" variant="outlined">
              Paso 3 — Elige las <strong>cartas vendidas o en reserva</strong> del cliente
              (precio automático) o añade líneas a mano. El total se calcula solo.
            </Alert>

            <FacturacionProductosPicker
              clientId={linkedClientId}
              clientName={linkedClientName}
              existingLines={form.lines}
              onApplyLines={(lines) => setForm((prev) => ({ ...prev, lines }))}
            />

            <Typography variant="subtitle2" color="text.secondary">
              Líneas de la factura (editable)
            </Typography>

            <Stack direction="row" flexWrap="wrap" gap={1}>
              {LINE_PRESETS.map((p) => (
                <Chip
                  key={p.label}
                  label={p.label}
                  size="small"
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      lines: [
                        ...prev.lines,
                        {
                          ...emptyLine(),
                          description: p.description,
                          codeReference: p.label.slice(0, 8).toUpperCase(),
                        },
                      ],
                    }))
                  }
                />
              ))}
              <Chip
                label="+ Línea vacía"
                size="small"
                color="primary"
                variant="outlined"
                onClick={() =>
                  setForm((prev) => ({
                    ...prev,
                    lines: [...prev.lines, emptyLine()],
                  }))
                }
              />
            </Stack>

            <Box sx={{ overflowX: "auto" }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Descripción</TableCell>
                    <TableCell width={90}>Cant.</TableCell>
                    <TableCell width={130}>V. unit. COP</TableCell>
                    <TableCell width={120}>Subtotal</TableCell>
                    <TableCell width={70} />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {form.lines.map((line, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <TextField
                          {...inputProps}
                          required
                          value={line.description}
                          onChange={(e) =>
                            patchLine(index, { description: e.target.value })
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          {...inputProps}
                          type="number"
                          inputProps={{ min: 1 }}
                          value={line.quantity}
                          onChange={(e) =>
                            patchLine(index, {
                              quantity: Number(e.target.value) || 1,
                            })
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          {...inputProps}
                          type="number"
                          inputProps={{ min: 0 }}
                          value={line.unitPriceCop || ""}
                          onChange={(e) =>
                            patchLine(index, {
                              unitPriceCop: Number(e.target.value) || 0,
                            })
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ py: 1 }}>
                          {formatCop(lineSubtotal(line))}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {form.lines.length > 1 && (
                          <Button
                            size="small"
                            color="error"
                            onClick={() =>
                              setForm((prev) => ({
                                ...prev,
                                lines: prev.lines.filter((_, i) => i !== index),
                              }))
                            }
                          >
                            Quitar
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>

            <Typography align="right" variant="h6">
              Total: {formatCop(totalCop)}
            </Typography>
          </Stack>
        );

      case 3:
      default:
        return (
          <Stack spacing={2}>
            <Alert severity="success" variant="outlined">
              Revisa el resumen. Al guardar se crea un <strong>borrador</strong> en MongoDB;
              después puedes <strong>enviar</strong> a Factus.
            </Alert>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Adquiriente
              </Typography>
              <Typography variant="body2">
                {form.personKind === "1"
                  ? form.company
                  : form.names}{" "}
                · {optionLabel(ID_DOCUMENT_TYPES, form.idDocumentCode)}{" "}
                {form.identification}
                {isNit && form.dv ? `-${form.dv}` : ""}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Municipio {form.municipalityCode} ·{" "}
                {optionLabel(TRIBUTE_CODES, form.tributeCode)}
              </Typography>
              <Divider sx={{ my: 1.5 }} />
              <Typography variant="subtitle2" gutterBottom>
                Pago
              </Typography>
              <Typography variant="body2">
                {optionLabel(PAYMENT_FORMS, form.paymentForm)} —{" "}
                {optionLabel(PAYMENT_METHODS, form.paymentMethodCode)}
                {isCredito && form.dueDate
                  ? ` · vence ${form.dueDate}`
                  : ""}
              </Typography>
              <Divider sx={{ my: 1.5 }} />
              <Typography variant="subtitle2" gutterBottom>
                {form.lines.length} ítem(s) — {formatCop(totalCop)}
              </Typography>
              <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                {form.lines.map((l, i) => (
                  <Typography component="li" variant="body2" key={i}>
                    {l.quantity} × {l.description} —{" "}
                    {formatCop(lineSubtotal(l))}
                  </Typography>
                ))}
              </Box>
            </Paper>
          </Stack>
        );
    }
  };

  return (
    <Box sx={{ maxWidth: 1100, mx: "auto", pb: 4, width: "100%" }}>
      <Typography variant="h4" gutterBottom>
        Facturación electrónica
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Formulario por pasos (cliente → pago → ítems → revisar). API:{" "}
        {getApiBaseUrl()}
      </Typography>

      <Alert severity="warning" sx={{ mb: 2 }}>
        Para emitir ante la DIAN con respuesta real de Factus hace falta configurar{" "}
        <code>FACTUS_API_TOKEN</code> en el backend y, en una siguiente fase, mapear el
        JSON al formato <strong>Factus v2</strong> (<code>/v2/bills/validate</code>).
        Si tienes token y <code>numbering_range_id</code>, compártelos para integrar el
        envío completo.
      </Alert>

      <Stack
        direction={{ xs: "column", lg: "row" }}
        spacing={3}
        alignItems="flex-start"
      >
        <Paper sx={{ p: { xs: 2, md: 3 }, flex: 1, width: "100%" }}>
          <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 3 }}>
            {FORM_STEPS.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          {stepErrors.length > 0 && (
            <Alert severity="error" sx={{ mb: 2 }}>
              <Box component="ul" sx={{ m: 0, pl: 2 }}>
                {stepErrors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </Box>
            </Alert>
          )}

          {renderStepContent()}

          <Stack
            direction="row"
            justifyContent="space-between"
            sx={{ mt: 3 }}
            flexWrap="wrap"
            gap={1}
          >
            <Button disabled={activeStep === 0 || loading} onClick={goBack}>
              Atrás
            </Button>
            <Stack direction="row" spacing={1}>
              {activeStep < FORM_STEPS.length - 1 ? (
                <Button variant="contained" onClick={goNext} disabled={loading}>
                  Siguiente
                </Button>
              ) : (
                <Button
                  variant="contained"
                  onClick={createInvoice}
                  disabled={loading}
                >
                  Guardar borrador
                </Button>
              )}
            </Stack>
          </Stack>
        </Paper>

        <Paper
          sx={{
            p: 2,
            width: { xs: "100%", lg: 300 },
            position: { lg: "sticky" },
            top: 16,
          }}
        >
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
            Resumen
          </Typography>
          <Typography variant="h5" color="primary.main">
            {formatCop(totalCop)}
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
            {form.lines.length} línea(s)
          </Typography>
          {invoiceId && (
            <Chip
              label={`ID: ${invoiceId.slice(-8)}…`}
              size="small"
              sx={{ mb: 1 }}
            />
          )}
          <Divider sx={{ my: 1.5 }} />
          <Typography variant="caption" color="text.secondary">
            Tras guardar, usa Enviar para Factus (sandbox o simulado).
          </Typography>
        </Paper>
      </Stack>

      <Paper sx={{ p: 2.5, mt: 3 }}>
        <Typography variant="h6" gutterBottom>
          Enviar y consultar
        </Typography>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems="center">
          <TextField
            {...inputProps}
            label="ID factura (MongoDB)"
            value={invoiceId}
            onChange={(e) => setInvoiceId(e.target.value)}
            sx={{ flex: 1 }}
          />
          <Button
            variant="contained"
            color="success"
            onClick={sendInvoice}
            disabled={loading || !invoiceId}
          >
            Enviar
          </Button>
          <Button
            variant="outlined"
            onClick={checkStatus}
            disabled={loading || !invoiceId}
          >
            Estado
          </Button>
        </Stack>
        {message && (
          <Alert severity={messageSeverity} sx={{ mt: 2 }}>
            {message}
          </Alert>
        )}
        {invoice && (
          <Box
            component="pre"
            sx={{
              mt: 2,
              p: 1.5,
              bgcolor: "grey.50",
              borderRadius: 1,
              fontSize: 11,
              maxHeight: 280,
              overflow: "auto",
            }}
          >
            {JSON.stringify(invoice, null, 2)}
          </Box>
        )}
      </Paper>
    </Box>
  );
}
