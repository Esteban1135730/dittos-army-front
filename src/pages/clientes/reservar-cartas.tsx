import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../api/client";
import {
  API_CLIENT,
  API_RESERVA,
  API_STOCK,
} from "./cliente-types";
import { DataGrid, type GridColDef } from "@mui/x-data-grid";
import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
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
  Typography,
} from "@mui/material";
import { useExchangeRates } from "../../utils/tasa";
import { formatCOP } from "../../utils/convert";
import type { StockListItem } from "../../types/stock";

type StockItem = StockListItem;

type ClientItem = {
  _id: string;
  nombre: string;
  tienda_entrega: string;
  celular?: string;
  facebook_usuario?: string;
  metodo_contacto: string;
  notas?: string;
};

type ReservaItem = {
  _id: string;
  client_id: string;
  stock_id: string;
  precio: number;
  currency: string;
  created_at?: string;
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
  const [busqueda, setBusqueda] = useState("");
  const [modalEditarCliente, setModalEditarCliente] = useState(false);
  const [editNombre, setEditNombre] = useState("");
  const [editTienda, setEditTienda] = useState("");
  const [editCelular, setEditCelular] = useState("");
  const [editMetodoContacto, setEditMetodoContacto] = useState<"whatsapp" | "facebook">("whatsapp");
  const [editFacebookUsuario, setEditFacebookUsuario] = useState("");
  const [editNotas, setEditNotas] = useState("");
  const [guardandoCliente, setGuardandoCliente] = useState(false);
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
      const res = await apiClient.get(`${API_CLIENT}/${clientId}`);
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
      await apiClient.put(`${API_CLIENT}/${clientId}`, {
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
      const res = await apiClient.get(API_STOCK);
      return Array.isArray(res.data) ? res.data : [];
    },
  });

  const { data: reservasRaw = [], isLoading: loadingReservas } = useQuery<ReservaItem[]>({
    queryKey: ["reservas", clientId],
    queryFn: async () => {
      const res = await apiClient.get(`${API_RESERVA}/client/${clientId}`);
      return Array.isArray(res.data) ? res.data : [];
    },
    enabled: !!clientId,
  });

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
      const res = await apiClient.post(API_RESERVA, {
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
      const res = await apiClient.delete(`${API_RESERVA}/stock/${stockId}`);
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
      const res = await apiClient.put(`${API_RESERVA}/stock/${stockId}`, {
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

  const getPrecioReservaInput = (stockId: string, precioActual: number): string => {
    if (preciosReservadas[stockId] !== undefined) return preciosReservadas[stockId];
    return precioActual > 0 ? String(precioActual) : "";
  };

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
    <Stack spacing={3} sx={{ maxWidth: 1100, mx: "auto", width: "100%" }}>
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
          <Button variant="outlined" size="small" onClick={abrirModalEditar} sx={{ alignSelf: "flex-start" }}>
            Datos del cliente
          </Button>
        </Stack>
      </Paper>

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
        {loadingReservas ? (
          <Stack direction="row" alignItems="center" gap={1}>
            <CircularProgress size={20} />
            <Typography variant="body2">Cargando…</Typography>
          </Stack>
        ) : reservasConStock.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Aún no hay cartas en el pedido. Usa la tabla inferior para añadirlas.
          </Typography>
        ) : (
          <Stack divider={<Divider flexItem />} spacing={0}>
            {reservasConStock.map((r) => {
              const fechaTxt = formatReservaFecha(r.created_at);
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
                    <Typography fontWeight={600} noWrap title={r.card_name}>
                      {r.card_name}
                    </Typography>
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
                    <Button
                      color="error"
                      variant="outlined"
                      size="small"
                      onClick={() => handleQuitarReserva(r.stock_id)}
                      disabled={quitandoId === r.stock_id}
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
          Catálogo disponible
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
              "& .MuiDataGrid-columnHeaders": { bgcolor: "grey.50" },
            }}
          >
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
