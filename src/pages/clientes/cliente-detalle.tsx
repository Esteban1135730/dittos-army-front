import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
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
  buildWhatsAppReservaCaminoText,
} from "./mensaje-reserva-pedido";
import { incomingGroupPrecioCop } from "./incoming-pvp-field";
import { incomingVariantGroupKey } from "../../utils/incoming-variant-group";
import { downloadVentaClientePdf } from "./venta-cliente-pdf";
import {
  aggregateReservasTotales,
  reservaLineQuantity,
} from "./clientes-resumen-pedidos";
import { useExchangeRates } from "../../utils/tasa";
import { otherOwner, type OwnerKey } from "../../config/owners";
import { useOwner } from "../../modules/owner";
import {
  buildStockByOwnerId,
  findPedidoLineByStockId,
  lookupStockForReserva,
  resolvePedidoReservaVisual,
} from "./pedido-reserva-visual";
import { stockRowsFromQueryData } from "./stock-query-rows";
import { extractAxiosErrorMessage } from "./extract-axios-error";
import NuevoPedidoDialog from "./nuevo-pedido-dialog";
import PedidoActivoPanel from "./pedido-activo-panel";
import PedidoTiendaSection from "./pedido-tienda-section";
import PedidoHistorialSection from "./pedido-historial-section";
import ReservaActivoPanel from "./reserva-activo-panel";
import {
  invalidateReservaIncomingAbonos,
  useReservaIncomingAbonos,
} from "./use-reserva-incoming-abonos";
import { usePedidoAbonos } from "./use-pedido-abonos";
import { buildHistorialClienteView } from "./cliente-historial-merge";
import { API_PEDIDO, findPedidoAbierto, findPedidoReservado, pedidoId, filterReservasDePedido, type PedidoItem } from "./pedido-types";
import {
  descripcionEntrega,
  formatFechaTentativa,
} from "./pedido-entrega-label";
import { normalizeClientItem } from "./cliente-id";
import { fetchPedidosByClient, isPedidoApiLikelyMissing } from "./fetch-pedidos";
import {
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
  const { owner: activeOwner } = useOwner();
  const secondaryOwner = otherOwner(activeOwner);
  const { convert } = useExchangeRates();
  const [formOpen, setFormOpen] = useState(false);
  const [pedidoDialog, setPedidoDialog] = useState<"create" | "edit" | null>(null);
  const [pedidoCreateStoreId, setPedidoCreateStoreId] = useState<string | undefined>();
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

  const { data: incomingAbonos, isSuccess: incomingAbonosOk } = useReservaIncomingAbonos(
    clientId,
    incomingCliente.length > 0,
  );

  const pedidoAbiertoId = pedidoAbierto ? pedidoId(pedidoAbierto) : undefined;
  const { data: pedidoAbonos, isSuccess: pedidoAbonosOk } = usePedidoAbonos(
    pedidoAbiertoId,
    Boolean(pedidoAbiertoId),
  );

  const stockOwners: OwnerKey[] = [activeOwner, secondaryOwner];
  const stockQueries = useQueries({
    queries: stockOwners.map((owner) => ({
      queryKey: ["stock", owner] as const,
      queryFn: async (): Promise<StockListItem[]> => {
        const res = await axios.get(API_STOCK, { ownerOverride: owner });
        return Array.isArray(res.data) ? res.data : [];
      },
    })),
  });
  const stockActiveData = stockQueries[0]?.data;
  const stockOtherData = stockQueries[1]?.data;
  const stockByOwnerId = useMemo(
    () =>
      buildStockByOwnerId([
        { owner: activeOwner, rows: stockRowsFromQueryData<StockListItem>(stockActiveData) },
        { owner: secondaryOwner, rows: stockRowsFromQueryData<StockListItem>(stockOtherData) },
      ]),
    [stockActiveData, stockOtherData, activeOwner, secondaryOwner],
  );

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

  const reservasDelPedido = useMemo(() => {
    const pid = pedidoAbierto ? pedidoId(pedidoAbierto) : undefined;
    const includeOrphans = !pedidoAbierto || pedidoAbierto.status === "reservado";
    return filterReservasDePedido(reservas, pid, includeOrphans);
  }, [reservas, pedidoAbierto]);

  const stockMap = useMemo(() => {
    const m: Record<string, StockListItem> = {};
    for (const r of reservasDelPedido) {
      const st = lookupStockForReserva(stockByOwnerId, r.stock_id, r.stock_owner, activeOwner);
      if (st) m[r.stock_id] = st;
    }
    return m;
  }, [reservasDelPedido, stockByOwnerId, activeOwner]);

  const reservasConStock = useMemo(
    () =>
      reservasDelPedido.map((r) => ({
        reserva: r,
        stock: lookupStockForReserva(stockByOwnerId, r.stock_id, r.stock_owner, activeOwner),
      })),
    [reservasDelPedido, stockByOwnerId, activeOwner],
  );

  const resumenReserva = useMemo(
    () => aggregateReservasTotales(reservasDelPedido, stockMap, convert),
    [reservasDelPedido, stockMap, convert],
  );

  const alertaPedido = useMemo(() => {
    if (reservasDelPedido.length === 0) return null;
    const times = reservasDelPedido
      .map((r) => (r.created_at ? new Date(r.created_at).getTime() : null))
      .filter((t): t is number => t != null && !Number.isNaN(t));
    const oldest = times.length ? Math.min(...times) : null;
    if (oldest == null) return null;
    const hours = (Date.now() - oldest) / 3600000;
    if (hours >= ALERTA_HORAS_ROJO) return "critico" as const;
    if (hours >= ALERTA_HORAS_AMARILLO) return "alerta" as const;
    return null;
  }, [reservasDelPedido]);

  const construirTextoPedido = async (): Promise<string | null> => {
    if (!client) return null;
    if (reservasDelPedido.length === 0 && incomingCliente.length === 0) return null;
    const lines = reservasDelPedido.map((r) => {
      const visual = resolvePedidoReservaVisual({
        stock: lookupStockForReserva(stockByOwnerId, r.stock_id, r.stock_owner, activeOwner),
        pedidoLine: findPedidoLineByStockId(pedidoAbierto?.lines, r.stock_id),
        stockOwner: r.stock_owner,
        activeOwner,
      });
      return {
        card_id: visual.cardId,
        card_name: visual.cardName,
        precio: r.precio,
        rareza: visual.rareza,
        quantity: reservaLineQuantity(r.quantity),
      };
    });
    const incomingLines = incomingCliente.map((x) => ({
      card_id: x.card_id ?? "",
      card_name: x.card_name ?? "Carta",
      quantity: x.quantity,
      rareza: x.rareza,
      language: x.language,
      precio_cop: x.precio_cop,
    }));
    return buildWhatsAppPedidoText({
      clientName: client.nombre,
      descripcionEntrega: descripcionEntrega(pedidoAbierto),
      lines,
      incomingLines: incomingLines.length ? incomingLines : undefined,
      ...(pedidoAbonosOk && pedidoAbonos && lines.length > 0
        ? { abonado_cop: pedidoAbonos.abonado_cop, saldo_cop: pedidoAbonos.saldo_cop }
        : {}),
    });
  };

  const construirTextoReservaCamino = async (): Promise<string | null> => {
    if (!client || incomingCliente.length === 0) return null;
    const grouped = new Map<string, ReservaIncomingItem[]>();
    for (const r of incomingCliente) {
      const k = incomingVariantGroupKey(r.card_id ?? "", r.rareza, r.language ?? "");
      const arr = grouped.get(k) ?? [];
      arr.push(r);
      grouped.set(k, arr);
    }
    return buildWhatsAppReservaCaminoText({
      clientName: client.nombre,
      lines: [...grouped.values()].map((rows) => ({
        card_id: rows[0].card_id ?? "",
        card_name: rows[0].card_name ?? "Carta",
        quantity: rows.reduce((s, x) => s + x.quantity, 0),
        language: rows[0].language,
        rareza: rows[0].rareza,
        precio_cop: incomingGroupPrecioCop(rows),
      })),
      ...(incomingAbonosOk && incomingAbonos
        ? { abonado_cop: incomingAbonos.abonado_cop, saldo_cop: incomingAbonos.saldo_cop }
        : {}),
    });
  };

  const enviarReservaWhatsApp = async () => {
    if (!client) return;
    setWaBusy(true);
    try {
      const texto = await construirTextoReservaCamino();
      if (texto == null) return;
      abrirWhatsAppConTexto(client.celular, texto);
      show("Se abrió WhatsApp con la reserva.", "success");
    } finally {
      setWaBusy(false);
    }
  };

  const copiarReservaWhatsApp = async () => {
    setCopiandoTexto(true);
    try {
      const texto = await construirTextoReservaCamino();
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
      if (copiado) show("Mensaje de reserva copiado.", "success");
      else show("No se pudo copiar al portapapeles.", "error");
    } finally {
      setCopiandoTexto(false);
    }
  };

  const guardarPvpReserva = async (rows: ReservaIncomingItem[], cop: number | null) => {
    for (const r of rows) {
      await axios.patch(`${API_RESERVA}/incoming/${r._id}`, { precio_cop: cop });
    }
    if (clientId) {
      await queryClient.invalidateQueries({ queryKey: ["reservas-incoming", clientId] });
    }
    await queryClient.invalidateQueries({ queryKey: ["reservas-incoming"] });
    await invalidateReservaIncomingAbonos(queryClient, clientId);
    show(cop != null ? "PVP de la reserva actualizado." : "PVP quitado de la reserva.", "success");
  };

  const enviarWhatsApp = async () => {
    if (!client || !clientId) return;
    setWaBusy(true);
    try {
      const texto = await construirTextoPedido();
      if (texto == null) return;
      abrirWhatsAppConTexto(client.celular, texto);
      show("Se abrió WhatsApp con el resumen.", "success");
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
        show("Resumen copiado al portapapeles.", "success");
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
    if (!client || reservasDelPedido.length === 0) return;
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
      reservasDelPedido.forEach((r) => {
        const visual = resolvePedidoReservaVisual({
          stock: lookupStockForReserva(stockByOwnerId, r.stock_id, r.stock_owner, activeOwner),
          pedidoLine: findPedidoLineByStockId(pedidoAbierto?.lines, r.stock_id),
          stockOwner: r.stock_owner,
          activeOwner,
        });
        stockById[r.stock_id] = {
          card_id: visual.cardId,
          card_name: visual.cardName,
          image_url: visual.imageSrc,
          rareza: visual.rareza,
        };
      });
      const { imageFailures } = await downloadVentaClientePdf({
        clientName: client.nombre,
        descripcionEntrega: descripcionEntrega(pedidoAbierto),
        fechaTentativa: formatFechaTentativa(pedidoAbierto?.fecha_tentativa_entrega),
        reservas: reservasDelPedido.map((r) => ({
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
    <Stack spacing={2} sx={clientesPageSx}>
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
              Ficha de cliente · pedido y reserva
            </Typography>
          </Box>
        </Stack>
        <Stack direction="row" alignItems="center" gap={1.5} flexShrink={0} flexWrap="wrap" justifyContent="flex-end">
          <Button variant="outlined" onClick={() => setFormOpen(true)} sx={{ textTransform: "none", fontWeight: 600 }}>
            Editar cliente
          </Button>
          {!pedidoAbierto ? (
            <Button variant="contained" onClick={() => { setPedidoCreateStoreId(undefined); setPedidoDialog("create"); }} sx={{ textTransform: "none", fontWeight: 600 }}>
              Crear pedido
            </Button>
          ) : null}
          <Button
            variant={incomingCliente.length > 0 ? "outlined" : "contained"}
            color={incomingCliente.length > 0 ? "inherit" : "info"}
            component={Link}
            to={`/clientes/${clientId}/reservar?camino=1`}
            sx={{ textTransform: "none", fontWeight: 600 }}
          >
            {incomingCliente.length > 0 ? "Gestionar reserva" : "Crear reserva"}
          </Button>
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
        <Stack spacing={2}>
          {clientId ? (
            <PedidoTiendaSection
              clientId={clientId}
              pedidoReservado={pedidoReservado}
              onNeedCreatePedido={(storeId) => {
                setPedidoCreateStoreId(storeId);
                setPedidoDialog("create");
              }}
            />
          ) : null}
          {pedidoAbierto ? (
            <PedidoActivoPanel
              pedido={pedidoAbierto}
              clientId={clientId}
              activeOwner={activeOwner}
              reservasConStock={reservasConStock}
              resumen={resumenReserva}
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
              onNotify={show}
            />
          ) : (
            <Paper variant="outlined" sx={[clientesSectionPaperSx, clientesSectionBodySx, { textAlign: "center" }]}>
              <Typography variant="h6" fontWeight={700} gutterBottom>
                Sin pedido activo
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5, maxWidth: 480, mx: "auto" }}>
                Crea un pedido con lugar y fecha de entrega antes de agregar cartas del inventario.
              </Typography>
              <Button variant="contained" onClick={() => { setPedidoCreateStoreId(undefined); setPedidoDialog("create"); }} sx={{ textTransform: "none", fontWeight: 600 }}>
                Crear pedido
              </Button>
            </Paper>
          )}

          {incomingCliente.length > 0 ? (
            <ReservaActivoPanel
              clientId={clientId!}
              incoming={incomingCliente}
              formatFechaReserva={formatFechaReserva}
              onSavePvp={guardarPvpReserva}
              onEnviarWhatsApp={() => void enviarReservaWhatsApp()}
              onCopiarMensaje={() => void copiarReservaWhatsApp()}
              waBusy={waBusy}
              copiando={copiandoTexto}
              onNotify={show}
            />
          ) : (
            <Paper variant="outlined" sx={[clientesSectionPaperSx, clientesSectionBodySx, { textAlign: "center" }]}>
              <Typography variant="h6" fontWeight={700} gutterBottom>
                Sin reserva activa
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5, maxWidth: 480, mx: "auto" }}>
                Aparta cartas que aún van en camino. La reserva no se mezcla con el pedido de stock.
              </Typography>
              <Button
                variant="contained"
                color="info"
                component={Link}
                to={`/clientes/${clientId}/reservar?camino=1`}
                sx={{ textTransform: "none", fontWeight: 600 }}
              >
                Crear reserva
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
                  disabled={(reservasDelPedido.length === 0 && incomingCliente.length === 0) || waBusy}
                  onClick={enviarWhatsApp}
                  sx={{ textTransform: "none", fontWeight: 600 }}
                >
                  {waBusy ? "Enviando…" : "Enviar resumen por WhatsApp"}
                </Button>
                <Button
                  variant="outlined"
                  fullWidth
                  disabled={(reservasDelPedido.length === 0 && incomingCliente.length === 0) || copiandoTexto}
                  onClick={copiarPedidoAlPortapapeles}
                  sx={{ textTransform: "none", fontWeight: 600 }}
                >
                  {copiandoTexto ? "Copiando…" : "Copiar resumen"}
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
          initialStoreId={pedidoDialog === "create" ? pedidoCreateStoreId : undefined}
          onClose={() => {
            setPedidoDialog(null);
            setPedidoEditTarget(null);
            setPedidoCreateStoreId(undefined);
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
