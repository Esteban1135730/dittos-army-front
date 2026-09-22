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
import { amountToCop, gananciaEstimadaReservaCop, reservaLineQuantity } from "./clientes-resumen-pedidos";
import ReservaCostMarginAside from "./reserva-cost-margin";
import { ESTEBAN_STOCK_MARK, OWNERS_CONFIG, type OwnerKey } from "../../config/owners";
import type { PedidoItem } from "./pedido-types";
import { pedidoId } from "./pedido-types";
import { pedidoStatusLabel } from "./pedido-entrega-label";
import PedidoEntregaVisual from "./pedido-entrega-visual";
import PedidoLineasList from "./pedido-lineas-list";
import PedidoAbonosBlock from "./pedido-abonos-block";
import PedidoStatusStepper from "./pedido-status-stepper";
import { pedidoTotal } from "./pedido-ui-utils";
import {
  findPedidoLineByStockId,
  resolvePedidoReservaVisual,
} from "./pedido-reserva-visual";
import { lookupTcgdexDetail } from "../../pokemon";
import { useTcgdexCardDetails } from "../../pokemon";
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
  activeOwner: OwnerKey;
  reservasConStock: ReservaConStock[];
  resumen: ResumenFinanciero;
  finalizando: boolean;
  generandoPdfVenta: boolean;
  convert: (amount: number, from: string) => number;
  onEditEntrega: () => void;
  onPagar: () => void;
  onEntregar: () => void;
  onCancelar: () => void;
  onGenerarPdf: () => void;
  formatFechaReserva: (iso?: string) => string;
  onNotify: (message: string, severity: "success" | "error") => void;
};

export default function PedidoActivoPanel({
  pedido,
  clientId,
  activeOwner,
  reservasConStock,
  resumen,
  finalizando,
  generandoPdfVenta,
  convert,
  onEditEntrega,
  onPagar,
  onEntregar,
  onCancelar,
  onGenerarPdf,
  formatFechaReserva,
  onNotify,
}: Props) {
  const total = pedidoTotal(pedido.lines);
  const isReservado = pedido.status === "reservado";
  const isPagado = pedido.status === "pagado";
  const tcgCardIds = [
    ...reservasConStock.map(({ stock: st, reserva: r }) => {
      const line = findPedidoLineByStockId(pedido.lines, r.stock_id);
      return st?.card_id || line?.card_id || "";
    }),
    ...pedido.lines.map((l) => l.card_id),
  ];
  const { detailsByCardId, isLoading: loadingCardImages } = useTcgdexCardDetails(tcgCardIds);

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

        <PedidoAbonosBlock
          pedidoId={pedidoId(pedido)}
          allowMutate={isReservado}
          onNotify={onNotify}
        />

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
                <>
                  <Button variant="contained" color="success" disabled={finalizando} onClick={onEntregar}>
                    Confirmar entrega
                  </Button>
                  <Button variant="outlined" onClick={onEditEntrega}>
                    Editar entrega
                  </Button>
                </>
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
            Cartas del pedido
          </Typography>
          {reservasConStock.length === 0 ? (
            <Stack spacing={1.5} alignItems="flex-start">
              <Typography variant="body2" color="text.secondary">
                No hay cartas de stock en este pedido. Usa «Gestionar cartas» para agregar inventario.
              </Typography>
              {pedido.lines.length > 0 ? (
                <PedidoLineasList lines={pedido.lines} dense detailsByCardId={detailsByCardId} />
              ) : null}
            </Stack>
          ) : (
            <Stack spacing={0} divider={<Divider flexItem />}>
              {reservasConStock.map(({ reserva: r, stock: st }) => {
                const units = reservaLineQuantity(r.quantity);
                const pedidoLine = findPedidoLineByStockId(pedido.lines, r.stock_id);
                const tcg = lookupTcgdexDetail(
                  st?.card_id || pedidoLine?.card_id,
                  detailsByCardId,
                );
                const visual = resolvePedidoReservaVisual({
                  stock: st,
                  pedidoLine,
                  tcg,
                  stockOwner: r.stock_owner,
                  activeOwner,
                });
                const gananciaLinea =
                  gananciaEstimadaReservaCop(
                    r.precio,
                    r.currency ?? "COP",
                    st,
                    convert,
                  ) * units;
                return (
                  <Stack
                    key={r._id}
                    direction="row"
                    spacing={2}
                    alignItems="flex-start"
                    sx={{ py: 1.75 }}
                  >
                    <CardThumb
                      src={visual.imageSrc}
                      alt={visual.cardName}
                      size="md"
                      pending={loadingCardImages && !visual.imageSrc}
                      enlargeOnHover={!!visual.imageSrc}
                    />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Stack direction="row" alignItems="center" flexWrap="wrap" gap={0.75}>
                        <Typography fontWeight={700}>
                          {visual.lineOwner === "esteban" ? `${ESTEBAN_STOCK_MARK} ` : ""}
                          {visual.cardName}
                        </Typography>
                        <Chip
                          size="small"
                          label={OWNERS_CONFIG.owners[visual.lineOwner].label}
                          color={visual.lineOwner === "esteban" ? "secondary" : "default"}
                        />
                      </Stack>
                      <Typography variant="caption" color="text.secondary" display="block">
                        {visual.cardId}
                        {units > 1 ? ` · Cant.: ${units}` : ""}
                        {visual.rareza ? ` · ${visual.rareza}` : ""}
                      </Typography>
                      <Stack
                        direction="row"
                        alignItems="flex-start"
                        flexWrap="wrap"
                        spacing={1.5}
                        sx={{ mt: 0.75 }}
                      >
                        <Box>
                          <Typography variant="caption" color="text.secondary" display="block">
                            PVP
                          </Typography>
                          <Typography variant="body1" fontWeight={600}>
                            {formatCOP(r.precio * units)}
                            {units > 1 ? ` (${formatCOP(r.precio)} c/u)` : ""}
                            {r.currency && r.currency !== "COP" ? ` (${r.currency})` : ""}
                          </Typography>
                        </Box>
                        <ReservaCostMarginAside
                          costUnitCop={
                            st ? amountToCop(st.card_cost, st.currency, convert) : null
                          }
                          marginTotalCop={r.precio > 0 ? gananciaLinea : null}
                        />
                      </Stack>
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
