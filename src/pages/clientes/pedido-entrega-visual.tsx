import { Box, Chip, Stack, Typography } from "@mui/material";
import type { PedidoItem } from "./pedido-types";
import { formatFechaTentativa } from "./pedido-entrega-label";
import { entregaUrgencia, entregaUrgenciaLabel } from "./pedido-ui-utils";
import { clientesMutedLabelSx, clientesHighlightPanelSx, entregaShipAccentSx, entregaStoreAccentSx } from "./clientes-page-layout";

type Props = {
  pedido: PedidoItem;
  showUrgency?: boolean;
};

const URGENCIA_COLOR = {
  overdue: "error" as const,
  today: "warning" as const,
  soon: "warning" as const,
  ok: "default" as const,
  none: "default" as const,
};

export default function PedidoEntregaVisual({ pedido, showUrgency = true }: Props) {
  const urgencia = entregaUrgencia(pedido.fecha_tentativa_entrega, pedido.status);
  const urgenciaLabel = showUrgency
    ? entregaUrgenciaLabel(pedido.fecha_tentativa_entrega, pedido.status)
    : null;

  return (
    <Stack
      direction="row"
      spacing={3}
      alignItems="flex-start"
      sx={[
        clientesHighlightPanelSx,
        pedido.entrega_en_tienda ? entregaStoreAccentSx : entregaShipAccentSx,
        {
          borderLeftStyle: "solid",
        },
      ]}
    >
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap" mb={1}>
          <Chip
            size="small"
            label={pedido.entrega_en_tienda ? "Recogida en tienda" : "Envío o punto de entrega"}
            color={pedido.entrega_en_tienda ? "primary" : "default"}
            variant="outlined"
            sx={{ fontWeight: 600 }}
          />
          {urgenciaLabel ? (
            <Chip size="small" label={urgenciaLabel} color={URGENCIA_COLOR[urgencia]} />
          ) : null}
        </Stack>
        {pedido.entrega_en_tienda ? (
          <>
            <Typography variant="subtitle1" fontWeight={700}>
              {pedido.store_name ?? "Tienda"}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
              {pedido.store_address ?? "—"}
            </Typography>
          </>
        ) : (
          <>
            <Typography variant="subtitle1" fontWeight={700}>
              {pedido.ciudad ?? "Ciudad no indicada"}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
              {pedido.direccion_o_punto ?? "—"}
            </Typography>
            {pedido.notas_entrega?.trim() ? (
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.75 }}>
                Notas: {pedido.notas_entrega.trim()}
              </Typography>
            ) : null}
          </>
        )}
      </Box>
      <Box sx={{ textAlign: "right", flexShrink: 0, minWidth: 140 }}>
        <Typography sx={clientesMutedLabelSx}>Fecha tentativa</Typography>
        <Typography variant="body1" fontWeight={700} sx={{ mt: 0.25 }}>
          {formatFechaTentativa(pedido.fecha_tentativa_entrega)}
        </Typography>
      </Box>
    </Stack>
  );
}
