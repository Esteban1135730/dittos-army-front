import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../api/client";
import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Paper,
  Snackbar,
  Stack,
  Typography,
} from "@mui/material";
import type { StockListItem } from "../../types/stock";
import { formatCOP } from "../../utils/convert";
import ClienteFormDialog from "./cliente-form-dialog";
import {
  API_CLIENT,
  API_RESERVA,
  API_SALES,
  API_STOCK,
  ALERTA_HORAS_AMARILLO,
  ALERTA_HORAS_ROJO,
  type ClientItem,
  type ReservaItem,
  type VentaClienteRow,
} from "./cliente-types";
import {
  abrirWhatsAppConTexto,
  buildWhatsAppPedidoText,
} from "./mensaje-reserva-pedido";

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
  const [formOpen, setFormOpen] = useState(false);
  const [stubCaminoOpen, setStubCaminoOpen] = useState(false);
  const [finalizando, setFinalizando] = useState(false);
  const [waBusy, setWaBusy] = useState(false);
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
      const res = await apiClient.get(`${API_CLIENT}/${clientId}`);
      return res.data;
    },
    enabled: !!clientId,
  });

  const { data: reservas = [] } = useQuery<ReservaItem[]>({
    queryKey: ["reservas", clientId],
    queryFn: async () => {
      const res = await apiClient.get(`${API_RESERVA}/client/${clientId}`);
      return Array.isArray(res.data) ? res.data : [];
    },
    enabled: !!clientId,
  });

  const { data: stockRaw = [] } = useQuery<StockListItem[]>({
    queryKey: ["stock"],
    queryFn: async () => {
      const res = await apiClient.get(API_STOCK);
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
      const res = await apiClient.get(`${API_SALES}/by-client/${clientId}`, { params: { limit: 100 } });
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

  const enviarWhatsApp = async () => {
    if (!client || reservas.length === 0) return;
    setWaBusy(true);
    try {
      const lines = reservas.map((r) => {
        const st = stockMap[r.stock_id];
        return {
          card_id: st?.card_id ?? "",
          card_name: st?.card_name ?? "Carta",
          precio: r.precio,
          rareza: st?.rareza,
        };
      });
      const texto = await buildWhatsAppPedidoText({
        clientName: client.nombre,
        tiendaEntrega: client.tienda_entrega,
        lines,
      });
      abrirWhatsAppConTexto(client.celular, texto);
    } finally {
      setWaBusy(false);
    }
  };

  const abrirMessenger = () => {
    if (!client) return;
    const u = client.facebook_usuario?.trim().replace(/^@+/, "") ?? "";
    if (!u) return;
    window.open(`https://m.me/${encodeURIComponent(u)}`, "_blank", "noopener,noreferrer");
  };

  const finalizarVenta = async () => {
    if (!clientId) return;
    setFinalizando(true);
    try {
      const res = await apiClient.post<{ success: boolean; vendidas?: number; error?: string }>(
        `${API_RESERVA}/client/${clientId}/finalizar-venta`,
      );
      const data = res.data;
      if (data.success) {
        show(`Venta finalizada: ${data.vendidas ?? 0} carta(s).`, "success");
        await queryClient.invalidateQueries({ queryKey: ["reservas", clientId] });
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
        <Typography variant="h5" component="h1" fontWeight={700} sx={{ flex: 1 }}>
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
            <strong>Celular:</strong> {client.celular?.trim() || "—"}
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
            disabled={reservas.length === 0 || waBusy}
            onClick={enviarWhatsApp}
          >
            {waBusy ? "…" : "WhatsApp (resumen pedido)"}
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
            <Button variant="outlined" size="small" color="warning" onClick={() => setStubCaminoOpen(true)}>
              En camino (pronto)
            </Button>
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
        {reservasConStock.length === 0 ? (
          <Typography color="text.secondary" variant="body2">
            No hay líneas en el pedido. Usa «Editar reserva» para agregar cartas.
          </Typography>
        ) : (
          <Stack spacing={2}>
            {reservasConStock.map(({ reserva: r, stock: st }) => (
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
                {st?.image_url ? (
                  <Box
                    component="img"
                    src={st.image_url}
                    alt=""
                    sx={{ width: 48, height: 64, objectFit: "contain", borderRadius: 1, bgcolor: "grey.100" }}
                  />
                ) : (
                  <Box sx={{ width: 48, height: 64, bgcolor: "grey.100", borderRadius: 1 }} />
                )}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography fontWeight={600}>{st?.card_name ?? "Carta"}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {st?.card_id}
                    {st?.rareza ? ` · ${st.rareza}` : ""}
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 0.5 }}>
                    {formatCOP(r.precio)}
                    {r.currency && r.currency !== "COP" ? ` (${r.currency})` : ""}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                    Reservado: {formatFechaReserva(r.created_at)}
                  </Typography>
                </Box>
              </Box>
            ))}
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

      <Dialog open={stubCaminoOpen} onClose={() => setStubCaminoOpen(false)}>
        <DialogTitle>Reservar cartas en camino</DialogTitle>
        <DialogContent>
          <Typography color="text.secondary">
            Pronto podrás reservar cartas de compras en camino. Función en preparación.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={() => setStubCaminoOpen(false)}>
            Entendido
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
