import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
  API_INCOMING,
  API_RESERVA,
  API_STOCK,
  type ClientItem,
  type ReservaIncomingItem,
  type ReservaItem,
} from "./cliente-types";
import {
  compareIncomingLinesByOldest,
  incomingVariantGroupKey,
  weightedAverageUnitCostCop,
} from "../incoming/incoming-variant-group";
import { aggregateReservasTotales, gananciaEstimadaReservaCop } from "./clientes-resumen-pedidos";
import ImportWhatsAppPedidoDialog from "./import-whatsapp-pedido-dialog";

type StockItem = StockListItem;

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
  const { convert } = useExchangeRates();
  const [precios, setPrecios] = useState<Record<string, string>>({});
  const [preciosReservadas, setPreciosReservadas] = useState<Record<string, string>>({});
  const [reservandoId, setReservandoId] = useState<string | null>(null);
  const [quitandoId, setQuitandoId] = useState<string | null>(null);
  const [actualizandoPrecioId, setActualizandoPrecioId] = useState<string | null>(null);
  const [aplicandoPvpId, setAplicandoPvpId] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [modalEditarCliente, setModalEditarCliente] = useState(false);
  const [editNombre, setEditNombre] = useState("");
  const [editTienda, setEditTienda] = useState("");
  const [editCelular, setEditCelular] = useState("");
  const [editMetodoContacto, setEditMetodoContacto] = useState<"whatsapp" | "facebook">("whatsapp");
  const [editFacebookUsuario, setEditFacebookUsuario] = useState("");
  const [editNotas, setEditNotas] = useState("");
  const [guardandoCliente, setGuardandoCliente] = useState(false);
  const [importWaOpen, setImportWaOpen] = useState(false);
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

  const abrirModalEditar = () => {
    if (client) {
      setEditNombre(client.nombre);
      setEditTienda(client.tienda_entrega);
      setEditCelular(client.celular ?? "");
      setEditMetodoContacto((client.metodo_contacto as "whatsapp" | "facebook") || "whatsapp");
      setEditFacebookUsuario(client.facebook_usuario ?? "");
      setEditNotas(client.notas ?? "");
      setModalEditarCliente(true);
    }
  };

  const cerrarModalEditar = () => setModalEditarCliente(false);

  const guardarCliente = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId || !client) return;
    if (!editNombre.trim() || !editTienda.trim()) {
      toast("Nombre y tienda de entrega son obligatorios.", "error");
      return;
    }
    if (editMetodoContacto === "facebook" && !editFacebookUsuario.trim()) {
      toast("Usuario de Facebook es obligatorio para contacto Facebook.", "error");
      return;
    }
    setGuardandoCliente(true);
    try {
      await axios.put(`${API_CLIENT}/${clientId}`, {
        nombre: editNombre.trim(),
        tienda_entrega: editTienda.trim(),
        celular: editCelular.trim() || undefined,
        metodo_contacto: editMetodoContacto,
        facebook_usuario:
          editMetodoContacto === "facebook" ? editFacebookUsuario.trim() : undefined,
        notas: editNotas.trim() || undefined,
      });
      await queryClient.invalidateQueries({ queryKey: ["client", clientId] });
      await queryClient.invalidateQueries({ queryKey: ["clientes"] });
      toast("Datos del cliente actualizados.", "success");
      cerrarModalEditar();
    } catch {
      toast("Error al guardar los datos del cliente.", "error");
    } finally {
      setGuardandoCliente(false);
    }
  };

  const { data: stockRaw = [], isLoading: loadingStock } = useQuery<StockItem[]>({
    queryKey: ["stock"],
    queryFn: async () => {
      const res = await axios.get(API_STOCK);
      return Array.isArray(res.data) ? res.data : [];
    },
  });

  const { data: reservasRaw = [], isLoading: loadingReservas } = useQuery<ReservaItem[]>({
    queryKey: ["reservas", clientId],
    queryFn: async () => {
      const res = await axios.get(`${API_RESERVA}/client/${clientId}`);
      return Array.isArray(res.data) ? res.data : [];
    },
    enabled: !!clientId,
  });

  const [searchParams] = useSearchParams();
  const caminoRef = useRef<HTMLDivElement | null>(null);
  const [busquedaCamino, setBusquedaCamino] = useState("");
  const [cantidadIncoming, setCantidadIncoming] = useState<Record<string, string>>({});
  const [incomingMutatingId, setIncomingMutatingId] = useState<string | null>(null);

  const { data: incomingCatalog = [], isLoading: loadingIncomingCat } = useQuery<IncomingCatalogRow[]>({
    queryKey: ["incoming-catalog-open"],
    queryFn: async () => {
      const openRes = await axios.get(`${API_INCOMING}/batch/open`);
      const batches = Array.isArray(openRes.data) ? openRes.data : [];
      const rows: IncomingCatalogRow[] = [];
      for (const b of batches as Array<{ batch_id: string; purchase_date?: string }>) {
        const itemsRes = await axios.get(`${API_INCOMING}/batch/${b.batch_id}/items`);
        const arr = Array.isArray(itemsRes.data) ? itemsRes.data : [];
        for (const it of arr as IncomingCatalogRow[]) {
          rows.push({
            ...it,
            batch_purchase_date: b.purchase_date ?? null,
          });
        }
      }
      return rows;
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
        image_url: oldest.image_url,
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

  useEffect(() => {
    if (searchParams.get("camino") !== "1") return;
    const t = window.setTimeout(() => {
      caminoRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 350);
    return () => window.clearTimeout(t);
  }, [searchParams]);

  const stockDisponible = useMemo(
    () =>
      stockRaw.filter(
        (s) =>
          s.card_state !== "vendida" &&
          s.card_state !== "propiedad" &&
          s.card_state !== "reserva",
      ),
    [stockRaw],
  );

  const stockMap = useMemo(() => {
    const m: Record<string, StockItem> = {};
    stockRaw.forEach((s) => {
      m[s._id] = s;
    });
    return m;
  }, [stockRaw]);

  const resumenReserva = useMemo(
    () => aggregateReservasTotales(reservasRaw, stockMap, convert),
    [reservasRaw, stockMap, convert],
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
    return reservasRaw
      .map((r) => {
        const stock = stockRaw.find((s) => s._id === r.stock_id);
        return stock
          ? {
              ...r,
              card_name: stock.card_name,
              image_url: stock.image_url,
              card_id: stock.card_id,
            }
          : null;
      })
      .filter(
        (r): r is ReservaItem & { card_name: string; image_url: string; card_id: string } =>
          r !== null,
      );
  }, [reservasRaw, stockRaw]);

  const getPrecioDefault = (item: StockItem): number => {
    if (item.pvp != null && item.pvp > 0 && item.pvp_currency) {
      if (item.pvp_currency === "COP") return item.pvp;
      if (item.pvp_currency === "EUR") return convert.toCopFromEur(item.pvp) ?? 0;
      if (item.pvp_currency === "USD") return convert.toCopFromUsd(item.pvp) ?? 0;
    }
    return 0;
  };

  const getPrecioReserva = (stockId: string, item: StockItem): number => {
    const v = precios[stockId];
    if (v !== undefined && v !== "") {
      const n = parseFloat(v.replace(",", "."));
      if (!Number.isNaN(n)) return n;
    }
    return getPrecioDefault(item);
  };

  const handleReservar = async (item: StockItem) => {
    if (!clientId || !client) return;
    const precio = getPrecioReserva(item._id, item);
    if (precio <= 0) {
      toast("Ingresa un precio mayor a 0.", "error");
      return;
    }
    setReservandoId(item._id);
    try {
      const res = await axios.post(API_RESERVA, {
        client_id: clientId,
        stock_id: item._id,
        precio: Math.round(precio),
        currency: "COP",
      });
      if (res.data && (res.data as { error?: string }).error) {
        toast((res.data as { error: string }).error, "error");
        return;
      }
      const next = { ...precios };
      delete next[item._id];
      setPrecios(next);
      await queryClient.invalidateQueries({ queryKey: ["stock"] });
      await queryClient.invalidateQueries({ queryKey: ["reservas", clientId] });
      toast(`«${item.card_name}» añadida al pedido.`, "success");
    } catch {
      toast("Error al reservar la carta.", "error");
    } finally {
      setReservandoId(null);
    }
  };

  const handleQuitarReserva = async (stockId: string) => {
    setQuitandoId(stockId);
    try {
      const res = await axios.delete(`${API_RESERVA}/stock/${stockId}`);
      if ((res.data as { success?: boolean }).success !== true) {
        toast((res.data as { error?: string }).error ?? "Error al quitar reserva.", "error");
        return;
      }
      const next = { ...preciosReservadas };
      delete next[stockId];
      setPreciosReservadas(next);
      await queryClient.invalidateQueries({ queryKey: ["stock"] });
      await queryClient.invalidateQueries({ queryKey: ["reservas", clientId] });
      toast("Línea quitada del pedido.", "success");
    } catch {
      toast("Error al quitar la reserva.", "error");
    } finally {
      setQuitandoId(null);
    }
  };

  const handleActualizarPrecioReserva = async (stockId: string, precioStr: string) => {
    const n = parseFloat(precioStr.replace(",", "."));
    if (Number.isNaN(n) || n < 0) return;
    setActualizandoPrecioId(stockId);
    try {
      const res = await axios.put(`${API_RESERVA}/stock/${stockId}`, {
        precio: Math.round(n),
        currency: "COP",
      });
      if (res.data && (res.data as { error?: string }).error) {
        toast((res.data as { error: string }).error, "error");
        return;
      }
      setPreciosReservadas((prev) => {
        const next = { ...prev };
        delete next[stockId];
        return next;
      });
      await queryClient.invalidateQueries({ queryKey: ["reservas", clientId] });
      toast("Precio actualizado.", "success");
    } catch {
      toast("Error al actualizar el precio.", "error");
    } finally {
      setActualizandoPrecioId(null);
    }
  };

  const handleAplicarPvpReserva = async (stockId: string, stock: StockItem) => {
    const precioCop = Math.round(getPrecioDefault(stock));
    if (precioCop <= 0) return;
    setAplicandoPvpId(stockId);
    try {
      const res = await axios.put(`${API_RESERVA}/stock/${stockId}`, {
        precio: precioCop,
        currency: "COP",
      });
      if (res.data && (res.data as { error?: string }).error) {
        toast((res.data as { error: string }).error, "error");
        return;
      }
      setPreciosReservadas((prev) => {
        const next = { ...prev };
        delete next[stockId];
        return next;
      });
      await queryClient.invalidateQueries({ queryKey: ["reservas", clientId] });
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

  const handleDeleteIncomingGroup = async (groupId: string, rows: ReservaIncomingItem[]) => {
    if (rows.length === 0) return;
    setIncomingMutatingId(groupId);
    try {
      for (const r of rows) {
        await axios.delete(`${API_RESERVA}/incoming/${r._id}`);
      }
      await queryClient.invalidateQueries({ queryKey: ["reservas-incoming"] });
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

  const getPrecioReservaInput = (stockId: string, precioActual: number): string => {
    if (preciosReservadas[stockId] !== undefined) return preciosReservadas[stockId];
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
      width: 72,
      sortable: false,
      renderCell: (params) => (
        <Box
          component="img"
          src={params.value as string}
          alt=""
          sx={{ width: 44, height: 60, objectFit: "contain", borderRadius: 1, bgcolor: "grey.100" }}
        />
      ),
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
      renderCell: (p) => (
        <Typography variant="body2" color="text.secondary">
          {p.row.rareza?.trim() || "—"}
        </Typography>
      ),
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

  const columns: GridColDef[] = [
    {
      field: "image_url",
      headerName: "",
      width: 72,
      sortable: false,
      renderCell: (params) => (
        <Box
          component="img"
          src={params.value as string}
          alt=""
          sx={{ width: 44, height: 60, objectFit: "contain", borderRadius: 1, bgcolor: "grey.100" }}
        />
      ),
    },
    { field: "card_name", headerName: "Carta", flex: 1, minWidth: 180 },
    { field: "card_id", headerName: "ID", width: 110 },
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
        const item = params.row as StockItem;
        const defaultVal = getPrecioDefault(item);
        const value = precios[item._id] ?? (defaultVal > 0 ? String(defaultVal) : "");
        return (
          <TextField
            size="small"
            type="text"
            inputMode="decimal"
            value={value}
            onChange={(e) => setPrecios((prev) => ({ ...prev, [item._id]: e.target.value }))}
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
      width: 112,
      sortable: false,
      renderCell: (params) => {
        const item = params.row as StockItem;
        const loading = reservandoId === item._id;
        return (
          <Button
            variant="contained"
            size="small"
            onClick={() => handleReservar(item)}
            disabled={loading}
            sx={{ textTransform: "none", minWidth: 96 }}
          >
            {loading ? "…" : "Añadir"}
          </Button>
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
          Editar pedido · {client.nombre}
        </Typography>
      </Stack>

      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }}>
          <Stack spacing={0.5} flex={1}>
            <Stack direction="row" flexWrap="wrap" gap={1} alignItems="center">
              <Chip label={client.tienda_entrega} size="small" variant="outlined" />
              {client.celular ? (
                <Typography variant="body2" color="text.secondary">
                  {client.celular}
                </Typography>
              ) : null}
            </Stack>
            {client.notas?.trim() ? (
              <Alert severity="info" icon={false} sx={{ py: 0.5, mt: 1 }}>
                <Typography variant="caption" component="span" fontWeight={600}>
                  Notas:{" "}
                </Typography>
                <Typography variant="body2" component="span" sx={{ whiteSpace: "pre-wrap" }}>
                  {client.notas.trim()}
                </Typography>
              </Alert>
            ) : null}
          </Stack>
          <Stack direction="row" spacing={1} sx={{ alignSelf: "flex-start" }}>
            <Button variant="outlined" size="small" onClick={() => setImportWaOpen(true)}>
              Importar desde WhatsApp
            </Button>
            <Button variant="outlined" size="small" onClick={abrirModalEditar}>
              Datos del cliente
            </Button>
          </Stack>
        </Stack>
      </Paper>

      <ImportWhatsAppPedidoDialog
        open={importWaOpen}
        onClose={() => setImportWaOpen(false)}
        client={client}
        onImported={async (summary) => {
          await queryClient.invalidateQueries({ queryKey: ["stock"] });
          if (clientId) {
            await queryClient.invalidateQueries({ queryKey: ["reservas", clientId] });
          }
          toast(summary, "success");
        }}
      />

      <Paper
        variant="outlined"
        sx={{ p: 2.5, borderRadius: 2, bgcolor: "warning.50", borderColor: "warning.light" }}
      >
        <Typography variant="subtitle1" fontWeight={700} color="warning.dark" gutterBottom>
          Pedido actual
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
              const stockLine = stockRaw.find((s) => s._id === r.stock_id);
              const pvpCopAplicable = stockLine ? Math.round(getPrecioDefault(stockLine)) : 0;
              const puedeAplicarPvp = pvpCopAplicable > 0;
              const mutandoLinea =
                quitandoId === r.stock_id ||
                actualizandoPrecioId === r.stock_id ||
                aplicandoPvpId === r.stock_id;
              const precioLinea = (() => {
                const raw = preciosReservadas[r.stock_id];
                if (raw !== undefined && raw !== "") {
                  const n = parseFloat(raw.replace(",", "."));
                  if (!Number.isNaN(n)) return n;
                }
                return r.precio;
              })();
              const gananciaLinea = gananciaEstimadaReservaCop(
                precioLinea,
                r.currency ?? "COP",
                stockLine,
                convert,
              );
              return (
                <Stack
                  key={r._id}
                  direction={{ xs: "column", sm: "row" }}
                  spacing={2}
                  alignItems={{ sm: "center" }}
                  py={2}
                >
                  <Box
                    component="img"
                    src={r.image_url}
                    alt=""
                    sx={{ width: 52, height: 72, objectFit: "contain", borderRadius: 1, bgcolor: "background.paper" }}
                  />
                  <Box flex={1} minWidth={0}>
                    <Stack direction="row" alignItems="center" flexWrap="wrap" gap={0.75}>
                      <Typography fontWeight={600} noWrap title={r.card_name}>
                        {r.card_name}
                      </Typography>
                      <Chip
                        size="small"
                        variant="outlined"
                        color={
                          gananciaLinea > 0 ? "success" : gananciaLinea < 0 ? "error" : "default"
                        }
                        label={`Ganancia: ${formatCOP(Math.round(gananciaLinea))}`}
                      />
                    </Stack>
                    <Typography variant="caption" color="text.secondary" display="block">
                      {r.card_id}
                    </Typography>
                    {fechaTxt ? (
                      <Typography variant="caption" color="text.secondary">
                        Reservado: {fechaTxt}
                      </Typography>
                    ) : null}
                  </Box>
                  <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
                    <TextField
                      label="COP"
                      size="small"
                      type="text"
                      inputMode="decimal"
                      value={getPrecioReservaInput(r.stock_id, r.precio)}
                      onChange={(e) =>
                        setPreciosReservadas((prev) => ({ ...prev, [r.stock_id]: e.target.value }))
                      }
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v === "" || Number.isNaN(parseFloat(v.replace(",", ".")))) return;
                        const n = parseFloat(v.replace(",", "."));
                        if (n !== r.precio) handleActualizarPrecioReserva(r.stock_id, v);
                      }}
                      sx={{ width: 120 }}
                    />
                    {actualizandoPrecioId === r.stock_id ? (
                      <CircularProgress size={18} />
                    ) : null}
                    {r.precio === 0 && stockLine ? (
                      puedeAplicarPvp ? (
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={() => handleAplicarPvpReserva(r.stock_id, stockLine)}
                          disabled={mutandoLinea}
                          sx={{ textTransform: "none" }}
                        >
                          {aplicandoPvpId === r.stock_id ? "…" : "Aplicar PVP"}
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
                      onClick={() => handleQuitarReserva(r.stock_id)}
                      disabled={quitandoId === r.stock_id || aplicandoPvpId === r.stock_id}
                      sx={{ textTransform: "none" }}
                    >
                      {quitandoId === r.stock_id ? "…" : "Quitar"}
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
                  getRowId={(row) => row._id}
                  pageSizeOptions={[10, 25, 50]}
                  initialState={{ pagination: { paginationModel: { pageSize: 15, page: 0 } } }}
                  disableRowSelectionOnClick
                  autoHeight
                  rowHeight={68}
                  sx={{ border: 0 }}
                />
              </Box>
            </Box>
          </Box>
        )}
      </Paper>

      <Paper
        ref={caminoRef}
        variant="outlined"
        sx={{ p: 2.5, borderRadius: 2, bgcolor: "info.50", borderColor: "info.light" }}
      >
        <Typography variant="subtitle1" fontWeight={700} gutterBottom color="info.dark">
          Cartas en camino (sin precio hasta llegada)
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          El cupo por variante (misma carta, rareza e idioma) agrupa varios lotes; el costo mostrado es el promedio
          ponderado por unidades restantes en esos lotes.
        </Typography>

        {incomingCliente.length > 0 ? (
          <Stack spacing={1.5} sx={{ mb: 3 }}>
            <Typography variant="subtitle2">Tu pedido en camino</Typography>
            {incomingClienteGrouped.map(({ groupId, rows, qtyTotal, head }) => (
              <Stack
                key={groupId}
                direction={{ xs: "column", sm: "row" }}
                spacing={2}
                alignItems={{ sm: "center" }}
                sx={{ py: 1, borderBottom: 1, borderColor: "divider" }}
              >
                <Box
                  component="img"
                  src={head?.image_url || undefined}
                  alt=""
                  sx={{ width: 44, height: 60, objectFit: "contain", borderRadius: 1, bgcolor: "background.paper" }}
                />
                <Box flex={1} minWidth={0}>
                  <Typography fontWeight={600} noWrap title={head?.card_name}>
                    {head?.card_name ?? "Carta"}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block">
                    {head?.card_id} · Cant.: {qtyTotal}
                    {head?.language ? ` · ${head.language}` : ""}
                    {head?.rareza ? ` · ${head.rareza}` : ""}
                  </Typography>
                </Box>
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
            ))}
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
                  rowHeight={68}
                  sx={{ border: 0 }}
                />
              </Box>
            </Box>
          </Box>
        )}
      </Paper>

      <Dialog open={modalEditarCliente} onClose={guardandoCliente ? undefined : cerrarModalEditar} maxWidth="sm" fullWidth>
        <form onSubmit={guardarCliente}>
          <DialogTitle>Datos del cliente</DialogTitle>
          <DialogContent dividers>
            <Stack spacing={2} sx={{ pt: 0.5 }}>
              <TextField
                label="Nombre"
                required
                fullWidth
                value={editNombre}
                onChange={(e) => setEditNombre(e.target.value)}
              />
              <TextField
                label="Tienda de entrega"
                required
                fullWidth
                value={editTienda}
                onChange={(e) => setEditTienda(e.target.value)}
              />
              <TextField
                label="Celular"
                fullWidth
                value={editCelular}
                onChange={(e) => setEditCelular(e.target.value)}
              />
              <TextField
                select
                label="Canal"
                fullWidth
                value={editMetodoContacto}
                onChange={(e) => setEditMetodoContacto(e.target.value as "whatsapp" | "facebook")}
                SelectProps={{ native: true }}
              >
                <option value="whatsapp">WhatsApp</option>
                <option value="facebook">Facebook</option>
              </TextField>
              {editMetodoContacto === "facebook" && (
                <TextField
                  label="Usuario Facebook"
                  required
                  fullWidth
                  value={editFacebookUsuario}
                  onChange={(e) => setEditFacebookUsuario(e.target.value)}
                />
              )}
              <TextField
                label="Notas internas"
                fullWidth
                multiline
                minRows={3}
                value={editNotas}
                onChange={(e) => setEditNotas(e.target.value)}
              />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button onClick={cerrarModalEditar} disabled={guardandoCliente} color="inherit">
              Cancelar
            </Button>
            <Button type="submit" variant="contained" disabled={guardandoCliente}>
              {guardandoCliente ? "Guardando…" : "Guardar"}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

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
