import {
  Box,
  Button,
  Chip,
  Divider,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import { Link } from "react-router-dom";
import { formatCOP } from "../../utils/convert";
import { CardThumb } from "../../components/card-thumb";
import type { ReservaItem } from "./cliente-types";
import type { StockListItem } from "../../types/stock";
import { gananciaEstimadaReservaCop } from "./clientes-resumen-pedidos";
import type { PedidoItem } from "./pedido-types";
import { pedidoStatusLabel } from "./pedido-entrega-label";
import PedidoEntregaVisual from "./pedido-entrega-visual";
import PedidoLineasList from "./pedido-lineas-list";
import PedidoStatusStepper from "./pedido-status-stepper";
import { pedidoTotal } from "./pedido-ui-utils";
import {
  clientesActionRowSx,
  clientesHighlightPanelSx,
  clientesMutedLabelSx,
  clientesSectionBodySx,
  clientesSectionHeaderSx,
  clientesSectionPaperSx,
  clientesStatValueSx,
} from "./clientes-page-layout";

export type ReservaConStock = { reserva: ReservaItem; stock?: StockListItem };

type ResumenFinanciero = {
  ventasEsperadasCop: number;
  gananciaEstimadaCop: number;
};

type Props = {
  pedido: PedidoItem;
  clientId: string;
  reservasConStock: ReservaConStock[];
  resumen: ResumenFinanciero;
  incomingCount: number;
  finalizando: boolean;
  generandoPdfVenta: boolean;
  convert: (amount: number, from: string) => number;
  onEditEntrega: () => void;
  onPagar: () => void;
  onEntregar: () => void;
  onCancelar: () => void;
  onGenerarPdf: () => void;
  formatFechaReserva: (iso?: string) => string;
};

export default function PedidoActivoPanel({
  pedido,
  clientId,
  reservasConStock,
  resumen,
  incomingCount,
  finalizando,
  generandoPdfVenta,
  convert,
  onEditEntrega,
  onPagar,
  onEntregar,
  onCancelar,
  onGenerarPdf,
  formatFechaReserva,
}: Props) {
  const total = pedidoTotal(pedido.lines);
  const isReservado = pedido.status === "reservado";
  const isPagado = pedido.status === "pagado";

  return (
    <Paper
      variant="outlined"
      sx={[
        clientesSectionPaperSx,
        (theme) => ({
          borderColor: isPagado
            ? theme.palette.ditto.semantic.successBorder
            : theme.palette.ditto.semantic.warningBorder,
          borderWidth: 2,
        }),
      ]}
    >
      <Box sx={clientesSectionHeaderSx}>
        <Stack direction="row" alignItems="center" gap={1.5} mb={2}>
          <Typography variant="h6" fontWeight={800} sx={{ flex: 1 }}>
            Pedido en curso
          </Typography>
          <Chip
            label={pedidoStatusLabel(pedido.status)}
            size="small"
            color={isPagado ? "success" : "warning"}
            sx={{ fontWeight: 600 }}
          />
          <Chip
            label={`${pedido.lines.length} carta${pedido.lines.length === 1 ? "" : "s"}`}
            size="small"
            variant="outlined"
          />
        </Stack>
        <PedidoStatusStepper status={pedido.status} compact />
      </Box>

      <Stack spacing={3} sx={clientesSectionBodySx}>
        <PedidoEntregaVisual pedido={pedido} />

        <Box
          sx={[
            clientesHighlightPanelSx,
            {
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 2,
            },
          ]}
        >
          <Box>
            <Typography sx={clientesMutedLabelSx}>Total del pedido</Typography>
            <Typography variant="h5" sx={clientesStatValueSx}>
              {formatCOP(total)}
            </Typography>
          </Box>
          <Box>
            <Typography sx={clientesMutedLabelSx}>Ventas esperadas</Typography>
            <Typography variant="h6" sx={clientesStatValueSx}>
              {formatCOP(Math.round(resumen.ventasEsperadasCop))}
            </Typography>
          </Box>
          <Box>
            <Typography sx={clientesMutedLabelSx}>Ganancia estimada</Typography>
            <Typography
              variant="h6"
              sx={{
                ...clientesStatValueSx,
                color:
                  resumen.gananciaEstimadaCop > 0
                    ? "success.main"
                    : resumen.gananciaEstimadaCop < 0
                      ? "error.main"
                      : "text.primary",
              }}
            >
              {formatCOP(Math.round(resumen.gananciaEstimadaCop))}
            </Typography>
          </Box>
        </Box>

        <Box>
          <Typography sx={{ ...clientesMutedLabelSx, mb: 1.25 }}>Acciones</Typography>
          <Stack spacing={1.5}>
            {isReservado ? (
              <Box sx={clientesActionRowSx}>
                <Button variant="contained" component={Link} to={`/clientes/${clientId}/reservar`}>
                  Gestionar cartas
                </Button>
                <Button variant="outlined" onClick={onEditEntrega}>
                  Editar entrega
                </Button>
                <Button
                  variant="outlined"
                  color="warning"
                  component={Link}
                  to={`/clientes/${clientId}/reservar?camino=1`}
                >
                  Incoming{incomingCount > 0 ? ` (${incomingCount})` : ""}
                </Button>
                <Tooltip title={pedido.lines.length === 0 ? "Agrega cartas antes de registrar el pago" : ""}>
                  <span>
                    <Button
                      variant="contained"
                      color="success"
                      disabled={pedido.lines.length === 0 || finalizando}
                      onClick={onPagar}
                    >
                      Registrar pago
                    </Button>
                  </span>
                </Tooltip>
              </Box>
            ) : null}
            <Box sx={clientesActionRowSx}>
              {isPagado ? (
                <Button variant="contained" color="success" disabled={finalizando} onClick={onEntregar}>
                  Confirmar entrega
                </Button>
              ) : null}
              <Tooltip title={reservasConStock.length === 0 ? "Sin reservas en inventario" : ""}>
                <span>
                  <Button
                    variant="outlined"
                    disabled={reservasConStock.length === 0 || generandoPdfVenta}
                    onClick={onGenerarPdf}
                  >
                    {generandoPdfVenta ? "Generando…" : "Descargar PDF"}
                  </Button>
                </span>
              </Tooltip>
              {isReservado ? (
                <Button variant="text" color="error" disabled={finalizando} onClick={onCancelar}>
                  Cancelar pedido
                </Button>
              ) : null}
            </Box>
          </Stack>
        </Box>

        <Divider />

        <Box>
          <Typography variant="subtitle1" fontWeight={700} gutterBottom>
            Cartas reservadas
          </Typography>
          {reservasConStock.length === 0 ? (
            <Stack spacing={1.5} alignItems="flex-start">
              <Typography variant="body2" color="text.secondary">
                No hay cartas apartadas. Usa «Gestionar cartas» para agregar stock.
              </Typography>
              {pedido.lines.length > 0 ? <PedidoLineasList lines={pedido.lines} dense /> : null}
            </Stack>
          ) : (
            <Stack spacing={0} divider={<Divider flexItem />}>
              {reservasConStock.map(({ reserva: r, stock: st }) => {
                const gananciaLinea = gananciaEstimadaReservaCop(
                  r.precio,
                  r.currency ?? "COP",
                  st,
                  convert,
                );
                return (
                  <Stack
                    key={r._id}
                    direction="row"
                    spacing={2}
                    alignItems="flex-start"
                    sx={{ py: 1.75 }}
                  >
                    <CardThumb
                      src={st?.image_url}
                      alt={st?.card_name ?? "Carta"}
                      size="md"
                      enlargeOnHover
                    />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Stack direction="row" alignItems="center" flexWrap="wrap" gap={1} mb={0.5}>
                        <Typography fontWeight={700}>{st?.card_name ?? "Carta"}</Typography>
                        <Chip
                          size="small"
                          variant="outlined"
                          color={
                            gananciaLinea > 0 ? "success" : gananciaLinea < 0 ? "error" : "default"
                          }
                          label={`Margen ${formatCOP(Math.round(gananciaLinea))}`}
                        />
                      </Stack>
                      <Typography variant="caption" color="text.secondary" display="block">
                        {st?.card_id}
                        {st?.rareza ? ` · ${st.rareza}` : ""}
                      </Typography>
                      <Typography variant="body1" fontWeight={600} sx={{ mt: 0.75 }}>
                        {formatCOP(r.precio)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.25 }}>
                        Reservada {formatFechaReserva(r.created_at)}
                      </Typography>
                    </Box>
                  </Stack>
                );
              })}
            </Stack>
          )}
        </Box>
      </Stack>
    </Paper>
  );
}
