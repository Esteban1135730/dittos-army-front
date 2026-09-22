import { useQuery, useQueries, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { DataGrid, type GridColDef } from "@mui/x-data-grid";
import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Paper,
  Snackbar,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { useExchangeRates } from "../../utils/tasa";
import { formatCOP } from "../../utils/convert";
import type { StockListItem } from "../../types/stock";
import {
  API_CLIENT,
  API_RESERVA,
  API_STOCK,
  type ClientItem,
  type ReservaIncomingItem,
  type ReservaItem,
} from "./cliente-types";
import { API_CARDTRADER_TRANSIT_LOTS } from "../cardtrader-transit/cardtrader-transit-types";
import {
  compareIncomingLinesByOldest,
  incomingVariantGroupKey,
  weightedAverageUnitCostCop,
} from "../../utils/incoming-variant-group";
import { CardThumb } from "../../components/card-thumb";
import {
  PANEL_DATAGRID_DENSITY,
  PANEL_DATAGRID_IMAGE_COL_WIDTH,
  PANEL_DATAGRID_ROW_HEIGHT,
} from "../../theme/panel-density";
import { aggregateReservasTotales, amountToCop, gananciaEstimadaReservaCop } from "./clientes-resumen-pedidos";
import ClienteFormDialog from "./cliente-form-dialog";
import NuevoPedidoDialog from "./nuevo-pedido-dialog";
import PedidoContextBar from "./pedido-context-bar";
import ReservaContextBar from "./reserva-context-bar";
import ReservaIncomingAbonosBlock from "./reserva-incoming-abonos-block";
import PedidoAbonosBlock from "./pedido-abonos-block";
import {
  invalidateReservaIncomingAbonos,
  useReservaIncomingAbonos,
} from "./use-reserva-incoming-abonos";
import { invalidatePedidoAbonos } from "./use-pedido-abonos";
import PedidoTiendaSection from "./pedido-tienda-section";
import IncomingPvpField, { incomingGroupPrecioCop } from "./incoming-pvp-field";
import ReservaCostMarginAside, {
  incomingGroupUnitCostCop,
  reservaMarginTotalCop,
} from "./reserva-cost-margin";
import {
  abrirWhatsAppConTexto,
  buildWhatsAppReservaCaminoText,
} from "./mensaje-reserva-pedido";
import { extractAxiosErrorMessage } from "./extract-axios-error";
import { looksLikeTcgdexCardId, resolveCardImageSrc } from "../../pokemon";
import { useTcgdexCardDetails } from "../../pokemon";
import {
  API_PEDIDO,
  canReservarStock,
  findPedidoReservado,
  pedidoId,
  filterReservasDePedido,
  type PedidoItem,
} from "./pedido-types";
import ImportWhatsAppPedidoDialog from "./import-whatsapp-pedido-dialog";
import ImportWhatsAppReservaDialog from "./import-whatsapp-reserva-dialog";
import { operationalRarezaLabel } from "../../constants/item-rareza";
import {
  isQuantityProduct,
  resolveStockImageUrl,
} from "../../constants/bulk-product";
import { ensureBulkProduct } from "../../api/ensure-bulk";
import {
  filterStockInReservaCatalog,
  sortReservaCatalogRows,
} from "../../utils/stock-reserva-catalog";
import { reservaLineQuantity } from "./clientes-resumen-pedidos";
import {
  ESTEBAN_STOCK_MARK,
  OWNERS_CONFIG,
  otherOwner,
  type OwnerKey,
} from "../../config/owners";
import { useOwner } from "../../modules/owner";

type StockItem = StockListItem;
type ReservaCatalogRow = StockListItem & { owner: OwnerKey };

function catalogRowKey(owner: OwnerKey, id: string): string {
  return `${owner}:${id}`;
}

const EMPTY_STOCK: StockItem[] = [];

type IncomingCatalogRow = {
  batch_item_id: string;
  batch_id: string;
  card_id: string;
  card_name: string;
  image_url: string;
  language: string;
  remaining_quantity: number;
  rareza?: string | null;
  unit_cost_cop: number;
  batch_purchase_date?: string | null;
  created_at?: string | null;
};

/** Fila de catálogo agrupada por carta + rareza + idioma (costo unitario = promedio ponderado por unidades). */
type GroupedIncomingCatalogRow = {
  id: string;
  card_id: string;
  card_name: string;
  image_url: string;
  language: string;
  rareza: string | null | undefined;
  unit_cost_cop_ref: number;
  remaining_total: number;
  cupo: number;
  sourceLines: IncomingCatalogRow[];
};

function formatReservaFecha(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" });
}

export default function ReservarCartasPage() {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { owner: activeOwner } = useOwner();
  const secondaryOwner = otherOwner(activeOwner);
  const { convert } = useExchangeRates();
  const [precios, setPrecios] = useState<Record<string, string>>({});
  const [preciosReservadas, setPreciosReservadas] = useState<Record<string, string>>({});
  const [reservandoId, setReservandoId] = useState<string | null>(null);
  const [quitandoId, setQuitandoId] = useState<string | null>(null);
  const [actualizandoPrecioId, setActualizandoPrecioId] = useState<string | null>(null);
  const [aplicandoPvpId, setAplicandoPvpId] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [cantidadStock, setCantidadStock] = useState<Record<string, string>>({});
  const [modalEditarCliente, setModalEditarCliente] = useState(false);
  const [pedidoDialog, setPedidoDialog] = useState<"create" | "edit" | null>(null);
  const [pedidoCreateStoreId, setPedidoCreateStoreId] = useState<string | undefined>();
  const [importWaOpen, setImportWaOpen] = useState(false);
  const [importWaReservaOpen, setImportWaReservaOpen] = useState(false);
  const [waReservaBusy, setWaReservaBusy] = useState(false);
  const [copiandoReserva, setCopiandoReserva] = useState(false);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "error";
  }>({ open: false, message: "", severity: "success" });

  const toast = (message: string, severity: "success" | "error") =>
    setSnackbar({ open: true, message, severity });

  const { data: client, isLoading: loadingClient } = useQuery<ClientItem>({
    queryKey: ["client", clientId],
    queryFn: async () => {
      const res = await axios.get(`${API_CLIENT}/${clientId}`);
      return res.data;
    },
    enabled: !!clientId,
  });

  const { data: pedidos = [] } = useQuery<PedidoItem[]>({
    queryKey: ["pedidos", clientId],
    queryFn: async () => {
      const res = await axios.get(`${API_PEDIDO}/client/${clientId}`);
      return Array.isArray(res.data) ? res.data : [];
    },
    enabled: !!clientId,
  });

  const pedidoReservado = findPedidoReservado(pedidos);
  const pedidoPagado = pedidos.find((p) => p.status === "pagado");
  const stockPedido = pedidoReservado ?? pedidoPagado;
  const stockPedidoId = stockPedido ? pedidoId(stockPedido) : undefined;

  const abrirModalEditar = () => setModalEditarCliente(true);
  const cerrarModalEditar = () => setModalEditarCliente(false);

  const stockQueries = useQueries({
    queries: [activeOwner, secondaryOwner].map((owner) => ({
      queryKey: ["stock", owner] as const,
      queryFn: async (): Promise<StockItem[]> => {
        const res = await axios.get(API_STOCK, { ownerOverride: owner });
        return Array.isArray(res.data) ? res.data : [];
      },
    })),
  });
  const stockActive = stockQueries[0]?.data ?? EMPTY_STOCK;
  const stockOther = stockQueries[1]?.data ?? EMPTY_STOCK;
  const loadingStock = stockQueries.every((q) => q.isLoading || q.isPending);
  const stockActiveFailed = Boolean(stockQueries[0]?.isError);
  const stockOtherFailed = Boolean(stockQueries[1]?.isError);

  useEffect(() => {
    void ensureBulkProduct().then((r) => {
      if (!r.ok) {
        toast(r.error ?? "No se pudo asegurar el SKU bulk", "error");
      } else {
        void queryClient.invalidateQueries({ queryKey: ["stock"] });
      }
    });
    // Solo al montar la pantalla de reserva.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data: reservasRaw = [], isLoading: loadingReservas } = useQuery<ReservaItem[]>({
    queryKey: ["reservas", clientId],
    queryFn: async () => {
      const res = await axios.get(`${API_RESERVA}/client/${clientId}`);
      return Array.isArray(res.data) ? res.data : [];
    },
    enabled: !!clientId,
  });

  const reservasDelPedido = useMemo(() => {
    const pid = pedidoReservado ? pedidoId(pedidoReservado) : undefined;
    return filterReservasDePedido(reservasRaw, pid, true);
  }, [reservasRaw, pedidoReservado]);

  const [searchParams] = useSearchParams();
  const esReservaCamino = searchParams.get("camino") === "1";
  const caminoRef = useRef<HTMLDivElement | null>(null);
  const [busquedaCamino, setBusquedaCamino] = useState("");
  const [cantidadIncoming, setCantidadIncoming] = useState<Record<string, string>>({});
  const [incomingMutatingId, setIncomingMutatingId] = useState<string | null>(null);

  const { data: incomingCatalog = [], isLoading: loadingIncomingCat } = useQuery<IncomingCatalogRow[]>({
    queryKey: ["transit-catalog-open"],
    queryFn: async () => {
      const res = await axios.get(`${API_CARDTRADER_TRANSIT_LOTS}/open/catalog`);
      const rows = Array.isArray(res.data) ? res.data : [];
      return rows
        .filter((it: { remaining_quantity?: number }) => (it.remaining_quantity ?? 0) > 0)
        .map(
          (it: {
            transit_line_id: string;
            transit_lot_id: string;
            card_id: string;
            card_name: string;
            image_url: string;
            language: string;
            rareza?: string | null;
            remaining_quantity: number;
            unit_cost_cop: number;
            purchase_date: string;
            created_at?: string;
          }) => ({
            batch_item_id: it.transit_line_id,
            batch_id: it.transit_lot_id,
            card_id: it.card_id,
            card_name: it.card_name,
            image_url: it.image_url ?? "",
            language: it.language,
            rareza: it.rareza ?? null,
            remaining_quantity: it.remaining_quantity,
            unit_cost_cop: it.unit_cost_cop,
            batch_purchase_date: it.purchase_date ?? null,
            created_at: it.created_at ?? null,
          }),
        );
    },
  });

  const { data: allIncoming = [], isLoading: loadingIncomingAll } = useQuery<ReservaIncomingItem[]>({
    queryKey: ["reservas-incoming"],
    queryFn: async () => {
      const res = await axios.get(`${API_RESERVA}/incoming`);
      return Array.isArray(res.data) ? res.data : [];
    },
  });

  const incomingCliente = useMemo(
    () => allIncoming.filter((r) => r.client_id === clientId),
    [allIncoming, clientId],
  );

  const { data: incomingAbonos, isSuccess: incomingAbonosOk } = useReservaIncomingAbonos(
    clientId,
    incomingCliente.length > 0,
  );

  const incomingClienteGrouped = useMemo(() => {
    const map = new Map<string, ReservaIncomingItem[]>();
    for (const r of incomingCliente) {
      const k = incomingVariantGroupKey(r.card_id ?? "", r.rareza, r.language ?? "");
      const arr = map.get(k) ?? [];
      arr.push(r);
      map.set(k, arr);
    }
    return Array.from(map.entries()).map(([groupId, rows]) => ({
      groupId,
      rows,
      qtyTotal: rows.reduce((s, x) => s + x.quantity, 0),
      head: rows[0],
    }));
  }, [incomingCliente]);

  const reservaCardIds = useMemo(
    () => [
      ...incomingCatalog.map((r) => r.card_id),
      ...incomingCliente.map((r) => r.card_id ?? ""),
    ],
    [incomingCatalog, incomingCliente],
  );
  const { detailsByCardId, isLoading: loadingCardImages } = useTcgdexCardDetails(reservaCardIds);

  const pendingForBatchItem = useCallback(
    (bid: string) =>
      allIncoming.filter((r) => r.batch_item_id === bid).reduce((s, r) => s + r.quantity, 0),
    [allIncoming],
  );

  const incomingGroupedCatalog = useMemo((): GroupedIncomingCatalogRow[] => {
    const map = new Map<string, IncomingCatalogRow[]>();
    for (const row of incomingCatalog) {
      if (row.remaining_quantity <= 0) continue;
      const k = incomingVariantGroupKey(row.card_id, row.rareza, row.language);
      const arr = map.get(k) ?? [];
      arr.push(row);
      map.set(k, arr);
    }
    const groups: GroupedIncomingCatalogRow[] = [];
    for (const [id, lines] of map) {
      const sorted = [...lines].sort(compareIncomingLinesByOldest);
      const oldest = sorted[0];
      const remaining_total = sorted.reduce((s, x) => s + x.remaining_quantity, 0);
      const pending_total = sorted.reduce((s, x) => s + pendingForBatchItem(x.batch_item_id), 0);
      groups.push({
        id,
        card_id: oldest.card_id,
        card_name: oldest.card_name,
        image_url: sorted.find((x) => x.image_url?.trim())?.image_url || oldest.image_url,
        language: oldest.language,
        rareza: oldest.rareza,
        unit_cost_cop_ref: weightedAverageUnitCostCop(sorted),
        remaining_total,
        cupo: Math.max(0, remaining_total - pending_total),
        sourceLines: sorted,
      });
    }
    return groups;
  }, [incomingCatalog, pendingForBatchItem]);

  const incomingGroupedFiltrado = useMemo(() => {
    let rows = incomingGroupedCatalog;
    const q = busquedaCamino.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (r) =>
          r.card_name.toLowerCase().includes(q) || r.card_id.toLowerCase().includes(q),
      );
    }
    return rows;
  }, [incomingGroupedCatalog, busquedaCamino]);

  const stockCatalogAll = useMemo((): ReservaCatalogRow[] => {
    return [
      ...stockActive.map((s) => ({ ...s, owner: activeOwner })),
      ...stockOther.map((s) => ({ ...s, owner: secondaryOwner })),
    ];
  }, [stockActive, stockOther, activeOwner, secondaryOwner]);

  const stockDisponible = useMemo(
    () =>
      sortReservaCatalogRows([
        ...filterStockInReservaCatalog(stockActive).map((s) => ({
          ...s,
          owner: activeOwner,
        })),
        ...filterStockInReservaCatalog(stockOther).map((s) => ({
          ...s,
          owner: secondaryOwner,
        })),
      ]),
    [stockActive, stockOther, activeOwner, secondaryOwner],
  );

  const stockMap = useMemo(() => {
    const m: Record<string, StockItem> = {};
    for (const r of reservasDelPedido) {
      const owner = r.stock_owner ?? activeOwner;
      const row = stockCatalogAll.find((s) => s._id === r.stock_id && s.owner === owner);
      if (row) m[r.stock_id] = row;
    }
    return m;
  }, [reservasDelPedido, stockCatalogAll, activeOwner]);

  const resumenReserva = useMemo(
    () => aggregateReservasTotales(reservasDelPedido, stockMap, convert),
    [reservasDelPedido, stockMap, convert],
  );

  const stockDisponibleFiltrado = useMemo(() => {
    if (!busqueda.trim()) return stockDisponible;
    const q = busqueda.toLowerCase().trim();
    return stockDisponible.filter(
      (s) =>
        s.card_name.toLowerCase().includes(q) ||
        (s.card_id && s.card_id.toLowerCase().includes(q)),
    );
  }, [stockDisponible, busqueda]);

  const reservasConStock = useMemo(() => {
    return reservasDelPedido
      .map((r) => {
        const owner = r.stock_owner ?? activeOwner;
        const stock = stockCatalogAll.find((s) => s._id === r.stock_id && s.owner === owner);
        return stock
          ? {
              ...r,
              card_name: stock.card_name,
              image_url: stock.image_url,
              card_id: stock.card_id,
              rareza: stock.rareza ?? null,
              line_owner: owner,
            }
          : null;
      })
      .filter(
        (
          r,
        ): r is ReservaItem & {
          card_name: string;
          image_url: string;
          card_id: string;
          rareza: string | null;
          line_owner: OwnerKey;
        } => r !== null,
      );
  }, [reservasDelPedido, stockCatalogAll, activeOwner]);

  const getPrecioDefault = (item: StockItem): number => {
    if (item.pvp != null && item.pvp > 0 && item.pvp_currency) {
      if (item.pvp_currency === "COP") return item.pvp;
      if (item.pvp_currency === "EUR") return convert.toCopFromEur(item.pvp) ?? 0;
      if (item.pvp_currency === "USD") return convert.toCopFromUsd(item.pvp) ?? 0;
    }
    return 0;
  };

  const getPrecioReserva = (rowKey: string, item: StockItem): number => {
    const v = precios[rowKey];
    if (v !== undefined && v !== "") {
      const n = parseFloat(v.replace(",", "."));
      if (!Number.isNaN(n)) return n;
    }
    return getPrecioDefault(item);
  };

  const handleReservar = async (item: ReservaCatalogRow) => {
    if (!clientId || !client || !pedidoReservado) return;
    const rowKey = catalogRowKey(item.owner, item._id);
    const precio = getPrecioReserva(rowKey, item);
    if (precio <= 0) {
      toast("Ingresa un precio mayor a 0.", "error");
      return;
    }
    const isQty = isQuantityProduct({
      product_kind: item.product_kind,
      card_id: item.card_id,
    });
    const qty = isQty
      ? Math.max(
          1,
          Math.floor(Number((cantidadStock[rowKey] ?? "1").replace(",", ".")) || 1),
        )
      : 1;
    if (isQty) {
      const available = typeof item.quantity === "number" ? item.quantity : 0;
      if (qty > available) {
        toast(`Stock insuficiente (disponible: ${available}).`, "error");
        return;
      }
    }
    setReservandoId(rowKey);
    try {
      const res = await axios.post(API_RESERVA, {
        client_id: clientId,
        stock_id: item._id,
        precio: Math.round(precio),
        currency: "COP",
        pedido_id: pedidoId(pedidoReservado),
        stock_owner: item.owner,
        ...(isQty ? { quantity: qty } : {}),
      });
      if (res.data && (res.data as { error?: string }).error) {
        toast((res.data as { error: string }).error, "error");
        return;
      }
      const next = { ...precios };
      delete next[rowKey];
      setPrecios(next);
      if (isQty) {
        setCantidadStock((prev) => ({ ...prev, [rowKey]: "1" }));
      }
      await queryClient.invalidateQueries({ queryKey: ["stock"] });
      await queryClient.invalidateQueries({ queryKey: ["reservas", clientId] });
      await invalidatePedidoAbonos(queryClient, stockPedidoId);
      await queryClient.invalidateQueries({ queryKey: ["pedidos", clientId] });
      toast(
        isQty
          ? `«${item.card_name}» ×${qty} añadido al pedido.`
          : `«${item.card_name}» añadida al pedido.`,
        "success",
      );
    } catch (err) {
      toast(extractAxiosErrorMessage(err, "Error al reservar la carta."), "error");
    } finally {
      setReservandoId(null);
    }
  };

  const handleQuitarReserva = async (stockId: string, stockOwner: OwnerKey) => {
    const lineKey = catalogRowKey(stockOwner, stockId);
    setQuitandoId(lineKey);
    try {
      const res = await axios.delete(`${API_RESERVA}/stock/${stockId}`, {
        params: {
          ...(clientId ? { client_id: clientId } : {}),
          stock_owner: stockOwner,
        },
      });
      if ((res.data as { success?: boolean }).success !== true) {
        toast((res.data as { error?: string }).error ?? "Error al quitar reserva.", "error");
        return;
      }
      const next = { ...preciosReservadas };
      delete next[lineKey];
      setPreciosReservadas(next);
      await queryClient.invalidateQueries({ queryKey: ["stock"] });
      await queryClient.invalidateQueries({ queryKey: ["reservas", clientId] });
      await invalidatePedidoAbonos(queryClient, stockPedidoId);
      await queryClient.invalidateQueries({ queryKey: ["pedidos", clientId] });
      toast("Línea quitada del pedido.", "success");
    } catch {
      toast("Error al quitar la reserva.", "error");
    } finally {
      setQuitandoId(null);
    }
  };

  const handleActualizarPrecioReserva = async (
    stockId: string,
    precioStr: string,
    stockOwner: OwnerKey,
  ) => {
    const n = parseFloat(precioStr.replace(",", "."));
    if (Number.isNaN(n) || n < 0) return;
    const lineKey = catalogRowKey(stockOwner, stockId);
    setActualizandoPrecioId(lineKey);
    try {
      const res = await axios.put(
        `${API_RESERVA}/stock/${stockId}`,
        {
          precio: Math.round(n),
          currency: "COP",
        },
        {
          params: {
            ...(clientId ? { client_id: clientId } : {}),
            stock_owner: stockOwner,
          },
        },
      );
      if (res.data && (res.data as { error?: string }).error) {
        toast((res.data as { error: string }).error, "error");
        return;
      }
      setPreciosReservadas((prev) => {
        const next = { ...prev };
        delete next[lineKey];
        return next;
      });
      await queryClient.invalidateQueries({ queryKey: ["reservas", clientId] });
      await invalidatePedidoAbonos(queryClient, stockPedidoId);
      toast("Precio actualizado.", "success");
    } catch {
      toast("Error al actualizar el precio.", "error");
    } finally {
      setActualizandoPrecioId(null);
    }
  };

  const handleAplicarPvpReserva = async (
    stockId: string,
    stock: StockItem,
    stockOwner: OwnerKey,
  ) => {
    const precioCop = Math.round(getPrecioDefault(stock));
    if (precioCop <= 0) return;
    const lineKey = catalogRowKey(stockOwner, stockId);
    setAplicandoPvpId(lineKey);
    try {
      const res = await axios.put(
        `${API_RESERVA}/stock/${stockId}`,
        {
          precio: precioCop,
          currency: "COP",
        },
        {
          params: {
            ...(clientId ? { client_id: clientId } : {}),
            stock_owner: stockOwner,
          },
        },
      );
      if (res.data && (res.data as { error?: string }).error) {
        toast((res.data as { error: string }).error, "error");
        return;
      }
      setPreciosReservadas((prev) => {
        const next = { ...prev };
        delete next[lineKey];
        return next;
      });
      await queryClient.invalidateQueries({ queryKey: ["reservas", clientId] });
      await invalidatePedidoAbonos(queryClient, stockPedidoId);
      toast("Precio aplicado desde PVP.", "success");
    } catch {
      toast("Error al aplicar PVP.", "error");
    } finally {
      setAplicandoPvpId(null);
    }
  };

  const handleAddIncomingGroup = async (group: GroupedIncomingCatalogRow) => {
    if (!clientId) return;
    const raw = cantidadIncoming[group.id] ?? "1";
    const qty = Math.max(1, Math.floor(Number(raw.replace(",", ".")) || 1));
    setIncomingMutatingId(group.id);
    try {
      const body: Record<string, unknown> = {
        client_id: clientId,
        card_id: group.card_id,
        language: group.language,
        quantity: qty,
      };
      const rz = group.rareza?.trim();
      if (rz) body.rareza = rz;

      await axios.post(`${API_RESERVA}/incoming`, body);
      setCantidadIncoming((prev) => ({ ...prev, [group.id]: "1" }));
      await queryClient.invalidateQueries({ queryKey: ["reservas-incoming"] });
      toast("Reserva en camino añadida.", "success");
    } catch (e: unknown) {
      if (axios.isAxiosError(e) && e.response?.status === 409) {
        const d = e.response?.data as { message?: string | string[] };
        const msg = Array.isArray(d?.message) ? d.message.join(", ") : d?.message;
        toast(msg ?? "No hay cupo suficiente para esta variante.", "error");
      } else {
        toast("No se pudo reservar en camino.", "error");
      }
    } finally {
      setIncomingMutatingId(null);
    }
  };

  const handleSaveIncomingPvp = async (rows: ReservaIncomingItem[], cop: number | null) => {
    for (const r of rows) {
      await axios.patch(`${API_RESERVA}/incoming/${r._id}`, { precio_cop: cop });
    }
    await queryClient.invalidateQueries({ queryKey: ["reservas-incoming"] });
    await invalidateReservaIncomingAbonos(queryClient, clientId);
    toast(cop != null ? "PVP de la reserva actualizado." : "PVP quitado de la reserva.", "success");
  };

  const construirTextoReservaCamino = async (): Promise<string | null> => {
    if (!client || incomingCliente.length === 0) return null;
    return buildWhatsAppReservaCaminoText({
      clientName: client.nombre,
      lines: incomingClienteGrouped.map(({ rows, qtyTotal, head }) => ({
        card_id: head?.card_id ?? "",
        card_name: head?.card_name ?? "Carta",
        quantity: qtyTotal,
        language: head?.language,
        rareza: head?.rareza,
        precio_cop: incomingGroupPrecioCop(rows),
      })),
      ...(incomingAbonosOk && incomingAbonos
        ? { abonado_cop: incomingAbonos.abonado_cop, saldo_cop: incomingAbonos.saldo_cop }
        : {}),
    });
  };

  const enviarReservaWhatsApp = async () => {
    if (!client) return;
    setWaReservaBusy(true);
    try {
      const texto = await construirTextoReservaCamino();
      if (texto == null) return;
      abrirWhatsAppConTexto(client.celular, texto);
      toast("Se abrió WhatsApp con la reserva.", "success");
    } finally {
      setWaReservaBusy(false);
    }
  };

  const copiarReservaWhatsApp = async () => {
    setCopiandoReserva(true);
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
      if (copiado) toast("Mensaje de reserva copiado.", "success");
      else toast("No se pudo copiar al portapapeles.", "error");
    } finally {
      setCopiandoReserva(false);
    }
  };

  const handleDeleteIncomingGroup = async (groupId: string, rows: ReservaIncomingItem[]) => {
    if (rows.length === 0) return;
    setIncomingMutatingId(groupId);
    try {
      for (const r of rows) {
        await axios.delete(`${API_RESERVA}/incoming/${r._id}`);
      }
      await queryClient.invalidateQueries({ queryKey: ["reservas-incoming"] });
      await invalidateReservaIncomingAbonos(queryClient, clientId);
      toast(
        rows.length > 1 ? "Reservas en camino de esta variante eliminadas." : "Reserva en camino eliminada.",
        "success",
      );
    } catch {
      toast("No se pudo eliminar la reserva.", "error");
    } finally {
      setIncomingMutatingId(null);
    }
  };

  const getPrecioReservaInput = (lineKey: string, precioActual: number): string => {
    if (preciosReservadas[lineKey] !== undefined) return preciosReservadas[lineKey];
    return precioActual > 0 ? String(precioActual) : "";
  };

  const incomingGridRows = useMemo(
    () => incomingGroupedFiltrado.map((g) => ({ ...g, id: g.id })),
    [incomingGroupedFiltrado],
  );

  const columnsIncoming: GridColDef<GroupedIncomingCatalogRow>[] = [
    {
      field: "image_url",
      headerName: "",
      width: PANEL_DATAGRID_IMAGE_COL_WIDTH,
      sortable: false,
      renderCell: (params) => {
        const src = resolveCardImageSrc(
          params.row.card_id,
          params.value as string,
          detailsByCardId,
          params.row.language,
        );
        return (
          <CardThumb
            src={src}
            alt={params.row.card_name}
            size="sm"
            pending={loadingCardImages && !src && looksLikeTcgdexCardId(params.row.card_id)}
            enlargeOnHover={!!src}
          />
        );
      },
    },
    {
      field: "card_name",
      headerName: "Carta",
      flex: 1,
      minWidth: 140,
      renderCell: (p) => (
        <Box>
          <Typography variant="body2">{p.row.card_name}</Typography>
          <Typography variant="caption" color="text.secondary" display="block">
            {p.row.card_id}
          </Typography>
        </Box>
      ),
    },
    {
      field: "language",
      headerName: "Idioma",
      width: 96,
      sortable: false,
      renderCell: (p) => (
        <Typography variant="body2" color="text.secondary">
          {p.row.language?.trim() || "—"}
        </Typography>
      ),
    },
    {
      field: "rareza",
      headerName: "Rareza",
      width: 104,
      sortable: false,
      renderCell: (p) => {
        const rz = p.row.rareza?.trim();
        return (
          <Typography variant="body2" color="text.secondary">
            {rz ? operationalRarezaLabel(rz) : "—"}
          </Typography>
        );
      },
    },
    {
      field: "unit_cost_cop_ref",
      headerName: "Costo COP (prom.)",
      width: 118,
      sortable: false,
      renderCell: (p) => (
        <Typography variant="body2" sx={{ fontVariantNumeric: "tabular-nums" }}>
          {Math.round(p.row.unit_cost_cop_ref).toLocaleString("es-CO")}
        </Typography>
      ),
    },
    {
      field: "remaining_total",
      headerName: "Restante",
      width: 90,
      type: "number",
    },
    {
      field: "cupo",
      headerName: "Cupo",
      width: 80,
      sortable: false,
      renderCell: (p) => (
        <Typography variant="body2" fontWeight={600}>
          {p.row.cupo}
        </Typography>
      ),
    },
    {
      field: "acciones",
      headerName: "Cantidad",
      width: 240,
      sortable: false,
      renderCell: (p) => {
        const group = p.row as GroupedIncomingCatalogRow;
        const busy = incomingMutatingId === group.id;
        return (
          <Stack direction="row" spacing={1} alignItems="center">
            <TextField
              size="small"
              type="text"
              inputMode="numeric"
              value={cantidadIncoming[group.id] ?? "1"}
              onChange={(e) =>
                setCantidadIncoming((prev) => ({ ...prev, [group.id]: e.target.value }))
              }
              sx={{ width: 76 }}
              disabled={group.cupo <= 0}
            />
            <Button
              size="small"
              variant="contained"
              disabled={group.cupo <= 0 || busy}
              onClick={() => handleAddIncomingGroup(group)}
              sx={{ textTransform: "none" }}
            >
              {busy ? "…" : "Añadir"}
            </Button>
          </Stack>
        );
      },
    },
  ];

  const columns: GridColDef<ReservaCatalogRow>[] = [
    {
      field: "image_url",
      headerName: "",
      width: PANEL_DATAGRID_IMAGE_COL_WIDTH,
      sortable: false,
      renderCell: (params) => {
        const item = params.row;
        return (
          <CardThumb
            src={resolveStockImageUrl(item.card_id, params.value as string)}
            alt=""
            size="sm"
            enlargeOnHover
          />
        );
      },
    },
    {
      field: "card_name",
      headerName: "Carta",
      flex: 1,
      minWidth: 160,
      renderCell: (params) => {
        const item = params.row;
        const name =
          item.owner === "esteban"
            ? `${ESTEBAN_STOCK_MARK} ${item.card_name}`
            : item.card_name;
        return (
          <Stack direction="row" alignItems="center" spacing={0.75} sx={{ minWidth: 0 }}>
            <Typography variant="body2" noWrap title={item.card_name}>
              {name}
            </Typography>
            <Chip
              size="small"
              label={OWNERS_CONFIG.owners[item.owner].label}
              color={item.owner === "esteban" ? "secondary" : "default"}
            />
          </Stack>
        );
      },
    },
    { field: "card_id", headerName: "ID", width: 110 },
    {
      field: "quantity",
      headerName: "Cant.",
      width: 80,
      sortable: false,
      renderCell: (params) => {
        const item = params.row;
        if (
          !isQuantityProduct({
            product_kind: item.product_kind,
            card_id: item.card_id,
          })
        ) {
          return (
            <Typography variant="body2" color="text.disabled">
              —
            </Typography>
          );
        }
        return (
          <Typography variant="body2" fontWeight={600}>
            {typeof item.quantity === "number" ? item.quantity : 0}
          </Typography>
        );
      },
    },
    {
      field: "rareza",
      headerName: "Rareza",
      width: 120,
      sortable: false,
      renderCell: (params) => {
        const rz = params.row.rareza?.trim();
        if (!rz) {
          return (
            <Typography variant="body2" color="text.disabled">
              —
            </Typography>
          );
        }
        return (
          <Typography variant="body2" color="text.secondary">
            {operationalRarezaLabel(rz)}
          </Typography>
        );
      },
    },
    {
      field: "pvp",
      headerName: "PVP ref.",
      width: 120,
      renderCell: (params) => {
        const pvp = params.row.pvp;
        const cur = params.row.pvp_currency;
        if (pvp == null || pvp <= 0)
          return (
            <Typography variant="body2" color="text.disabled">
              —
            </Typography>
          );
        let cop = 0;
        if (cur === "COP") cop = pvp;
        else if (cur === "EUR") cop = convert.toCopFromEur(pvp) ?? 0;
        else if (cur === "USD") cop = convert.toCopFromUsd(pvp) ?? 0;
        return (
          <Typography variant="body2" sx={{ fontVariantNumeric: "tabular-nums" }}>
            {formatCOP(cop.toFixed(0))}
          </Typography>
        );
      },
    },
    {
      field: "precio_reserva",
      headerName: "Precio pedido (COP)",
      width: 160,
      renderCell: (params) => {
        const item = params.row;
        const rowKey = catalogRowKey(item.owner, item._id);
        const defaultVal = getPrecioDefault(item);
        const value = precios[rowKey] ?? (defaultVal > 0 ? String(defaultVal) : "");
        return (
          <TextField
            size="small"
            type="text"
            inputMode="decimal"
            value={value}
            onChange={(e) => setPrecios((prev) => ({ ...prev, [rowKey]: e.target.value }))}
            placeholder={defaultVal > 0 ? String(defaultVal) : "0"}
            sx={{ width: 130, "& .MuiInputBase-input": { py: 0.75 } }}
          />
        );
      },
      sortable: false,
    },
    {
      field: "reservar",
      headerName: "",
      width: 220,
      sortable: false,
      renderCell: (params) => {
        const item = params.row;
        const rowKey = catalogRowKey(item.owner, item._id);
        const loading = reservandoId === rowKey;
        const isQty = isQuantityProduct({
          product_kind: item.product_kind,
          card_id: item.card_id,
        });
        const available = typeof item.quantity === "number" ? item.quantity : 0;
        return (
          <Stack direction="row" spacing={1} alignItems="center">
            {isQty ? (
              <TextField
                size="small"
                type="text"
                inputMode="numeric"
                value={cantidadStock[rowKey] ?? "1"}
                onChange={(e) =>
                  setCantidadStock((prev) => ({ ...prev, [rowKey]: e.target.value }))
                }
                sx={{ width: 64, "& .MuiInputBase-input": { py: 0.75 } }}
                disabled={available <= 0}
              />
            ) : null}
            <Button
              variant="contained"
              size="small"
              onClick={() => handleReservar(item)}
              disabled={loading || !canReservarStock(pedidoReservado) || (isQty && available <= 0)}
              sx={{ textTransform: "none", minWidth: 96 }}
            >
              {loading ? "…" : "Añadir"}
            </Button>
          </Stack>
        );
      },
    },
  ];

  if (!clientId) {
    return (
      <Stack spacing={2} sx={{ p: 3 }}>
        <Alert severity="warning">Falta el cliente en la URL.</Alert>
        <Button variant="outlined" onClick={() => navigate("/clientes")}>
          Ir al listado
        </Button>
      </Stack>
    );
  }

  if (loadingClient || !client) {
    return (
      <Stack alignItems="center" justifyContent="center" minHeight={240} gap={2}>
        <CircularProgress size={32} />
        <Typography color="text.secondary">Cargando cliente…</Typography>
      </Stack>
    );
  }

  return (
    <Stack spacing={3} sx={{ maxWidth: 1100, mx: "auto", p: { xs: 2, sm: 3 } }}>
      <Stack direction="row" alignItems="center" flexWrap="wrap" gap={1}>
        <Button
          color="inherit"
          size="small"
          onClick={() => navigate(clientId ? `/clientes/${clientId}` : "/clientes")}
        >
          ← Detalle cliente
        </Button>
        <Typography variant="h5" component="h1" fontWeight={700} sx={{ flex: 1 }}>
          {esReservaCamino
            ? incomingCliente.length > 0
              ? "Editar reserva"
              : "Crear reserva"
            : "Editar pedido"}{" "}
          · {client.nombre}
        </Typography>
      </Stack>

      {esReservaCamino ? (
        <ReservaContextBar
          client={client}
          units={incomingCliente.reduce((sum, row) => sum + (row.quantity ?? 0), 0)}
          onEditCliente={abrirModalEditar}
          onImportWhatsApp={() => setImportWaReservaOpen(true)}
          onEnviarWhatsApp={() => void enviarReservaWhatsApp()}
          onCopiarMensaje={() => void copiarReservaWhatsApp()}
          waBusy={waReservaBusy}
          copiando={copiandoReserva}
          canEnviar={incomingCliente.length > 0}
        />
      ) : (
      <PedidoContextBar
        client={client}
        pedidoReservado={pedidoReservado}
        pedidoPagado={pedidoPagado}
        onNuevoPedido={() => {
          setPedidoCreateStoreId(undefined);
          setPedidoDialog("create");
        }}
        onEditEntrega={() => setPedidoDialog("edit")}
        onEditCliente={abrirModalEditar}
        onImportWhatsApp={() => setImportWaOpen(true)}
        canImport={canReservarStock(pedidoReservado)}
      />
      )}

      {!esReservaCamino ? (
      <>
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

      <ImportWhatsAppPedidoDialog
        open={importWaOpen}
        onClose={() => setImportWaOpen(false)}
        client={client}
        onImported={async (summary) => {
          await queryClient.invalidateQueries({ queryKey: ["stock"] });
          if (clientId) {
            await queryClient.invalidateQueries({ queryKey: ["reservas", clientId] });
      await invalidatePedidoAbonos(queryClient, stockPedidoId);
            await queryClient.invalidateQueries({ queryKey: ["pedidos", clientId] });
          }
          toast(summary, "success");
        }}
      />

      {clientId ? (
        <NuevoPedidoDialog
          open={pedidoDialog != null}
          mode={pedidoDialog === "edit" ? "edit" : "create"}
          clientId={clientId}
          pedido={pedidoDialog === "edit" ? (pedidoReservado ?? pedidoPagado) : pedidoReservado}
          initialStoreId={pedidoDialog === "create" ? pedidoCreateStoreId : undefined}
          onClose={() => {
            setPedidoDialog(null);
            setPedidoCreateStoreId(undefined);
          }}
        />
      ) : null}

      <Paper
        variant="outlined"
        sx={{ p: 2.5, borderRadius: 2, borderColor: "warning.light", borderWidth: 1 }}
      >
        <Typography variant="subtitle1" fontWeight={700} gutterBottom>
          Líneas reservadas
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Líneas reservadas para este cliente. Ajusta precios aquí o quita líneas.
        </Typography>
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
        {stockPedidoId ? (
          <Box sx={{ mb: 2 }}>
            <PedidoAbonosBlock
              pedidoId={stockPedidoId}
              allowMutate={Boolean(pedidoReservado)}
              onNotify={toast}
            />
          </Box>
        ) : null}
        {loadingReservas ? (
          <Stack direction="row" alignItems="center" gap={1}>
            <CircularProgress size={20} />
            <Typography variant="body2">Cargando…</Typography>
          </Stack>
        ) : reservasConStock.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Aún no hay cartas en el pedido. Usa el catálogo de cartas en stock para añadirlas.
          </Typography>
        ) : (
          <Stack divider={<Divider flexItem />} spacing={0}>
            {reservasConStock.map((r) => {
              const fechaTxt = formatReservaFecha(r.created_at);
              const lineOwner = r.line_owner;
              const lineKey = catalogRowKey(lineOwner, r.stock_id);
              const stockLine = stockCatalogAll.find(
                (s) => s._id === r.stock_id && s.owner === lineOwner,
              );
              const pvpCopAplicable = stockLine ? Math.round(getPrecioDefault(stockLine)) : 0;
              const puedeAplicarPvp = pvpCopAplicable > 0;
              const mutandoLinea =
                quitandoId === lineKey ||
                actualizandoPrecioId === lineKey ||
                aplicandoPvpId === lineKey;
              const precioLinea = (() => {
                const raw = preciosReservadas[lineKey];
                if (raw !== undefined && raw !== "") {
                  const n = parseFloat(raw.replace(",", "."));
                  if (!Number.isNaN(n)) return n;
                }
                return r.precio;
              })();
              const units = reservaLineQuantity(r.quantity);
              const gananciaLinea =
                gananciaEstimadaReservaCop(
                  precioLinea,
                  r.currency ?? "COP",
                  stockLine,
                  convert,
                ) * units;
              return (
                <Stack
                  key={r._id}
                  direction={{ xs: "column", sm: "row" }}
                  spacing={2}
                  alignItems={{ sm: "center" }}
                  py={2}
                >
                  <CardThumb
                    src={resolveStockImageUrl(r.card_id, r.image_url)}
                    alt={r.card_name}
                    size="md"
                    enlargeOnHover
                  />
                  <Box flex={1} minWidth={0}>
                    <Stack direction="row" alignItems="center" flexWrap="wrap" gap={0.75}>
                      <Typography fontWeight={600} noWrap title={r.card_name}>
                        {lineOwner === "esteban" ? `${ESTEBAN_STOCK_MARK} ` : ""}
                        {r.card_name}
                        {units > 1 ? ` ×${units}` : ""}
                      </Typography>
                      <Chip
                        size="small"
                        label={OWNERS_CONFIG.owners[lineOwner].label}
                        color={lineOwner === "esteban" ? "secondary" : "default"}
                      />
                      {r.rareza?.trim() ? (
                        <Chip
                          size="small"
                          variant="outlined"
                          label={operationalRarezaLabel(r.rareza.trim())}
                        />
                      ) : null}
                    </Stack>
                    <Typography variant="caption" color="text.secondary" display="block">
                      {r.card_id}
                      {units > 1 ? ` · ${formatCOP(Math.round(precioLinea))} c/u` : ""}
                    </Typography>
                    {fechaTxt ? (
                      <Typography variant="caption" color="text.secondary">
                        Reservado: {fechaTxt}
                      </Typography>
                    ) : null}
                  </Box>
                  <Stack direction="row" alignItems="flex-start" spacing={1.5} flexWrap="wrap">
                    <TextField
                      label="PVP COP"
                      size="small"
                      type="text"
                      inputMode="decimal"
                      value={getPrecioReservaInput(lineKey, r.precio)}
                      onChange={(e) =>
                        setPreciosReservadas((prev) => ({ ...prev, [lineKey]: e.target.value }))
                      }
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v === "" || Number.isNaN(parseFloat(v.replace(",", ".")))) return;
                        const n = parseFloat(v.replace(",", "."));
                        if (n !== r.precio) handleActualizarPrecioReserva(r.stock_id, v, lineOwner);
                      }}
                      sx={{ width: 120 }}
                    />
                    <ReservaCostMarginAside
                      costUnitCop={
                        stockLine
                          ? amountToCop(stockLine.card_cost, stockLine.currency, convert)
                          : null
                      }
                      marginTotalCop={
                        precioLinea > 0 ? gananciaLinea : null
                      }
                    />
                    {actualizandoPrecioId === lineKey ? (
                      <CircularProgress size={18} />
                    ) : null}
                    {r.precio === 0 && stockLine ? (
                      puedeAplicarPvp ? (
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={() => handleAplicarPvpReserva(r.stock_id, stockLine, lineOwner)}
                          disabled={mutandoLinea}
                          sx={{ textTransform: "none" }}
                        >
                          {aplicandoPvpId === lineKey ? "…" : "Aplicar PVP"}
                        </Button>
                      ) : (
                        <Tooltip title="Sin PVP definido">
                          <span>
                            <Button variant="outlined" size="small" disabled sx={{ textTransform: "none" }}>
                              Aplicar PVP
                            </Button>
                          </span>
                        </Tooltip>
                      )
                    ) : null}
                    <Button
                      color="error"
                      variant="outlined"
                      size="small"
                      onClick={() => handleQuitarReserva(r.stock_id, lineOwner)}
                      disabled={quitandoId === lineKey || aplicandoPvpId === lineKey}
                      sx={{ textTransform: "none" }}
                    >
                      {quitandoId === lineKey ? "…" : "Quitar"}
                    </Button>
                  </Stack>
                </Stack>
              );
            })}
          </Stack>
        )}
      </Paper>

      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
        <Typography variant="subtitle1" fontWeight={700} gutterBottom>
          Cartas en stock
        </Typography>
        <TextField
          fullWidth
          size="small"
          placeholder="Buscar por nombre o ID de carta…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          sx={{ maxWidth: 420, mb: 2 }}
        />
        {stockActiveFailed || stockOtherFailed ? (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {stockActiveFailed && stockOtherFailed
              ? "No se pudo cargar el stock de ninguno de los owners."
              : `No se pudo cargar el stock de ${
                  stockActiveFailed
                    ? OWNERS_CONFIG.owners[activeOwner].label
                    : OWNERS_CONFIG.owners[secondaryOwner].label
                }. Se muestra el que sí cargó.`}
          </Alert>
        ) : null}
        {loadingStock ? (
          <Stack direction="row" alignItems="center" gap={1}>
            <CircularProgress size={20} />
            <Typography variant="body2">Cargando stock…</Typography>
          </Stack>
        ) : stockDisponibleFiltrado.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            {busqueda.trim()
              ? "Ninguna carta coincide con la búsqueda."
              : "No hay cartas disponibles para reservar."}
          </Typography>
        ) : (
          <Box
            sx={{
              border: 1,
              borderColor: "divider",
              borderRadius: 1,
              overflow: "hidden",
              width: "100%",
              maxWidth: "100%",
              "& .MuiDataGrid-columnHeaders": { bgcolor: "grey.50" },
            }}
          >
            <Box sx={{ width: "100%", overflowX: "auto" }}>
              <Box sx={{ minWidth: 560 }}>
                <DataGrid
                  rows={stockDisponibleFiltrado}
                  columns={columns}
                  getRowId={(row) => catalogRowKey(row.owner, row._id)}
                  pageSizeOptions={[10, 25, 50]}
                  initialState={{ pagination: { paginationModel: { pageSize: 15, page: 0 } } }}
                  disableRowSelectionOnClick
                  autoHeight
                  rowHeight={PANEL_DATAGRID_ROW_HEIGHT}
                  density={PANEL_DATAGRID_DENSITY}
                  sx={{ border: 0 }}
                />
              </Box>
            </Box>
          </Box>
        )}
      </Paper>
      </>
      ) : null}

      {esReservaCamino ? (
      <Paper
        ref={caminoRef}
        variant="outlined"
        sx={{ p: 2.5, borderRadius: 2, borderColor: "info.light", borderWidth: 1 }}
      >
        <Typography variant="subtitle1" fontWeight={700} gutterBottom color="info.dark">
          Reserva en camino
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          El PVP de cada carta reservada es editable y se incluye al enviar el mensaje. El cupo por
          variante agrupa lotes; el costo mostrado es el promedio ponderado por unidades restantes.
        </Typography>

        {incomingCliente.length > 0 ? (
          <Stack spacing={1.5} sx={{ mb: 3 }}>
            <Typography variant="subtitle2">Tu reserva en camino</Typography>
            {clientId ? (
              <ReservaIncomingAbonosBlock clientId={clientId} onNotify={toast} />
            ) : null}
            {incomingClienteGrouped.map(({ groupId, rows, qtyTotal, head }) => {
              const src = resolveCardImageSrc(
                head?.card_id,
                head?.image_url,
                detailsByCardId,
                head?.language,
              );
              return (
              <Stack
                key={groupId}
                direction={{ xs: "column", sm: "row" }}
                spacing={2}
                alignItems={{ sm: "center" }}
                sx={{ py: 1, borderBottom: 1, borderColor: "divider" }}
              >
                <CardThumb
                  src={src}
                  alt={head?.card_name ?? "Carta"}
                  size="lg"
                  pending={loadingCardImages && !src && looksLikeTcgdexCardId(head?.card_id)}
                  enlargeOnHover={!!src}
                />
                <Box flex={1} minWidth={0}>
                  <Typography fontWeight={600} noWrap title={head?.card_name}>
                    {head?.card_name ?? "Carta"}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block">
                    {head?.card_id} · Cant.: {qtyTotal}
                    {head?.language ? ` · ${head.language}` : ""}
                    {head?.rareza?.trim()
                      ? ` · ${operationalRarezaLabel(head.rareza.trim())}`
                      : ""}
                  </Typography>
                </Box>
                <Stack direction="row" alignItems="flex-start" flexWrap="wrap" spacing={1.5}>
                  <IncomingPvpField
                    valueCop={incomingGroupPrecioCop(rows)}
                    disabled={incomingMutatingId === groupId}
                    onSave={(cop) => handleSaveIncomingPvp(rows, cop)}
                  />
                  <ReservaCostMarginAside
                    costUnitCop={incomingGroupUnitCostCop(rows)}
                    marginTotalCop={reservaMarginTotalCop(
                      incomingGroupPrecioCop(rows),
                      incomingGroupUnitCostCop(rows),
                      qtyTotal,
                    )}
                  />
                </Stack>
                <Button
                  color="error"
                  variant="outlined"
                  size="small"
                  disabled={incomingMutatingId === groupId}
                  onClick={() => handleDeleteIncomingGroup(groupId, rows)}
                  sx={{ textTransform: "none", alignSelf: { xs: "flex-start", sm: "center" } }}
                >
                  {incomingMutatingId === groupId ? "…" : "Quitar"}
                </Button>
              </Stack>
              );
            })}
          </Stack>
        ) : null}

        <TextField
          fullWidth
          size="small"
          placeholder="Buscar por nombre o ID de carta (en camino)…"
          value={busquedaCamino}
          onChange={(e) => setBusquedaCamino(e.target.value)}
          sx={{ maxWidth: 420, mb: 2 }}
        />

        {loadingIncomingCat || loadingIncomingAll ? (
          <Stack direction="row" alignItems="center" gap={1}>
            <CircularProgress size={20} />
            <Typography variant="body2">Cargando compras en camino…</Typography>
          </Stack>
        ) : incomingGridRows.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            {busquedaCamino.trim()
              ? "Ninguna línea coincide con la búsqueda."
              : "No hay líneas con stock pendiente en lotes abiertos."}
          </Typography>
        ) : (
          <Box
            sx={{
              border: 1,
              borderColor: "divider",
              borderRadius: 1,
              overflow: "hidden",
              width: "100%",
              maxWidth: "100%",
              "& .MuiDataGrid-columnHeaders": { bgcolor: "grey.50" },
            }}
          >
            <Box sx={{ width: "100%", overflowX: "auto" }}>
              <Box sx={{ minWidth: 560 }}>
                <DataGrid
                  rows={incomingGridRows}
                  columns={columnsIncoming}
                  getRowId={(row) => row.id}
                  pageSizeOptions={[10, 25, 50]}
                  initialState={{ pagination: { paginationModel: { pageSize: 10, page: 0 } } }}
                  disableRowSelectionOnClick
                  autoHeight
                  rowHeight={PANEL_DATAGRID_ROW_HEIGHT}
                  density={PANEL_DATAGRID_DENSITY}
                  sx={{ border: 0 }}
                />
              </Box>
            </Box>
          </Box>
        )}
      </Paper>
      ) : null}

      <ImportWhatsAppReservaDialog
        open={importWaReservaOpen}
        onClose={() => setImportWaReservaOpen(false)}
        client={client}
        onImported={async (summary) => {
          await queryClient.invalidateQueries({ queryKey: ["reservas-incoming"] });
          if (clientId) {
            await queryClient.invalidateQueries({ queryKey: ["reservas-incoming", clientId] });
          }
          await invalidateReservaIncomingAbonos(queryClient, clientId);
          toast(summary, "success");
        }}
      />

      <ClienteFormDialog
        open={modalEditarCliente}
        mode="edit"
        client={client}
        onClose={cerrarModalEditar}
      />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4500}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity={snackbar.severity}
          variant="filled"
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
          sx={{ width: "100%" }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Stack>
  );
}
