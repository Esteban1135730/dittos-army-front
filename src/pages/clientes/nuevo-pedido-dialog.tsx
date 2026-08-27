import { useEffect, useState } from "react";
import axios from "axios";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { extractAxiosErrorMessage } from "./extract-axios-error";
import {
  API_PEDIDO,
  pedidoId,
  type PedidoItem,
  type PedidoWriteBody,
  type TiendaEntregaCatalogItem,
} from "./pedido-types";
import { TiendaEntregaPicker } from "./tienda-entrega-picker";

type Props = {
  open: boolean;
  mode: "create" | "edit";
  clientId: string;
  pedido?: PedidoItem | null;
  /** Preselección al crear desde la sección de tiendas. */
  initialStoreId?: string;
  onClose: () => void;
  onSaved?: (pedido: PedidoItem) => void;
};

function todayLocalIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default function NuevoPedidoDialog({
  open,
  mode,
  clientId,
  pedido,
  initialStoreId,
  onClose,
  onSaved,
}: Props) {
  const queryClient = useQueryClient();
  const [entregaEnTienda, setEntregaEnTienda] = useState(true);
  const [storeId, setStoreId] = useState("");
  const [ciudad, setCiudad] = useState("Bogotá");
  const [punto, setPunto] = useState("");
  const [notas, setNotas] = useState("");
  const [fecha, setFecha] = useState(todayLocalIso());
  const [guardando, setGuardando] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data: tiendas = [] } = useQuery<TiendaEntregaCatalogItem[]>({
    queryKey: ["pedido-tiendas"],
    queryFn: async () => {
      const res = await axios.get(API_PEDIDO + "/tiendas");
      return Array.isArray(res.data) ? res.data : [];
    },
    staleTime: 24 * 60 * 60 * 1000,
    enabled: open,
  });

  useEffect(() => {
    if (!open) return;
    setErrorMsg(null);
    if (mode === "edit" && pedido) {
      setEntregaEnTienda(pedido.entrega_en_tienda);
      setStoreId(pedido.store_id ?? "");
      setCiudad(pedido.ciudad ?? "Bogotá");
      setPunto(pedido.direccion_o_punto ?? "");
      setNotas(pedido.notas_entrega ?? "");
      setFecha(pedido.fecha_tentativa_entrega ?? todayLocalIso());
    } else {
      setEntregaEnTienda(true);
      setStoreId(initialStoreId || tiendas[0]?.id || "");
      setCiudad("Bogotá");
      setPunto("");
      setNotas("");
      setFecha(todayLocalIso());
    }
  }, [open, mode, pedido?.id, tiendas, initialStoreId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!fecha.trim()) {
      setErrorMsg("La fecha tentativa de entrega es obligatoria.");
      return;
    }
    if (entregaEnTienda && !storeId) {
      setErrorMsg("Selecciona una tienda de entrega.");
      return;
    }
    if (!entregaEnTienda && (!ciudad.trim() || !punto.trim())) {
      setErrorMsg("Ciudad y dirección o punto de encuentro son obligatorios.");
      return;
    }
    const body: PedidoWriteBody = {
      entrega_en_tienda: entregaEnTienda,
      fecha_tentativa_entrega: fecha,
      notas_entrega: notas.trim() || undefined,
    };
    if (entregaEnTienda) {
      body.store_id = storeId;
    } else {
      body.ciudad = ciudad.trim();
      body.direccion_o_punto = punto.trim();
    }
    setGuardando(true);
    try {
      let saved: PedidoItem;
      if (mode === "create") {
        const res = await axios.post<PedidoItem>(API_PEDIDO, {
          ...body,
          client_id: clientId,
        });
        saved = res.data;
      } else if (pedido) {
        const res = await axios.patch<PedidoItem>(
          `${API_PEDIDO}/${pedidoId(pedido)}`,
          body,
        );
        saved = res.data;
      } else {
        setErrorMsg("Pedido no encontrado.");
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["pedidos", clientId] });
      onSaved?.(saved);
      onClose();
    } catch (err) {
      setErrorMsg(extractAxiosErrorMessage(err, "No se pudo guardar el pedido."));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={guardando ? undefined : onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{ sx: { borderRadius: 2 } }}
    >
      <form onSubmit={handleSubmit}>
        <DialogTitle>
          {mode === "edit" ? "Editar entrega" : "Nuevo pedido"}
        </DialogTitle>
        <DialogContent dividers>
          {errorMsg ? (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErrorMsg(null)}>
              {errorMsg}
            </Alert>
          ) : null}
          <Stack spacing={2.5}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={entregaEnTienda}
                  onChange={(e) => setEntregaEnTienda(e.target.checked)}
                />
              }
              label="¿Entrega en tienda?"
            />
            {entregaEnTienda ? (
              <Stack spacing={1}>
                <Typography variant="subtitle2" color="text.secondary">
                  Elige tienda en Bogotá
                </Typography>
                <TiendaEntregaPicker
                  tiendas={tiendas}
                  selectedId={storeId}
                  onSelect={setStoreId}
                />
              </Stack>
            ) : (
              <>
                <TextField
                  label="Ciudad"
                  required
                  fullWidth
                  value={ciudad}
                  onChange={(e) => setCiudad(e.target.value)}
                />
                <TextField
                  label="Dirección o punto de encuentro"
                  required
                  fullWidth
                  multiline
                  minRows={2}
                  value={punto}
                  onChange={(e) => setPunto(e.target.value)}
                />
                <TextField
                  label="Notas de entrega"
                  fullWidth
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                />
              </>
            )}
            <TextField
              label="Fecha tentativa de entrega"
              type="date"
              required
              fullWidth
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              InputLabelProps={{ shrink: true }}
              helperText="El operador verá alertas si la fecha está cerca o vencida"
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <Button onClick={onClose} disabled={guardando} color="inherit">
            Cancelar
          </Button>
          <Button type="submit" variant="contained" disabled={guardando}>
            {guardando ? "Guardando…" : mode === "edit" ? "Guardar" : "Crear pedido"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
