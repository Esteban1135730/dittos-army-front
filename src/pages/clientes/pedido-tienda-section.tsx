import { useState } from "react";
import axios from "axios";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Box, CircularProgress, Paper, Stack, Typography } from "@mui/material";
import { extractAxiosErrorMessage } from "./extract-axios-error";
import {
  API_PEDIDO,
  pedidoId,
  type PedidoItem,
  type TiendaEntregaCatalogItem,
} from "./pedido-types";
import { clientesSectionBodySx, clientesSectionHeaderSx, clientesSectionPaperSx } from "./clientes-page-layout";
import { TiendaEntregaPicker } from "./tienda-entrega-picker";

type Props = {
  clientId: string;
  pedidoReservado?: PedidoItem | null;
  onNeedCreatePedido: (storeId: string) => void;
};

export default function PedidoTiendaSection({
  clientId,
  pedidoReservado,
  onNeedCreatePedido,
}: Props) {
  const queryClient = useQueryClient();
  const [savingId, setSavingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data: tiendas = [], isLoading } = useQuery<TiendaEntregaCatalogItem[]>({
    queryKey: ["pedido-tiendas"],
    queryFn: async () => {
      const res = await axios.get(API_PEDIDO + "/tiendas");
      return Array.isArray(res.data) ? res.data : [];
    },
    staleTime: 24 * 60 * 60 * 1000,
  });

  const selectedId =
    pedidoReservado?.entrega_en_tienda === true ? (pedidoReservado.store_id ?? "") : "";
  const canEdit = Boolean(pedidoReservado);
  const busy = savingId != null;

  const handleSelect = async (storeId: string) => {
    setErrorMsg(null);
    if (!pedidoReservado) {
      onNeedCreatePedido(storeId);
      return;
    }
    if (pedidoReservado.store_id === storeId && pedidoReservado.entrega_en_tienda) {
      return;
    }
    setSavingId(storeId);
    try {
      await axios.patch(`${API_PEDIDO}/${pedidoId(pedidoReservado)}`, {
        entrega_en_tienda: true,
        store_id: storeId,
      });
      await queryClient.invalidateQueries({ queryKey: ["pedidos", clientId] });
    } catch (err) {
      setErrorMsg(extractAxiosErrorMessage(err, "No se pudo cambiar la tienda."));
    } finally {
      setSavingId(null);
    }
  };

  return (
    <Paper variant="outlined" sx={clientesSectionPaperSx}>
      <Box sx={clientesSectionHeaderSx}>
        <Typography variant="subtitle1" fontWeight={800}>
          Tienda de entrega
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {canEdit
            ? "Elige dónde recogerá el cliente este pedido. El cambio se guarda al tocar una tienda."
            : "Elige la tienda para crear el pedido y después reserva las cartas."}
        </Typography>
      </Box>
      <Stack spacing={1.5} sx={clientesSectionBodySx}>
        {errorMsg ? (
          <Alert severity="error" onClose={() => setErrorMsg(null)}>
            {errorMsg}
          </Alert>
        ) : null}
        {isLoading ? (
          <Stack direction="row" alignItems="center" gap={1}>
            <CircularProgress size={18} />
            <Typography variant="body2" color="text.secondary">
              Cargando tiendas…
            </Typography>
          </Stack>
        ) : (
          <TiendaEntregaPicker
            tiendas={tiendas}
            selectedId={savingId ?? selectedId}
            onSelect={(id) => void handleSelect(id)}
            disabled={busy}
          />
        )}
      </Stack>
    </Paper>
  );
}
