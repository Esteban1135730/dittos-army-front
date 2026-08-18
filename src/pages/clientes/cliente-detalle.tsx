import { useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  Paper,
  Snackbar,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import type { StockListItem } from "../../types/stock";
import { formatCOP } from "../../utils/convert";
import { CardThumb } from "../../components/card-thumb";
import ClienteFormDialog from "./cliente-form-dialog";
import {
  API_CLIENT,
  API_RESERVA,
  API_SALES,
  API_STOCK,
  ALERTA_HORAS_AMARILLO,
  ALERTA_HORAS_ROJO,
  type ClientItem,
  type ReservaIncomingItem,
  type ReservaItem,
  type VentaClienteRow,
} from "./cliente-types";
import {
  abrirWhatsAppConTexto,
  buildWhatsAppPedidoText,
} from "./mensaje-reserva-pedido";
import { useEtiquetasReservaPrint } from "./etiquetas-reserva-print";
import { downloadVentaClientePdf } from "./venta-cliente-pdf";
import {
  aggregateReservasTotales,
  gananciaEstimadaReservaCop,
  reservaLineQuantity,
} from "./clientes-resumen-pedidos";
import { useExchangeRates } from "../../utils/tasa";
import { resolveStockImageUrl } from "../../constants/bulk-product";

function formatFechaReserva(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function ClienteDetallePage() {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { convert } = useExchangeRates();
  const [formOpen, setFormOpen] = useState(false);
  const [finalizando, setFinalizando] = useState(false);
  const [waBusy, setWaBusy] = useState(false);
  const [copiandoTexto, setCopiandoTexto] = useState(false);
  const [imprimiendoEtiquetas, setImprimiendoEtiquetas] = useState(false);
  const [generandoPdfVenta, setGenerandoPdfVenta] = useState(false);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "error";
  }>({ open: false, message: "", severity: "success" });

  const show = (message: string, severity: "success" | "error" = "success") =>
    setSnackbar({ open: true, message, severity });

  const { data: client, isLoading, isError } = useQuery<ClientItem>({
    queryKey: ["client", clientId],
    queryFn: async () => {
      const res = await axios.get(`${API_CLIENT}/${clientId}`);
      return res.data;
    },
    enabled: !!clientId,
  });

  const { data: reservas = [] } = useQuery<ReservaItem[]>({
    queryKey: ["reservas", clientId],
    queryFn: async () => {
      const res = await axios.get(`${API_RESERVA}/client/${clientId}`);
      return Array.isArray(res.data) ? res.data : [];
    },
    enabled: !!clientId,
  });

  const { imprimir: ejecutarImpresionEtiquetasReserva, printArea: etiquetasReservaPrintArea } =
    useEtiquetasReservaPrint({
      clientName: client?.nombre ?? "",
      labelCount: reservas.length,
    });

  const { data: incomingCliente = [] } = useQuery<ReservaIncomingItem[]>({
    queryKey: ["reservas-incoming", clientId],
    queryFn: async () => {
      const res = await axios.get(`${API_RESERVA}/incoming`, { params: { client_id: clientId } });
      return Array.isArray(res.data) ? res.data : [];
    },
    enabled: !!clientId,
  });

  const { data: stockRaw = [] } = useQuery<StockListItem[]>({
    queryKey: ["stock"],
    queryFn: async () => {
      const res = await axios.get(API_STOCK);
      return Array.isArray(res.data) ? res.data : [];
    },
  });

  const stockMap = useMemo(() => {
    const m: Record<string, StockListItem> = {};
    stockRaw.forEach((s) => {
      m[s._id] = s;
    });
    return m;
  }, [stockRaw]);

  const { data: historialVentas = [], isLoading: historialLoading } = useQuery<VentaClienteRow[]>({
    queryKey: ["ventas-cliente", clientId],
    queryFn: async () => {
      const res = await axios.get(`${API_SALES}/by-client/${clientId}`, { params: { limit: 100 } });
      const d = res.data;
      if (Array.isArray(d)) return d;
      throw new Error("Historial no disponible");
    },
    enabled: !!clientId,
  });

  const reservasConStock = useMemo(
    () =>
      reservas.map((r) => {
        const st = stockMap[r.stock_id];
        return { reserva: r, stock: st };
      }),
    [reservas, stockMap],
  );

  const resumenReserva = useMemo(
    () => aggregateReservasTotales(reservas, stockMap, convert),
    [reservas, stockMap, convert],
  );

  const alertaPedido = useMemo(() => {
    if (reservas.length === 0) return null;
    const times = reservas
      .map((r) => (r.created_at ? new Date(r.created_at).getTime() : null))
      .filter((t): t is number => t != null && !Number.isNaN(t));
    const oldest = times.length ? Math.min(...times) : null;
    if (oldest == null) return null;
    const hours = (Date.now() - oldest) / 3600000;
    if (hours >= ALERTA_HORAS_ROJO) return "critico" as const;
    if (hours >= ALERTA_HORAS_AMARILLO) return "alerta" as const;
    return null;
  }, [reservas]);

  const construirTextoPedido = async (): Promise<string | null> => {
    if (!client) return null;
    if (reservas.length === 0 && incomingCliente.length === 0) return null;
    const lines = reservas.map((r) => {
      const st = stockMap[r.stock_id];
      return {
        card_id: st?.card_id ?? "",
        card_name: st?.card_name ?? "Carta",
        precio: r.precio,
        rareza: st?.rareza,
        quantity: reservaLineQuantity(r.quantity),
      };
    });
    const incomingLines = incomingCliente.map((x) => ({
      card_id: x.card_id ?? "",
      card_name: x.card_name ?? "Carta",
      quantity: x.quantity,
      rareza: x.rareza,
    }));
    return buildWhatsAppPedidoText({
      clientName: client.nombre,
      tiendaEntrega: client.tienda_entrega,
      lines,
      incomingLines: incomingLines.length ? incomingLines : undefined,
    });
  };

  const enviarWhatsApp = async () => {
    if (!client) return;
    setWaBusy(true);
    try {
      const texto = await construirTextoPedido();
      if (texto == null) return;
      abrirWhatsAppConTexto(client.celular, texto);
    } finally {
      setWaBusy(false);
    }
  };

  const copiarPedidoAlPortapapeles = async () => {
    setCopiandoTexto(true);
    try {
      const texto = await construirTextoPedido();
      if (texto == null) return;
      let copiado = false;
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(texto);
          copiado = true;
        }
      } catch {
        copiado = false;
      }
      if (!copiado) {
        const ta = document.createElement("textarea");
        ta.value = texto;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        try {
          copiado = document.execCommand("copy");
        } catch {
          copiado = false;
        }
        document.body.removeChild(ta);
      }
      if (copiado) {
        show("Texto del pedido copiado al portapapeles.", "success");
      } else {
        show("No se pudo copiar al portapapeles.", "error");
      }
    } finally {
      setCopiandoTexto(false);
    }
  };

  const abrirMessenger = () => {
    if (!client) return;
    const u = client.facebook_usuario?.trim().replace(/^@+/, "") ?? "";
    if (!u) return;
    window.open(`https://m.me/${encodeURIComponent(u)}`, "_blank", "noopener,noreferrer");
  };

  const imprimirEtiquetasReserva = async () => {
    if (reservas.length === 0) return;
    setImprimiendoEtiquetas(true);
    try {
      await ejecutarImpresionEtiquetasReserva();
    } catch {
      show("No se pudo cargar la imagen de la etiqueta.", "error");
    } finally {
      setImprimiendoEtiquetas(false);
    }
  };

  const generarPdfVenta = async () => {
    if (!client || reservas.length === 0) return;
    setGenerandoPdfVenta(true);
    try {
      const stockById: Record<
        string,
        {
          card_id: string;
          card_name: string;
          image_url?: string;
          rareza?: string | null;
        }
      > = {};
      reservas.forEach((r) => {
        const st = stockMap[r.stock_id];
        stockById[r.stock_id] = {
          card_id: st?.card_id ?? "",
          card_name: st?.card_name ?? "Carta",
          image_url: st?.image_url
            ? resolveStockImageUrl(st.card_id, st.image_url)
            : resolveStockImageUrl(st?.card_id, undefined),
          rareza: st?.rareza,
        };
      });
      const { imageFailures } = await downloadVentaClientePdf({
        clientName: client.nombre,
        tiendaEntrega: client.tienda_entrega,
        reservas: reservas.map((r) => ({
          stock_id: r.stock_id,
          precio: r.precio,
          currency: r.currency,
          quantity: reservaLineQuantity(r.quantity),
        })),
        stockById,
        convert,
      });
      if (imageFailures > 0) {
        show("PDF descargado. Algunas imágenes no se pudieron incluir.", "error");
      }
    } catch {
      show("No se pudo generar el PDF de venta.", "error");
    } finally {
      setGenerandoPdfVenta(false);
    }
  };

  const finalizarVenta = async () => {
    if (!clientId) return;
    setFinalizando(true);
    try {
      const res = await axios.post<{ success: boolean; vendidas?: number; error?: string }>(
        `${API_RESERVA}/client/${clientId}/finalizar-venta`,
      );
      const data = res.data;
      if (data.success) {
        show(`Venta finalizada: ${data.vendidas ?? 0} carta(s).`, "success");
        await queryClient.invalidateQueries({ queryKey: ["reservas", clientId] });
        await queryClient.invalidateQueries({ queryKey: ["reservas-incoming", clientId] });
        await queryClient.invalidateQueries({ queryKey: ["reservas"] });
        await queryClient.invalidateQueries({ queryKey: ["clientes"] });
        await queryClient.invalidateQueries({ queryKey: ["stock"] });
        await queryClient.invalidateQueries({ queryKey: ["sales-dashboard"] });
        await queryClient.invalidateQueries({ queryKey: ["ventas-cliente", clientId] });
      } else {
        show(data.error ?? "Error al finalizar.", "error");
      }
    } catch {
      show("Error al finalizar la venta.", "error");
    } finally {
      setFinalizando(false);
    }
  };

  if (!clientId) {
    return <Alert severity="error">Cliente no especificado.</Alert>;
  }

  if (isLoading) {
    return (
      <Stack alignItems="center" py={6}>
        <Alert severity="info">Cargando cliente…</Alert>
      </Stack>
    );
  }

  if (isError || !client) {
    return (
      <Stack spacing={2} sx={{ p: 3 }}>
        <Alert severity="error">No se encontró el cliente.</Alert>
        <Button component={Link} to="/clientes" variant="outlined">
          Volver al listado
        </Button>
      </Stack>
    );
  }

  return (
    <Stack spacing={3} sx={{ maxWidth: 900, mx: "auto", p: { xs: 2, sm: 3 } }}>
      <Stack direction="row" alignItems="center" flexWrap="wrap" gap={1}>
        <Button component={Link} to="/clientes" color="inherit" size="small">
          ← Clientes
        </Button>
        <Typography variant="h5" component="h1" fontWeight={700} sx={{ flex: 1, minWidth: 0 }}>
          {client.nombre}
        </Typography>
        <Button variant="outlined" size="small" onClick={() => setFormOpen(true)}>
          Editar datos
        </Button>
      </Stack>

      {alertaPedido && (
        <Alert severity={alertaPedido === "critico" ? "error" : "warning"}>
          Pedido abierto hace tiempo: revisa o contacta al cliente.
        </Alert>
      )}

      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          Datos principales
        </Typography>
        <Stack spacing={1}>
          <Typography>
            <strong>Tienda de entrega:</strong> {client.tienda_entrega}
          </Typography>
          <Typography>
            <strong>WhatsApp:</strong> {client.celular?.trim() || "—"}
          </Typography>
          <Typography>
            <strong>Canal:</strong>{" "}
            {client.metodo_contacto === "whatsapp" ? "WhatsApp" : "Facebook / Messenger"}
            {client.metodo_contacto === "facebook" && client.facebook_usuario
              ? ` · @${client.facebook_usuario.replace(/^@+/, "")}`
              : null}
          </Typography>
        </Stack>
        <Divider sx={{ my: 2 }} />
        <Stack direction="row" flexWrap="wrap" gap={1}>
          <Button
            variant="contained"
            color="success"
            disabled={(reservas.length === 0 && incomingCliente.length === 0) || waBusy}
            onClick={enviarWhatsApp}
          >
            {waBusy ? "…" : "WhatsApp (resumen pedido)"}
          </Button>
          <Button
            variant="outlined"
            disabled={(reservas.length === 0 && incomingCliente.length === 0) || copiandoTexto}
            onClick={copiarPedidoAlPortapapeles}
          >
            {copiandoTexto ? "…" : "Copiar texto"}
          </Button>
          {client.metodo_contacto === "facebook" && (
            <Button
              variant="contained"
              disabled={!client.facebook_usuario?.trim()}
              onClick={abrirMessenger}
              sx={{ bgcolor: "#1565c0" }}
            >
              Messenger
            </Button>
          )}
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          Notas internas
        </Typography>
        <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", color: "text.primary" }}>
          {client.notas?.trim() || "Sin notas."}
        </Typography>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1} mb={2}>
          <Typography variant="subtitle1" fontWeight={600}>
            Reserva actual
          </Typography>
          <Stack direction="row" flexWrap="wrap" gap={1}>
            <Button
              variant="contained"
              size="small"
              onClick={() => navigate(`/clientes/${clientId}/reservar`)}
            >
              Editar reserva
            </Button>
            <Button
              variant="outlined"
              size="small"
              color="warning"
              component={Link}
              to={`/clientes/${clientId}/reservar?camino=1`}
            >
              Cartas en camino
            </Button>
            <Tooltip title={reservas.length === 0 ? "Sin reservas en stock" : ""}>
              <span>
                <Button
                  variant="outlined"
                  size="small"
                  disabled={reservas.length === 0 || imprimiendoEtiquetas}
                  onClick={imprimirEtiquetasReserva}
                >
                  {imprimiendoEtiquetas ? "…" : "Imprimir etiquetas de reserva"}
                </Button>
              </span>
            </Tooltip>
            <Tooltip title={reservas.length === 0 ? "Sin reservas en stock" : ""}>
              <span>
                <Button
                  variant="outlined"
                  size="small"
                  disabled={reservas.length === 0 || generandoPdfVenta}
                  onClick={generarPdfVenta}
                >
                  {generandoPdfVenta ? "…" : "Generar PDF de venta"}
                </Button>
              </span>
            </Tooltip>
            <Button
              variant="contained"
              color="success"
              size="small"
              disabled={reservas.length === 0 || finalizando}
              onClick={finalizarVenta}
            >
              {finalizando ? "…" : "Finalizar venta"}
            </Button>
          </Stack>
        </Stack>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          sx={{
            mb: 2,
            px: 2,
            py: 1.25,
            borderRadius: 2,
            border: 1,
            borderColor: "divider",
            bgcolor: "grey.50",
          }}
        >
          <Box>
            <Typography variant="caption" color="text.secondary" display="block">
              Ventas esperadas
            </Typography>
            <Typography variant="body2" fontWeight={600}>
              {formatCOP(Math.round(resumenReserva.ventasEsperadasCop))}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary" display="block">
              Ganancia estimada
            </Typography>
            <Typography
              variant="body2"
              fontWeight={600}
              color={
                resumenReserva.gananciaEstimadaCop > 0
                  ? "success.main"
                  : resumenReserva.gananciaEstimadaCop < 0
                    ? "error.main"
                    : "text.primary"
              }
            >
              {formatCOP(Math.round(resumenReserva.gananciaEstimadaCop))}
            </Typography>
          </Box>
        </Stack>
        {reservasConStock.length === 0 ? (
          <Typography color="text.secondary" variant="body2">
            No hay líneas en el pedido. Usa «Editar reserva» para agregar cartas.
          </Typography>
        ) : (
          <Stack spacing={2}>
            {reservasConStock.map(({ reserva: r, stock: st }) => {
              const units = reservaLineQuantity(r.quantity);
              const gananciaLinea =
                gananciaEstimadaReservaCop(
                  r.precio,
                  r.currency ?? "COP",
                  st,
                  convert,
                ) * units;
              return (
              <Box
                key={r._id}
                sx={{
                  display: "flex",
                  gap: 2,
                  flexWrap: "wrap",
                  alignItems: "flex-start",
                  py: 1.5,
                  borderBottom: 1,
                  borderColor: "divider",
                  "&:last-of-type": { borderBottom: 0 },
                }}
              >
                <CardThumb
                  src={resolveStockImageUrl(st?.card_id, st?.image_url)}
                  alt={st?.card_name ?? "Carta"}
                  size="md"
                  enlargeOnHover
                />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Stack direction="row" alignItems="center" flexWrap="wrap" gap={0.75}>
                    <Typography fontWeight={600}>{st?.card_name ?? "Carta"}</Typography>
                    <Chip
                      size="small"
                      variant="outlined"
                      color={
                        gananciaLinea > 0 ? "success" : gananciaLinea < 0 ? "error" : "default"
                      }
                      label={`Ganancia: ${formatCOP(Math.round(gananciaLinea))}`}
                    />
                  </Stack>
                  <Typography variant="caption" color="text.secondary">
                    {st?.card_id}
                    {units > 1 ? ` · Cant.: ${units}` : ""}
                    {st?.rareza ? ` · ${st.rareza}` : ""}
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 0.5 }}>
                    {formatCOP(r.precio * units)}
                    {units > 1 ? ` (${formatCOP(r.precio)} c/u)` : ""}
                    {r.currency && r.currency !== "COP" ? ` (${r.currency})` : ""}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                    Reservado: {formatFechaReserva(r.created_at)}
                  </Typography>
                </Box>
              </Box>
              );
            })}
          </Stack>
        )}
      </Paper>

      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
        <Typography variant="subtitle1" fontWeight={600} gutterBottom>
          Historial de pedidos (ventas)
        </Typography>
        {historialLoading ? (
          <Typography color="text.secondary">Cargando…</Typography>
        ) : historialVentas.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Sin ventas enlazadas a este cliente (solo ventas registradas tras el enlace en sistema).
          </Typography>
        ) : (
          <Stack spacing={1} divider={<Divider flexItem />}>
            {historialVentas.map((v) => (
              <Stack key={v._id} direction="row" justifyContent="space-between" alignItems="baseline">
                <Typography variant="body2">{new Date(v.created_at).toLocaleString("es-CO")}</Typography>
                <Chip label={formatCOP(v.amount_cop)} size="small" />
              </Stack>
            ))}
          </Stack>
        )}
      </Paper>

      <ClienteFormDialog
        open={formOpen}
        mode="edit"
        client={client}
        onClose={() => setFormOpen(false)}
      />

      {etiquetasReservaPrintArea}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={5000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity={snackbar.severity}
          variant="filled"
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Stack>
  );
}
