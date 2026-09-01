import { Alert, Box, Button, Paper, Stack, Typography } from "@mui/material";
import type { ClientItem } from "./cliente-types";
import type { PedidoItem } from "./pedido-types";
import PedidoEntregaVisual from "./pedido-entrega-visual";
import PedidoStatusStepper from "./pedido-status-stepper";

type Props = {
  client: ClientItem;
  pedidoReservado?: PedidoItem;
  pedidoPagado?: PedidoItem;
  onNuevoPedido: () => void;
  onEditEntrega: () => void;
  onEditCliente: () => void;
  onImportWhatsApp: () => void;
  canImport: boolean;
};

export default function PedidoContextBar({
  client,
  pedidoReservado,
  pedidoPagado,
  onNuevoPedido,
  onEditEntrega,
  onEditCliente,
  onImportWhatsApp,
  canImport,
}: Props) {
  const pedido = pedidoReservado ?? pedidoPagado;

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 0,
        borderRadius: 2,
        overflow: "hidden",
        position: "sticky",
        top: 8,
        zIndex: 10,
        bgcolor: "background.paper",
      }}
    >
      {pedido ? (
        <>
          <Box sx={{ px: 2.5, py: 1.5, bgcolor: "grey.50", borderBottom: 1, borderColor: "divider" }}>
            <Stack direction="row" alignItems="center" flexWrap="wrap" gap={1}>
              <Typography variant="subtitle2" fontWeight={700} sx={{ flex: 1 }}>
                Contexto del pedido
              </Typography>
              {client.celular ? (
                <Typography variant="caption" color="text.secondary">
                  WA: {client.celular}
                </Typography>
              ) : null}
            </Stack>
            <Box sx={{ mt: 1 }}>
              <PedidoStatusStepper status={pedido.status} compact />
            </Box>
          </Box>
          <Stack spacing={2} sx={{ p: 2.5 }}>
            <PedidoEntregaVisual pedido={pedido} />
            {client.notas?.trim() ? (
              <Alert severity="info" icon={false} sx={{ py: 0.75 }}>
                <Typography variant="caption" fontWeight={600}>
                  Notas cliente:{" "}
                </Typography>
                <Typography variant="body2" component="span" sx={{ whiteSpace: "pre-wrap" }}>
                  {client.notas.trim()}
                </Typography>
              </Alert>
            ) : null}
            <Stack direction="row" flexWrap="wrap" gap={1}>
              {pedidoReservado || pedidoPagado ? (
                <Button variant="outlined" size="small" onClick={onEditEntrega}>
                  Editar entrega
                </Button>
              ) : null}
              <Button
                variant="outlined"
                size="small"
                disabled={!canImport}
                onClick={onImportWhatsApp}
              >
                Importar WhatsApp
              </Button>
              <Button variant="outlined" size="small" onClick={onEditCliente}>
                Datos cliente
              </Button>
            </Stack>
          </Stack>
        </>
      ) : (
        <Stack spacing={2} sx={{ p: 2.5 }}>
          <Alert severity="info">
            Crea un pedido con entrega y fecha antes de reservar cartas de stock.
          </Alert>
          <Stack direction="row" flexWrap="wrap" gap={1}>
            <Button variant="contained" size="small" onClick={onNuevoPedido}>
              Nuevo pedido
            </Button>
            <Button variant="outlined" size="small" onClick={onEditCliente}>
              Datos cliente
            </Button>
          </Stack>
        </Stack>
      )}
    </Paper>
  );
}
