import { useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Snackbar,
  Stack,
  Typography,
} from "@mui/material";
import type { StockListItem } from "../../types/stock";
import { LoadingScreen } from "../../components/loading";
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
import { downloadVentaClientePdf } from "./venta-cliente-pdf";
import {
  aggregateReservasTotales,
  reservaLineQuantity,
} from "./clientes-resumen-pedidos";
import { useExchangeRates } from "../../utils/tasa";
import { resolveStockImageUrl } from "../../constants/bulk-product";
import { extractAxiosErrorMessage } from "./extract-axios-error";
import NuevoPedidoDialog from "./nuevo-pedido-dialog";
import PedidoActivoPanel from "./pedido-activo-panel";
import PedidoHistorialSection from "./pedido-historial-section";
import { buildHistorialClienteView } from "./cliente-historial-merge";
import { API_PEDIDO, findPedidoAbierto, findPedidoReservado, pedidoId, type PedidoItem } from "./pedido-types";
import {
  descripcionEntrega,
  formatFechaTentativa,
} from "./pedido-entrega-label";
import { normalizeClientItem } from "./cliente-id";
import { fetchPedidosByClient, isPedidoApiLikelyMissing } from "./fetch-pedidos";
import {
  clientesActionRowSx,
  clientesDetailGridSx,
  clientesMutedLabelSx,
  clientesPageSx,
  clientesSectionBodySx,
  clientesSectionHeaderSx,
  clientesSectionPaperSx,
  clientesToolbarSx,
} from "./clientes-page-layout";

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
  const queryClient = useQueryClient();
  const { convert } = useExchangeRates();
  const [formOpen, setFormOpen] = useState(false);
  const [pedidoDialog, setPedidoDialog] = useState<"create" | "edit" | null>(null);
  const [pedidoEditTarget, setPedidoEditTarget] = useState<PedidoItem | null>(null);
  const [confirm, setConfirm] = useState<{
    title: string;
    body: string;
    action: () => Promise<void>;
  } | null>(null);
  const [finalizando, setFinalizando] = useState(false);
  const [waBusy, setWaBusy] = useState(false);
  const [copiandoTexto, setCopiandoTexto] = useState(false);
  const [generandoPdfVenta, setGenerandoPdfVenta] = useState(false);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "error";
  }>({ open: false, message: "", severity: "success" });

  const show = (message: string, severity: "success" | "error" = "success") =>
    setSnackbar({ open: true, message, severity });

  const { data: client, isLoading, isError, error: clientError } = useQuery<ClientItem>({
    queryKey: ["client", clientId],
    queryFn: async () => {
      const res = await axios.get(`${API_CLIENT}/${clientId}`);
      const normalized = normalizeClientItem(res.data);
      if (!normalized) {
        throw new Error("Cliente no encontrado en el servidor.");
      }
      return normalized;
    },
    enabled: !!clientId,
    retry: false,
  });

  const {
    data: pedidos = [],
    isError: pedidosApiError,
    error: pedidosError,
  } = useQuery<PedidoItem[]>({
    queryKey: ["pedidos", clientId],
    queryFn: () => fetchPedidosByClient(clientId!),
    enabled: !!clientId,
    retry: false,
  });

  const pedidoAbierto = findPedidoAbierto(pedidos);
  const pedidoReservado = findPedidoReservado(pedidos);

  const { data: reservas = [] } = useQuery<ReservaItem[]>({
    queryKey: ["reservas", clientId],
    queryFn: async () => {
      const res = await axios.get(`${API_RESERVA}/client/${clientId}`);
      return Array.isArray(res.data) ? res.data : [];
    },
    enabled: !!clientId,
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
      const res = await axios.get(`${API_SALES}/by-client/${clientId}`, { params: { limit: 200 } });
      const d = res.data;
      if (Array.isArray(d)) return d;
      return [];
    },
    enabled: !!clientId,
  });

  const historialCompleto = useMemo(
    () => buildHistorialClienteView(pedidos, historialVentas, clientId ?? ""),
    [pedidos, historialVentas, clientId],
  );

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
      descripcionEntrega: descripcionEntrega(pedidoAbierto),
      lines,
      incomingLines: incomingLines.length ? incomingLines : undefined,
    });
  };

  const enviarWhatsApp = async () => {
    if (!client || !clientId) return;
    setWaBusy(true);
    try {
      const texto = await construirTextoPedido();
      if (texto == null) return;
      abrirWhatsAppConTexto(client.celular, texto);
      show("Se abrió WhatsApp con el resumen del pedido.", "success");
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
        descripcionEntrega: descripcionEntrega(pedidoAbierto),
        fechaTentativa: formatFechaTentativa(pedidoAbierto?.fecha_tentativa_entrega),
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

  const invalidarPedidoQueries = async () => {
    if (!clientId) return;
    await queryClient.invalidateQueries({ queryKey: ["pedidos", clientId] });
    await queryClient.invalidateQueries({ queryKey: ["reservas", clientId] });
    await queryClient.invalidateQueries({ queryKey: ["reservas"] });
    await queryClient.invalidateQueries({ queryKey: ["clientes"] });
    await queryClient.invalidateQueries({ queryKey: ["stock"] });
    await queryClient.invalidateQueries({ queryKey: ["sales-dashboard"] });
    await queryClient.invalidateQueries({ queryKey: ["ventas-cliente", clientId] });
  };

  const pagarPedido = async (pedido: PedidoItem) => {
    if (!clientId) return;
    setFinalizando(true);
    try {
      await axios.post(`${API_PEDIDO}/${pedidoId(pedido)}/pagar`);
      show(`Pedido marcado como pagado (${pedido.lines.length} línea(s)).`, "success");
      await invalidarPedidoQueries();
    } catch (err) {
      show(extractAxiosErrorMessage(err, "Error al marcar pagado."), "error");
    } finally {
      setFinalizando(false);
    }
  };

  const entregarPedido = async (pedido: PedidoItem) => {
    if (!clientId) return;
    setFinalizando(true);
    try {
      await axios.post(`${API_PEDIDO}/${pedidoId(pedido)}/entregar`);
      show("Pedido marcado como entregado.", "success");
      await invalidarPedidoQueries();
    } catch (err) {
      show(extractAxiosErrorMessage(err, "Error al marcar entregado."), "error");
    } finally {
      setFinalizando(false);
    }
  };

  const cancelarPedido = async (pedido: PedidoItem) => {
    if (!clientId) return;
    setFinalizando(true);
    try {
      await axios.delete(`${API_PEDIDO}/${pedidoId(pedido)}`);
      show("Pedido cancelado y stock liberado.", "success");
      await invalidarPedidoQueries();
    } catch (err) {
      show(extractAxiosErrorMessage(err, "Error al cancelar el pedido."), "error");
    } finally {
      setFinalizando(false);
    }
  };

  if (!clientId) {
    return <Alert severity="error">Cliente no especificado.</Alert>;
  }

  if (isLoading) {
    return <LoadingScreen message="Cargando cliente…" />;
  }

  if (isError || !client) {
    const detail = extractAxiosErrorMessage(
      clientError,
      clientError instanceof Error ? clientError.message : "No se encontró el cliente.",
    );
    return (
      <Stack spacing={2} sx={{ p: 3, maxWidth: 560, mx: "auto" }}>
        <Alert severity="error">
          {detail}
          {clientId ? (
            <>
              {" "}
              (id: <code>{clientId}</code>)
            </>
          ) : null}
        </Alert>
        <Typography variant="body2" color="text.secondary">
          El modelo de cliente no cambió: solo dejó de usarse <strong>tienda_entrega</strong> a nivel
          cliente (ahora va en cada pedido). Si ves este error, revisa que el backend esté corriendo y
          que el id en la URL sea válido.
        </Typography>
        <Button component={Link} to="/clientes" variant="outlined">
          Volver al listado
        </Button>
      </Stack>
    );
  }

  return (
    <Stack spacing={3} sx={clientesPageSx}>
      <Box sx={clientesToolbarSx}>
        <Stack direction="row" alignItems="center" gap={2} minWidth={0}>
          <Button
            component={Link}
            to="/clientes"
            color="inherit"
            sx={{ textTransform: "none", fontWeight: 600, flexShrink: 0 }}
          >
            ← Listado
          </Button>
          <Box minWidth={0}>
            <Typography variant="h4" component="h1" fontWeight={800} letterSpacing="-0.02em" noWrap>
              {client.nombre}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Ficha de cliente · pedidos y reservas
            </Typography>
          </Box>
        </Stack>
        <Stack direction="row" alignItems="center" gap={1.5} flexShrink={0}>
          <Button variant="outlined" onClick={() => setFormOpen(true)} sx={{ textTransform: "none", fontWeight: 600 }}>
            Editar cliente
          </Button>
          {!pedidoAbierto ? (
            <Button variant="contained" onClick={() => setPedidoDialog("create")} sx={{ textTransform: "none", fontWeight: 600 }}>
              Crear pedido
            </Button>
          ) : null}
        </Stack>
      </Box>

      {alertaPedido && (
        <Alert severity={alertaPedido === "critico" ? "error" : "warning"}>
          Pedido abierto hace tiempo: revisa o contacta al cliente.
        </Alert>
      )}

      {pedidosApiError && isPedidoApiLikelyMissing(pedidosError) ? (
        <Alert severity="warning">
          El API de pedidos no está disponible (¿backend sin desplegar el módulo{" "}
          <code>/pedido</code>?). Puedes ver al cliente, pero crear pedidos con entrega fallará hasta
          actualizar el backend.
        </Alert>
      ) : null}

      <Box sx={clientesDetailGridSx}>
        <Stack spacing={3}>
          {pedidoAbierto ? (
            <PedidoActivoPanel
              pedido={pedidoAbierto}
              clientId={clientId}
              reservasConStock={reservasConStock}
              resumen={resumenReserva}
              incomingCount={incomingCliente.reduce((s, x) => s + x.quantity, 0)}
              finalizando={finalizando}
              generandoPdfVenta={generandoPdfVenta}
              convert={convert}
              onEditEntrega={() => {
                setPedidoEditTarget(pedidoAbierto);
                setPedidoDialog("edit");
              }}
              onPagar={() =>
                setConfirm({
                  title: "Marcar pagado",
                  body: "¿Confirmas que el cliente pagó este pedido? Las cartas pasarán a vendidas.",
                  action: () => pagarPedido(pedidoAbierto),
                })
              }
              onEntregar={() =>
                setConfirm({
                  title: "Marcar entregado",
                  body: "¿Confirmas que el pedido ya se entregó al cliente?",
                  action: () => entregarPedido(pedidoAbierto),
                })
              }
              onCancelar={() =>
                setConfirm({
                  title: "Cancelar pedido",
                  body: "Se liberará el stock reservado en este pedido.",
                  action: () => cancelarPedido(pedidoAbierto),
                })
              }
              onGenerarPdf={generarPdfVenta}
              formatFechaReserva={formatFechaReserva}
            />
          ) : (
            <Paper variant="outlined" sx={{ ...clientesSectionPaperSx, ...clientesSectionBodySx, textAlign: "center" }}>
              <Typography variant="h6" fontWeight={700} gutterBottom>
                Sin pedido activo
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5, maxWidth: 480, mx: "auto" }}>
                Crea un pedido con lugar y fecha de entrega antes de reservar cartas del inventario.
              </Typography>
              <Button variant="contained" onClick={() => setPedidoDialog("create")} sx={{ textTransform: "none", fontWeight: 600 }}>
                Crear pedido
              </Button>
            </Paper>
          )}

          <PedidoHistorialSection
            items={historialCompleto}
            excludePedidoId={pedidoAbierto ? pedidoId(pedidoAbierto) : undefined}
            onEditEntrega={(p) => {
              if (p.historicoSource === "ventas") return;
              setPedidoEditTarget(p);
              setPedidoDialog("edit");
            }}
          />

          {historialLoading && historialCompleto.length === 0 ? (
            <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
              <Typography color="text.secondary">Cargando historial de ventas…</Typography>
            </Paper>
          ) : null}
        </Stack>

        <Stack spacing={2.5}>
          <Paper variant="outlined" sx={clientesSectionPaperSx}>
            <Box sx={clientesSectionHeaderSx}>
              <Typography variant="subtitle1" fontWeight={700}>
                Contacto
              </Typography>
            </Box>
            <Stack spacing={2} sx={clientesSectionBodySx}>
              <Box>
                <Typography sx={clientesMutedLabelSx}>WhatsApp / teléfono</Typography>
                <Typography variant="body1" fontWeight={600}>
                  {client.celular?.trim() || "—"}
                </Typography>
              </Box>
              <Box>
                <Typography sx={clientesMutedLabelSx}>Canal preferido</Typography>
                <Typography variant="body1">
                  {client.metodo_contacto === "whatsapp" ? "WhatsApp" : "Facebook Messenger"}
                  {client.metodo_contacto === "facebook" && client.facebook_usuario
                    ? ` · @${client.facebook_usuario.replace(/^@+/, "")}`
                    : null}
                </Typography>
              </Box>
              <Stack spacing={1}>
                <Button
                  variant="contained"
                  color="success"
                  fullWidth
                  disabled={(reservas.length === 0 && incomingCliente.length === 0) || waBusy}
                  onClick={enviarWhatsApp}
                  sx={{ textTransform: "none", fontWeight: 600 }}
                >
                  {waBusy ? "Enviando…" : "Enviar resumen por WhatsApp"}
                </Button>
                <Button
                  variant="outlined"
                  fullWidth
                  disabled={(reservas.length === 0 && incomingCliente.length === 0) || copiandoTexto}
                  onClick={copiarPedidoAlPortapapeles}
                  sx={{ textTransform: "none", fontWeight: 600 }}
                >
                  {copiandoTexto ? "Copiando…" : "Copiar mensaje del pedido"}
                </Button>
                {client.metodo_contacto === "facebook" && (
                  <Button
                    variant="contained"
                    fullWidth
                    disabled={!client.facebook_usuario?.trim()}
                    onClick={abrirMessenger}
                    sx={{ bgcolor: "info.main", textTransform: "none", fontWeight: 600 }}
                  >
                    Abrir Messenger
                  </Button>
                )}
              </Stack>
            </Stack>
          </Paper>

          <Paper variant="outlined" sx={clientesSectionPaperSx}>
            <Box sx={clientesSectionHeaderSx}>
              <Typography variant="subtitle1" fontWeight={700}>
                Notas internas
              </Typography>
            </Box>
            <Box sx={clientesSectionBodySx}>
              <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", color: "text.primary", lineHeight: 1.6 }}>
                {client.notas?.trim() || "Sin notas registradas."}
              </Typography>
            </Box>
          </Paper>
        </Stack>
      </Box>

      <ClienteFormDialog
        open={formOpen}
        mode="edit"
        client={client}
        onClose={() => setFormOpen(false)}
      />

      {clientId ? (
        <NuevoPedidoDialog
          open={pedidoDialog != null}
          mode={pedidoDialog === "edit" ? "edit" : "create"}
          clientId={clientId}
          pedido={pedidoDialog === "edit" ? pedidoEditTarget ?? pedidoReservado : null}
          onClose={() => {
            setPedidoDialog(null);
            setPedidoEditTarget(null);
          }}
        />
      ) : null}

      <Dialog open={confirm != null} onClose={() => (finalizando ? undefined : setConfirm(null))}>
        <DialogTitle>{confirm?.title}</DialogTitle>
        <DialogContent>
          <Typography>{confirm?.body}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirm(null)} disabled={finalizando}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            disabled={finalizando}
            onClick={async () => {
              if (!confirm) return;
              await confirm.action();
              setConfirm(null);
            }}
          >
            Confirmar
          </Button>
        </DialogActions>
      </Dialog>

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
