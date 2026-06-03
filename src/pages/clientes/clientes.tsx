import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { DataGrid, type GridColDef, type GridRowParams } from "@mui/x-data-grid";
import { useState, useMemo, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Chip,
  FormControlLabel,
  Snackbar,
  Stack,
  Switch,
  Typography,
} from "@mui/material";
import type { StockListItem } from "../../types/stock";
import ClienteFormDialog from "./cliente-form-dialog";
import {
  ALERTA_HORAS_AMARILLO,
  ALERTA_HORAS_ROJO,
  API_CLIENT,
  API_RESERVA,
  API_STOCK,
  type ClientItem,
  type ReservaIncomingItem,
  type ReservaItem,
} from "./cliente-types";
import {
  abrirWhatsAppConTexto,
  buildWhatsAppPedidoText,
} from "./mensaje-reserva-pedido";
import { aggregateReservasTotales } from "./clientes-resumen-pedidos";
import { formatCOP } from "../../utils/convert";
import { useExchangeRates } from "../../utils/tasa";

export type { ClientItem } from "./cliente-types";

export default function ClientesPage() {
  const navigate = useNavigate();
  const { convert } = useExchangeRates();
  const [nuevoOpen, setNuevoOpen] = useState(false);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "error";
  }>({ open: false, message: "", severity: "success" });

  const showSnackbar = (message: string, severity: "success" | "error") => {
    setSnackbar({ open: true, message, severity });
  };

  const [soloConPedido, setSoloConPedido] = useState(false);
  const [contactoLoadingId, setContactoLoadingId] = useState<string | null>(null);

  const { data: clientes = [], isLoading } = useQuery<ClientItem[]>({
    queryKey: ["clientes"],
    queryFn: async () => {
      const res = await axios.get(API_CLIENT);
      return Array.isArray(res.data) ? res.data : [];
    },
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

  const reservasPorCliente = useMemo(() => {
    const map: Record<string, number> = {};
    reservas.forEach((r) => {
      map[r.client_id] = (map[r.client_id] ?? 0) + 1;
    });
    return map;
  }, [reservas]);

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

  const sortedClientes = useMemo(() => {
    let list = [...clientes];
    if (soloConPedido) {
      list = list.filter(
        (c) =>
          (statsPorCliente[c._id]?.count ?? 0) > 0 || (incomingUnitsPorCliente[c._id] ?? 0) > 0,
      );
    }
    list.sort((a, b) => {
      const ca = statsPorCliente[a._id]?.count ?? 0;
      const cb = statsPorCliente[b._id]?.count ?? 0;
      if ((ca > 0) !== (cb > 0)) return cb > 0 ? 1 : -1;
      if (ca === 0 && cb === 0) return a.nombre.localeCompare(b.nombre, "es");
      const oa = statsPorCliente[a._id]?.oldestMs ?? 0;
      const ob = statsPorCliente[b._id]?.oldestMs ?? 0;
      return oa - ob;
    });
    return list;
  }, [clientes, soloConPedido, statsPorCliente]);

  const getRowClassName = useCallback(
    (params: { id: string | number }) => {
      const id = String(params.id);
      const st = statsPorCliente[id];
      if (!st?.count) return "";
      const hours = (Date.now() - st.oldestMs) / 3600000;
      if (hours >= ALERTA_HORAS_ROJO) return "row-pedido-critico";
      if (hours >= ALERTA_HORAS_AMARILLO) return "row-pedido-alerta";
      return "";
    },
    [statsPorCliente],
  );

  const enviarResumenWhatsApp = async (cliente: ClientItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const rs = reservas.filter((r) => r.client_id === cliente._id);
    const incomingCliente = incomingAll.filter((r) => r.client_id === cliente._id);
    if (rs.length === 0 && incomingCliente.length === 0) return;
    setContactoLoadingId(cliente._id);
    try {
      const lines = rs.map((r) => {
        const st = stockMap[r.stock_id];
        return {
          card_id: st?.card_id ?? "",
          card_name: st?.card_name ?? "Carta",
          precio: r.precio,
          rareza: st?.rareza,
        };
      });
      const incomingLines = incomingCliente.map((x) => ({
        card_id: x.card_id ?? "",
        card_name: x.card_name ?? "Carta",
        quantity: x.quantity,
        rareza: x.rareza,
      }));
      const texto = await buildWhatsAppPedidoText({
        clientName: cliente.nombre,
        tiendaEntrega: cliente.tienda_entrega,
        lines,
        incomingLines: incomingLines.length ? incomingLines : undefined,
      });
      abrirWhatsAppConTexto(cliente.celular, texto);
    } finally {
      setContactoLoadingId(null);
    }
  };

  const irReservar = (cliente: ClientItem, e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/clientes/${cliente._id}/reservar`);
  };

  const columns: GridColDef[] = [
    {
      field: "principal",
      headerName: "Cliente",
      flex: 1.2,
      minWidth: 200,
      sortable: false,
      renderCell: (params) => {
        const c = params.row as ClientItem;
        const n = reservasPorCliente[c._id] ?? 0;
        const inc = incomingUnitsPorCliente[c._id] ?? 0;
        return (
          <Box sx={{ py: 0.5 }}>
            <Typography fontWeight={600}>{c.nombre}</Typography>
            <Typography variant="caption" color="text.secondary" display="block">
              {c.tienda_entrega}
              {c.celular ? ` · ${c.celular}` : ""}
            </Typography>
            {n > 0 || inc > 0 ? (
              <Chip
                label={[
                  n > 0 ? `${n} reserva(s)` : null,
                  inc > 0 ? `${inc} en camino` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
                size="small"
                color="primary"
                sx={{ mt: 0.5, height: 22 }}
              />
            ) : (
              <Typography variant="caption" color="text.disabled" display="block" sx={{ mt: 0.25 }}>
                Sin reservas
              </Typography>
            )}
          </Box>
        );
      },
    },
    {
      field: "wa",
      headerName: "WhatsApp",
      width: 130,
      sortable: false,
      filterable: false,
      renderCell: (params) => {
        const c = params.row as ClientItem;
        const tieneWa =
          (reservasPorCliente[c._id] ?? 0) > 0 || (incomingUnitsPorCliente[c._id] ?? 0) > 0;
        const busy = contactoLoadingId === c._id;
        return (
          <Button
            variant="contained"
            color="success"
            size="small"
            disabled={!tieneWa || busy}
            onClick={(e) => enviarResumenWhatsApp(c, e)}
            sx={{ textTransform: "none" }}
          >
            {busy ? "…" : "WhatsApp"}
          </Button>
        );
      },
    },
    {
      field: "reservar",
      headerName: "Reserva",
      width: 120,
      sortable: false,
      filterable: false,
      renderCell: (params) => {
        const c = params.row as ClientItem;
        return (
          <Button
            variant="outlined"
            size="small"
            onClick={(e) => irReservar(c, e)}
            sx={{ textTransform: "none" }}
          >
            Reservar
          </Button>
        );
      },
    },
  ];

  const onRowClick = (params: GridRowParams<ClientItem>) => {
    navigate(`/clientes/${params.row._id}`);
  };

  if (isLoading) {
    return (
      <Stack alignItems="center" py={6}>
        <Alert severity="info">Cargando clientes…</Alert>
      </Stack>
    );
  }

  return (
    <Stack spacing={2.5} sx={{ maxWidth: 960, mx: "auto", p: { xs: 2, sm: 3 } }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        alignItems={{ xs: "stretch", sm: "center" }}
        justifyContent="space-between"
        spacing={2}
      >
        <Typography variant="h4" component="h1" fontWeight={700}>
          Clientes
        </Typography>
        <Stack direction="row" flexWrap="wrap" alignItems="center" gap={2}>
          <FormControlLabel
            control={
              <Switch
                checked={soloConPedido}
                onChange={(e) => setSoloConPedido(e.target.checked)}
                color="primary"
                size="small"
              />
            }
            label="Solo con pedido"
          />
          <Button component={Link} to="/clientes/imprimir-pedidos" variant="text" size="small">
            Imprimir pedidos
          </Button>
          <Button variant="contained" onClick={() => setNuevoOpen(true)}>
            Nuevo cliente
          </Button>
        </Stack>
      </Stack>

      <Typography variant="body2" color="text.secondary">
        Pulsa una fila para abrir el <strong>detalle</strong> (pedido, historial, notas, finalizar venta).
      </Typography>

      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{
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
            {formatCOP(Math.round(resumenPedidos.ventasEsperadasCop))}
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
              resumenPedidos.gananciaEstimadaCop > 0
                ? "success.main"
                : resumenPedidos.gananciaEstimadaCop < 0
                  ? "error.main"
                  : "text.primary"
            }
          >
            {formatCOP(Math.round(resumenPedidos.gananciaEstimadaCop))}
          </Typography>
        </Box>
      </Stack>

      <Stack
        sx={{
          bgcolor: "background.paper",
          borderRadius: 2,
          border: 1,
          borderColor: "divider",
          overflow: "hidden",
          width: "100%",
          maxWidth: "100%",
        }}
      >
        <Box sx={{ width: "100%", overflowX: "auto" }}>
          <Box sx={{ minWidth: 520 }}>
            <DataGrid
              rows={sortedClientes}
              columns={columns}
              getRowId={(row) => row._id}
              getRowClassName={getRowClassName}
              onRowClick={onRowClick}
              pageSizeOptions={[10, 25, 50]}
              initialState={{
                pagination: { paginationModel: { pageSize: 25, page: 0 } },
              }}
              disableRowSelectionOnClick
              autoHeight
              rowHeight={72}
              sx={{
                border: 0,
                cursor: "pointer",
                "& .MuiDataGrid-columnHeaders": { bgcolor: "grey.50" },
                "& .row-pedido-alerta": { backgroundColor: "rgba(251, 191, 36, 0.16)" },
                "& .row-pedido-critico": { backgroundColor: "rgba(248, 113, 113, 0.2)" },
              }}
            />
          </Box>
        </Box>
      </Stack>

      <ClienteFormDialog
        open={nuevoOpen}
        mode="create"
        onClose={() => setNuevoOpen(false)}
        onSaved={() => showSnackbar("Cliente creado.", "success")}
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
