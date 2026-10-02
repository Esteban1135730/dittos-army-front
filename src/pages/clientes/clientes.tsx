import { useQuery, useQueries, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { DataGrid, type GridColDef, type GridRowParams } from "@mui/x-data-grid";
import { useState, useMemo, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Chip,
  Paper,
  Snackbar,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import type { StockListItem } from "../../types/stock";
import { LoadingScreen } from "../../components/loading";
import {
  PANEL_DATAGRID_DENSITY,
  PANEL_DATAGRID_ROW_HEIGHT,
} from "../../theme/panel-density";
import ClienteFormDialog from "./cliente-form-dialog";
import ImportWhatsAppFromListDialog from "./import-whatsapp-from-list-dialog";
import {
  ALERTA_HORAS_AMARILLO,
  ALERTA_HORAS_ROJO,
  API_RESERVA,
  type ClientItem,
  type ReservaIncomingItem,
  type ReservaItem,
} from "./cliente-types";
import {
  CLIENTES_QUERY_KEY,
  STOCK_LIST_QUERY_KEY,
  fetchClientesRaw,
  fetchStockListRaw,
  selectClientList,
} from "../../api/list-queries";
import { useEventCallback } from "../../utils/use-event-callback";
import { abrirWhatsAppConTexto, buildWhatsAppPedidoText } from "./mensaje-reserva-pedido";
import { aggregateReservasTotales, reservaLineQuantity } from "./clientes-resumen-pedidos";
import { formatCOP } from "../../utils/convert";
import { useExchangeRates } from "../../utils/tasa";
import { findPedidoAbierto, type PedidoItem } from "./pedido-types";
import { descripcionEntrega, formatFechaTentativa, pedidoStatusLabel } from "./pedido-entrega-label";
import { clientItemId } from "./cliente-id";
import { fetchPedidosByClient } from "./fetch-pedidos";
import { entregaUrgenciaLabel } from "./pedido-ui-utils";
import {
  clientesDataGridSx,
  clientesKpiCardSx,
  clientesKpiGridSx,
  clientesKpiWarnSx,
  clientesMutedLabelSx,
  clientesPageSx,
  clientesSectionPaperSx,
  clientesStatValueSx,
  clientesToolbarSx,
} from "./clientes-page-layout";

export type { ClientItem } from "./cliente-types";

type ListFilter = "todos" | "con_pedido" | "con_reserva" | "urgentes";

const EMPTY_CLIENTES: ClientItem[] = [];
const EMPTY_STOCK: StockListItem[] = [];
const getClientRowId = (row: ClientItem) => clientItemId(row);
const getAutoRowHeight = () => "auto" as const;

export default function ClientesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { convert } = useExchangeRates();
  const [nuevoOpen, setNuevoOpen] = useState(false);
  const [importWhatsAppOpen, setImportWhatsAppOpen] = useState(false);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "error";
  }>({ open: false, message: "", severity: "success" });

  const showSnackbar = (message: string, severity: "success" | "error") => {
    setSnackbar({ open: true, message, severity });
  };

  const [listFilter, setListFilter] = useState<ListFilter>("todos");
  const [busquedaNombre, setBusquedaNombre] = useState("");
  const [contactoLoadingId, setContactoLoadingId] = useState<string | null>(null);

  const { data: clientes = EMPTY_CLIENTES, isLoading } = useQuery({
    queryKey: CLIENTES_QUERY_KEY,
    queryFn: fetchClientesRaw,
    select: selectClientList,
  });

  const { data: reservas = [] } = useQuery<ReservaItem[]>({
    queryKey: ["reservas"],
    queryFn: async () => {
      const res = await axios.get(API_RESERVA);
      return Array.isArray(res.data) ? res.data : [];
    },
  });

  const { data: incomingAll = [] } = useQuery<ReservaIncomingItem[]>({
    queryKey: ["reservas-incoming"],
    queryFn: async () => {
      const res = await axios.get(`${API_RESERVA}/incoming`);
      return Array.isArray(res.data) ? res.data : [];
    },
  });

  const { data: stockRaw = EMPTY_STOCK } = useQuery({
    queryKey: STOCK_LIST_QUERY_KEY,
    queryFn: () => fetchStockListRaw(),
  });

  const stockMap = useMemo(() => {
    const m: Record<string, StockListItem> = {};
    stockRaw.forEach((s) => {
      m[s._id] = s;
    });
    return m;
  }, [stockRaw]);

  const reservasPorCliente = useMemo(() => {
    const map: Record<string, number> = {};
    reservas.forEach((r) => {
      const cid = r.client_id;
      if (!cid) return;
      map[cid] = (map[cid] ?? 0) + 1;
    });
    return map;
  }, [reservas]);

  const clientIdsConReserva = useMemo(
    () => [...new Set(reservas.map((r) => r.client_id).filter(Boolean))],
    [reservas],
  );

  const pedidoQueries = useQueries({
    queries: clientIdsConReserva.map((cid) => ({
      queryKey: ["pedidos", cid],
      queryFn: () => fetchPedidosByClient(cid),
      staleTime: 60_000,
    })),
  });

  const pedidoAbiertoPorCliente = useMemo(() => {
    const map: Record<string, PedidoItem | undefined> = {};
    clientIdsConReserva.forEach((cid, i) => {
      const pedidos = pedidoQueries[i]?.data ?? [];
      map[cid] = findPedidoAbierto(pedidos);
    });
    return map;
  }, [clientIdsConReserva, pedidoQueries]);

  const incomingUnitsPorCliente = useMemo(() => {
    const m: Record<string, number> = {};
    incomingAll.forEach((r) => {
      m[r.client_id] = (m[r.client_id] ?? 0) + r.quantity;
    });
    return m;
  }, [incomingAll]);

  const resumenPedidos = useMemo(
    () => aggregateReservasTotales(reservas, stockMap, convert),
    [reservas, stockMap, convert],
  );

  const statsPorCliente = useMemo(() => {
    const byClient: Record<string, { count: number; oldestMs: number }> = {};
    reservas.forEach((r) => {
      const t = r.created_at ? new Date(r.created_at).getTime() : Date.now();
      if (!byClient[r.client_id]) {
        byClient[r.client_id] = { count: 0, oldestMs: t };
      }
      const e = byClient[r.client_id];
      e.count += 1;
      e.oldestMs = Math.min(e.oldestMs, t);
    });
    return byClient;
  }, [reservas]);

  const alertLevelPorCliente = useCallback(
    (clientId: string): "critico" | "alerta" | null => {
      const st = statsPorCliente[clientId];
      if (!st?.count) return null;
      const hours = (Date.now() - st.oldestMs) / 3600000;
      if (hours >= ALERTA_HORAS_ROJO) return "critico";
      if (hours >= ALERTA_HORAS_AMARILLO) return "alerta";
      return null;
    },
    [statsPorCliente],
  );

  const sortedClientes = useMemo(() => {
    let list = clientes.filter((c) => clientItemId(c));
    const termino = busquedaNombre.trim().toLowerCase();
    if (termino) {
      list = list.filter((c) => (c.nombre ?? "").toLowerCase().includes(termino));
    }
    if (listFilter === "con_pedido") {
      list = list.filter((c) => {
        const cid = clientItemId(c);
        return Boolean(pedidoAbiertoPorCliente[cid]) || (reservasPorCliente[cid] ?? 0) > 0;
      });
    } else if (listFilter === "con_reserva") {
      list = list.filter((c) => (incomingUnitsPorCliente[clientItemId(c)] ?? 0) > 0);
    } else if (listFilter === "urgentes") {
      list = list.filter((c) => alertLevelPorCliente(clientItemId(c)) != null);
    }
    list.sort((a, b) => {
      const idA = clientItemId(a);
      const idB = clientItemId(b);
      const urgA = alertLevelPorCliente(idA);
      const urgB = alertLevelPorCliente(idB);
      if (urgA !== urgB) {
        if (urgA === "critico") return -1;
        if (urgB === "critico") return 1;
        if (urgA === "alerta") return -1;
        if (urgB === "alerta") return 1;
      }
      const ca = reservasPorCliente[idA] ?? 0;
      const cb = reservasPorCliente[idB] ?? 0;
      if ((ca > 0) !== (cb > 0)) return cb > 0 ? 1 : -1;
      if (ca === 0 && cb === 0) return a.nombre.localeCompare(b.nombre, "es");
      const oa = statsPorCliente[idA]?.oldestMs ?? 0;
      const ob = statsPorCliente[idB]?.oldestMs ?? 0;
      return oa - ob;
    });
    return list;
  }, [
    clientes,
    busquedaNombre,
    listFilter,
    statsPorCliente,
    pedidoAbiertoPorCliente,
    incomingUnitsPorCliente,
    reservasPorCliente,
    alertLevelPorCliente,
  ]);

  const listStats = useMemo(() => {
    const conPedido = clientes.filter((c) => {
      const cid = clientItemId(c);
      return Boolean(pedidoAbiertoPorCliente[cid]) || (reservasPorCliente[cid] ?? 0) > 0;
    }).length;
    const conReserva = clientes.filter(
      (c) => (incomingUnitsPorCliente[clientItemId(c)] ?? 0) > 0,
    ).length;
    const urgentes = clientes.filter(
      (c) => alertLevelPorCliente(clientItemId(c)) != null,
    ).length;
    return { conPedido, conReserva, urgentes };
  }, [clientes, reservasPorCliente, incomingUnitsPorCliente, alertLevelPorCliente, pedidoAbiertoPorCliente]);

  const getRowClassName = useCallback(
    (params: { id: string | number }) => {
      const level = alertLevelPorCliente(String(params.id));
      if (level === "critico") return "row-pedido-critico";
      if (level === "alerta") return "row-pedido-alerta";
      return "";
    },
    [alertLevelPorCliente],
  );

  const enviarResumenWhatsApp = async (cliente: ClientItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const cid = clientItemId(cliente);
    const rs = reservas.filter((r) => r.client_id === cid);
    const incomingCliente = incomingAll.filter((r) => r.client_id === cid);
    if (rs.length === 0 && incomingCliente.length === 0) return;
    setContactoLoadingId(cid);
    try {
      const lines = rs.map((r) => {
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
        language: x.language,
        precio_cop: x.precio_cop,
      }));
      const abierto =
        pedidoAbiertoPorCliente[cid] ??
        findPedidoAbierto(await fetchPedidosByClient(cid));
      const texto = await buildWhatsAppPedidoText({
        clientName: cliente.nombre,
        descripcionEntrega: descripcionEntrega(abierto),
        lines,
        incomingLines: incomingLines.length ? incomingLines : undefined,
      });
      abrirWhatsAppConTexto(cliente.celular, texto);
      showSnackbar("Se abrió WhatsApp con el resumen.", "success");
    } finally {
      setContactoLoadingId(null);
    }
  };

  const irReservar = (cliente: ClientItem, e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/clientes/${clientItemId(cliente)}/reservar`);
  };

  const irReservaCamino = (cliente: ClientItem, e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/clientes/${clientItemId(cliente)}/reservar?camino=1`);
  };

  const irDetalle = (cliente: ClientItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    navigate(`/clientes/${clientItemId(cliente)}`);
  };

  const onEnviarResumenWhatsApp = useEventCallback(enviarResumenWhatsApp);
  const onIrReservar = useEventCallback(irReservar);
  const onIrReservaCamino = useEventCallback(irReservaCamino);

  const columns = useMemo<GridColDef[]>(() => [
    {
      field: "principal",
      headerName: "Cliente",
      flex: 1.2,
      minWidth: 220,
      sortable: false,
      renderCell: (params) => {
        const c = params.row as ClientItem;
        const cid = clientItemId(c);
        const n = reservasPorCliente[cid] ?? 0;
        const inc = incomingUnitsPorCliente[cid] ?? 0;
        const urg = alertLevelPorCliente(cid);
        return (
          <Box sx={{ py: 0.5 }}>
            <Stack direction="row" alignItems="center" gap={0.75} flexWrap="wrap">
              <Typography fontWeight={600}>{c.nombre}</Typography>
              {urg === "critico" ? (
                <Chip label="Urgente" size="small" color="error" sx={{ height: 20 }} />
              ) : urg === "alerta" ? (
                <Chip label="Revisar" size="small" color="warning" sx={{ height: 20 }} />
              ) : null}
            </Stack>
            <Typography variant="caption" color="text.secondary" display="block">
              {c.celular ? c.celular : "Sin contacto"}
              {c.metodo_contacto === "facebook" ? " · Messenger" : ""}
            </Typography>
            {n > 0 || inc > 0 ? (
              <Stack direction="row" gap={0.5} flexWrap="wrap" sx={{ mt: 0.5 }}>
                {n > 0 ? (
                  <Chip
                    label={`${n} en pedido`}
                    size="small"
                    color="warning"
                    variant="outlined"
                    sx={{ height: 22 }}
                  />
                ) : null}
                {inc > 0 ? (
                  <Chip
                    label={`${inc} en reserva`}
                    size="small"
                    color="info"
                    variant="outlined"
                    sx={{ height: 22 }}
                  />
                ) : null}
              </Stack>
            ) : (
              <Typography variant="caption" color="text.disabled" display="block" sx={{ mt: 0.25 }}>
                Sin pedido ni reserva
              </Typography>
            )}
          </Box>
        );
      },
    },
    {
      field: "pedido",
      headerName: "Pedido en curso",
      flex: 1.1,
      minWidth: 240,
      sortable: false,
      renderCell: (params) => {
        const c = params.row as ClientItem;
        const cid = clientItemId(c);
        const pedido = pedidoAbiertoPorCliente[cid];
        if (!pedido) {
          const n = reservasPorCliente[cid] ?? 0;
          return (
            <Typography variant="caption" color="text.secondary">
              {n > 0 ? "Cartas de stock sin pedido" : "—"}
            </Typography>
          );
        }
        const urgLabel = entregaUrgenciaLabel(
          pedido.fecha_tentativa_entrega,
          pedido.status,
        );
        return (
          <Box sx={{ py: 0.5 }}>
            <Stack direction="row" gap={0.5} flexWrap="wrap" mb={0.25}>
              <Chip
                size="small"
                label={pedidoStatusLabel(pedido.status)}
                color={pedido.status === "pagado" ? "success" : "warning"}
                sx={{ height: 22 }}
              />
              {urgLabel ? (
                <Chip
                  size="small"
                  label={urgLabel}
                  color={
                    urgLabel.includes("Venció") ? "error" : urgLabel === "Entrega hoy" ? "warning" : "default"
                  }
                  sx={{ height: 22 }}
                />
              ) : null}
            </Stack>
            <Typography variant="caption" display="block" noWrap title={descripcionEntrega(pedido)}>
              {descripcionEntrega(pedido) || "Entrega pendiente de definir"}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {formatFechaTentativa(pedido.fecha_tentativa_entrega)}
            </Typography>
          </Box>
        );
      },
    },
    {
      field: "reserva",
      headerName: "Reserva en camino",
      flex: 0.7,
      minWidth: 160,
      sortable: false,
      renderCell: (params) => {
        const c = params.row as ClientItem;
        const inc = incomingUnitsPorCliente[clientItemId(c)] ?? 0;
        if (inc === 0) {
          return (
            <Typography variant="caption" color="text.secondary">
              —
            </Typography>
          );
        }
        return (
          <Box sx={{ py: 0.5 }}>
            <Chip
              size="small"
              label="En camino"
              color="info"
              sx={{ height: 22, mb: 0.25 }}
            />
            <Typography variant="caption" display="block" color="text.secondary">
              {inc} unidad{inc === 1 ? "" : "es"}
            </Typography>
          </Box>
        );
      },
    },
    {
      field: "wa",
      headerName: "Mensaje",
      width: 152,
      sortable: false,
      filterable: false,
      renderCell: (params) => {
        const c = params.row as ClientItem;
        const cid = clientItemId(c);
        const tieneWa =
          (reservasPorCliente[cid] ?? 0) > 0 || (incomingUnitsPorCliente[cid] ?? 0) > 0;
        const busy = contactoLoadingId === cid;
        return (
          <Box
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <Button
              variant="contained"
              color="success"
              size="small"
              disabled={!tieneWa || busy}
              onClick={(e) => onEnviarResumenWhatsApp(c, e)}
              sx={{ textTransform: "none", fontWeight: 600, whiteSpace: "nowrap" }}
            >
              {busy ? "Enviando…" : "Enviar resumen"}
            </Button>
          </Box>
        );
      },
    },
    {
      field: "detalle",
      headerName: "",
      width: 112,
      sortable: false,
      filterable: false,
      renderCell: (params) => {
        const c = params.row as ClientItem;
        const cid = clientItemId(c);
        return (
          <Box
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <Button
              component={Link}
              to={`/clientes/${cid}`}
              variant="text"
              size="small"
              sx={{ textTransform: "none", fontWeight: 600, whiteSpace: "nowrap" }}
            >
              Ver ficha
            </Button>
          </Box>
        );
      },
    },
    {
      field: "reservar",
      headerName: "Acciones",
      width: 200,
      sortable: false,
      filterable: false,
      renderCell: (params) => {
        const c = params.row as ClientItem;
        return (
          <Stack
            direction="row"
            spacing={0.75}
            alignItems="center"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <Button
              variant="outlined"
              size="small"
              onClick={(e) => onIrReservar(c, e)}
              sx={{ textTransform: "none", fontWeight: 600, whiteSpace: "nowrap" }}
            >
              Pedido
            </Button>
            <Button
              variant="outlined"
              size="small"
              color="info"
              onClick={(e) => onIrReservaCamino(c, e)}
              sx={{ textTransform: "none", fontWeight: 600, whiteSpace: "nowrap" }}
            >
              Reserva
            </Button>
          </Stack>
        );
      },
    },
  ], [
    alertLevelPorCliente,
    contactoLoadingId,
    incomingUnitsPorCliente,
    onEnviarResumenWhatsApp,
    onIrReservaCamino,
    onIrReservar,
    pedidoAbiertoPorCliente,
    reservasPorCliente,
  ]);

  const onRowClick = useEventCallback((params: GridRowParams<ClientItem>) => {
    irDetalle(params.row);
  });

  if (isLoading) {
    return <LoadingScreen message="Cargando clientes…" />;
  }

  return (
    <Stack spacing={3} sx={clientesPageSx}>
      <Box sx={clientesToolbarSx}>
        <Box>
          <Typography variant="h4" component="h1" fontWeight={800} letterSpacing="-0.02em">
            Clientes
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {clientes.length} registro{clientes.length === 1 ? "" : "s"} · clic en fila para abrir la ficha
          </Typography>
        </Box>
        <Stack direction="row" alignItems="center" gap={1.5} flexShrink={0}>
          <Button
            component={Link}
            to="/clientes/imprimir-pedidos"
            variant="outlined"
            sx={{ textTransform: "none", fontWeight: 600 }}
          >
            Imprimir pedidos
          </Button>
          <Button
            variant="outlined"
            onClick={() => setImportWhatsAppOpen(true)}
            sx={{ textTransform: "none", fontWeight: 600 }}
          >
            Importar WhatsApp
          </Button>
          <Button variant="contained" onClick={() => setNuevoOpen(true)} sx={{ textTransform: "none", fontWeight: 600 }}>
            Nuevo cliente
          </Button>
        </Stack>
      </Box>

      <Box sx={clientesKpiGridSx}>
        {[
          { label: "Con pedido", value: String(listStats.conPedido) },
          { label: "Con reserva", value: String(listStats.conReserva) },
          { label: "Requieren atención", value: String(listStats.urgentes), warn: listStats.urgentes > 0 },
          {
            label: "Ventas esperadas (COP)",
            value: formatCOP(Math.round(resumenPedidos.ventasEsperadasCop)),
          },
        ].map((kpi) => (
          <Paper
            key={kpi.label}
            variant="outlined"
            sx={[clientesKpiCardSx, kpi.warn ? clientesKpiWarnSx : null]}
          >
            <Typography sx={clientesMutedLabelSx}>{kpi.label}</Typography>
            <Typography variant="h5" sx={clientesStatValueSx}>
              {kpi.value}
            </Typography>
          </Paper>
        ))}
      </Box>

      <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2}>
        <Tabs
          value={listFilter}
          onChange={(_, v: ListFilter) => setListFilter(v)}
          sx={{
            minHeight: 40,
            "& .MuiTab-root": { minHeight: 40, py: 0, px: 2, textTransform: "none", fontWeight: 600 },
          }}
        >
          <Tab value="todos" label={`Todos · ${clientes.length}`} />
          <Tab value="con_pedido" label={`Con pedido · ${listStats.conPedido}`} />
          <Tab value="con_reserva" label={`Con reserva · ${listStats.conReserva}`} />
          <Tab value="urgentes" label={`Urgentes · ${listStats.urgentes}`} />
        </Tabs>
        <TextField
          size="small"
          label="Buscar cliente"
          placeholder="Nombre…"
          value={busquedaNombre}
          onChange={(e) => setBusquedaNombre(e.target.value)}
          sx={{ width: 300, flexShrink: 0 }}
        />
      </Stack>

      {busquedaNombre.trim() && sortedClientes.length === 0 ? (
        <Alert severity="info">Ningún cliente coincide con la búsqueda.</Alert>
      ) : null}

      <Paper variant="outlined" sx={{ ...clientesSectionPaperSx, px: 3, py: 1.75 }}>
        <Stack direction="row" alignItems="baseline" justifyContent="space-between" gap={2}>
          <Typography sx={clientesMutedLabelSx}>Ganancia estimada (reservas)</Typography>
          <Typography
            variant="h6"
            fontWeight={700}
            color={
              resumenPedidos.gananciaEstimadaCop > 0
                ? "success.main"
                : resumenPedidos.gananciaEstimadaCop < 0
                  ? "error.main"
                  : "text.primary"
            }
          >
            {formatCOP(Math.round(resumenPedidos.gananciaEstimadaCop))}
          </Typography>
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={clientesSectionPaperSx}>
        <Box sx={{ width: "100%", overflowX: "auto" }}>
              <Box sx={{ minWidth: 1160 }}>
            <DataGrid
              rows={sortedClientes}
              columns={columns}
              getRowId={getClientRowId}
              getRowClassName={getRowClassName}
              onRowClick={onRowClick}
              pageSizeOptions={[15, 25, 50, 100]}
              initialState={{
                pagination: { paginationModel: { pageSize: 25, page: 0 } },
              }}
              disableRowSelectionOnClick
              autoHeight
              rowHeight={PANEL_DATAGRID_ROW_HEIGHT}
              getRowHeight={getAutoRowHeight}
              density={PANEL_DATAGRID_DENSITY}
              sx={clientesDataGridSx}
            />
          </Box>
        </Box>
      </Paper>

      <ClienteFormDialog
        open={nuevoOpen}
        mode="create"
        onClose={() => setNuevoOpen(false)}
        onSaved={() => showSnackbar("Cliente creado.", "success")}
      />

      <ImportWhatsAppFromListDialog
        open={importWhatsAppOpen}
        onClose={() => setImportWhatsAppOpen(false)}
        clientes={clientes}
        onImported={async (summary) => {
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ["clientes"] }),
            queryClient.invalidateQueries({ queryKey: ["pedidos"] }),
            queryClient.invalidateQueries({ queryKey: ["reservas"] }),
            queryClient.invalidateQueries({ queryKey: ["stock"] }),
          ]);
          showSnackbar(summary, "success");
        }}
      />

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
