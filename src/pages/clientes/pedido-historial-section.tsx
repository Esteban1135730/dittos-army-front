import { useMemo, useState } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Chip,
  Divider,
  Paper,
  Stack,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import { formatCOP } from "../../utils/convert";
import type { PedidoHistoricoView } from "./cliente-historial-merge";
import { historialTotals } from "./cliente-historial-merge";
import { pedidoId } from "./pedido-types";
import { formatFechaTentativa, pedidoStatusLabel } from "./pedido-entrega-label";
import PedidoEntregaVisual from "./pedido-entrega-visual";
import PedidoLineasHistorialList from "./pedido-lineas-historial-list";
import { usePedidoLineasTcgdex } from "./use-pedido-lineas-tcgdex";
import type { TcgdexDetailsByCardId } from "./tcgdex-card-detail";
import {
  filterPedidosHistorial,
  pedidoTotal,
  type PedidoHistorialFilter,
} from "./pedido-ui-utils";
import {
  clientesSectionBodySx,
  clientesSectionHeaderSx,
  clientesSectionPaperSx,
} from "./clientes-page-layout";

type Props = {
  items: PedidoHistoricoView[];
  excludePedidoId?: string;
  onEditEntrega?: (pedido: PedidoHistoricoView) => void;
};

function PedidoHistorialCard({
  pedido,
  defaultExpanded,
  onEditEntrega,
  detailsByCardId,
  loadingDetails,
}: {
  pedido: PedidoHistoricoView;
  defaultExpanded?: boolean;
  onEditEntrega?: (pedido: PedidoHistoricoView) => void;
  detailsByCardId: TcgdexDetailsByCardId;
  loadingDetails?: boolean;
}) {
  const total = pedidoTotal(pedido.lines);
  const isEntregado = pedido.status === "entregado";
  const fromVentas = pedido.historicoSource === "ventas";

  const content = (
    <Stack spacing={1.5}>
      {fromVentas ? (
        <Chip size="small" label="Reconstruido desde ventas" variant="outlined" />
      ) : pedido.ventasIds?.length ? (
        <Chip size="small" label="Detalle completado desde ventas" variant="outlined" />
      ) : null}
      {!fromVentas ? <PedidoEntregaVisual pedido={pedido} showUrgency={!isEntregado} /> : null}
      {fromVentas ? (
        <Typography variant="body2" color="text.secondary">
          Ventas del {formatFechaTentativa(pedido.fecha_tentativa_entrega)} antes del módulo de
          pedidos formal.
        </Typography>
      ) : null}
      {pedido.lines.length > 0 ? (
        <>
          <PedidoLineasHistorialList
            lines={pedido.lines}
            detailsByCardId={detailsByCardId}
            loadingDetails={loadingDetails}
          />
          <Typography variant="body2" fontWeight={600}>
            Total: {formatCOP(total)}
          </Typography>
        </>
      ) : (
        <Typography variant="caption" color="text.secondary">
          Sin líneas registradas para este pedido.
        </Typography>
      )}
      {pedido.status === "reservado" && onEditEntrega && !fromVentas ? (
        <Button size="small" variant="outlined" onClick={() => onEditEntrega(pedido)} sx={{ textTransform: "none", fontWeight: 600 }}>
          Editar entrega
        </Button>
      ) : null}
      {pedido.paid_at ? (
        <Typography variant="caption" color="text.secondary">
          Pagado: {new Date(pedido.paid_at).toLocaleString("es-CO")}
        </Typography>
      ) : null}
      {pedido.delivered_at ? (
        <Typography variant="caption" color="text.secondary">
          Entregado: {new Date(pedido.delivered_at).toLocaleString("es-CO")}
        </Typography>
      ) : null}
    </Stack>
  );

  if (isEntregado) {
    return (
      <Accordion
        disableGutters
        elevation={0}
        defaultExpanded={defaultExpanded}
        sx={{
          border: 1,
          borderColor: "divider",
          borderRadius: "8px !important",
          "&:before": { display: "none" },
        }}
      >
        <AccordionSummary sx={{ minHeight: 48 }}>
          <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap" sx={{ width: "100%", pr: 1 }}>
            <Chip
              label={fromVentas ? "Histórico (ventas)" : pedidoStatusLabel(pedido.status)}
              size="small"
            />
            <Typography variant="body2" fontWeight={600} sx={{ flex: 1, minWidth: 0 }}>
              {formatFechaTentativa(pedido.fecha_tentativa_entrega)} · {pedido.lines.length} carta(s)
            </Typography>
            <Typography variant="body2" fontWeight={600} color="text.primary">
              {formatCOP(total)}
            </Typography>
          </Stack>
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 0 }}>{content}</AccordionDetails>
      </Accordion>
    );
  }

  return (
    <Box
      sx={{
        p: 2,
        border: 1,
        borderColor: "divider",
        borderRadius: 2,
        bgcolor: "background.paper",
      }}
    >
      <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap" mb={1.5}>
        <Chip
          label={pedidoStatusLabel(pedido.status)}
          size="small"
          color={pedido.status === "pagado" ? "success" : "warning"}
        />
        <Typography variant="caption" color="text.secondary">
          Creado {new Date(pedido.created_at).toLocaleDateString("es-CO")}
        </Typography>
        <Typography variant="body2" fontWeight={600} sx={{ ml: "auto" }}>
          {formatCOP(total)}
        </Typography>
      </Stack>
      {content}
    </Box>
  );
}

export default function PedidoHistorialSection({
  items,
  excludePedidoId,
  onEditEntrega,
}: Props) {
  const [filter, setFilter] = useState<PedidoHistorialFilter>("todos");

  const pedidosOnly = useMemo(
    () => items.map(({ historicoSource: _s, ventasIds: _v, ...p }) => p),
    [items],
  );

  const filtered = useMemo(() => {
    const ids = filterPedidosHistorial(pedidosOnly, filter, excludePedidoId).map((p) =>
      pedidoId(p),
    );
    return items.filter((i) => ids.includes(pedidoId(i)));
  }, [items, pedidosOnly, filter, excludePedidoId]);

  const counts = useMemo(() => {
    const base = excludePedidoId
      ? items.filter((p) => pedidoId(p) !== excludePedidoId)
      : items;
    return {
      todos: base.length,
      activos: base.filter((p) => p.status === "reservado" || p.status === "pagado").length,
      cerrados: base.filter((p) => p.status === "entregado").length,
    };
  }, [items, excludePedidoId]);

  const totals = useMemo(() => historialTotals(filtered), [filtered]);

  const linesForTcgdex = useMemo(
    () => filtered.flatMap((p) => p.lines),
    [filtered],
  );
  const { detailsByCardId, isLoading: loadingTcgdex } =
    usePedidoLineasTcgdex(linesForTcgdex);

  if (counts.todos === 0) return null;

  return (
    <Paper variant="outlined" sx={clientesSectionPaperSx}>
      <Box sx={clientesSectionHeaderSx}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2}>
          <Typography variant="h6" fontWeight={800}>
            Historial
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {totals.pedidos} pedido{totals.pedidos === 1 ? "" : "s"} · {totals.cartas} carta
            {totals.cartas === 1 ? "" : "s"} · {formatCOP(totals.totalCop)}
          </Typography>
        </Stack>
      </Box>
      <Box sx={clientesSectionBodySx}>
      <Tabs
        value={filter}
        onChange={(_, v: PedidoHistorialFilter) => setFilter(v)}
        sx={{
          mb: 2.5,
          minHeight: 40,
          "& .MuiTab-root": { minHeight: 40, textTransform: "none", fontWeight: 600, px: 2 },
        }}
      >
        <Tab value="todos" label={`Todos · ${counts.todos}`} />
        <Tab value="activos" label={`Activos · ${counts.activos}`} />
        <Tab value="cerrados" label={`Entregados · ${counts.cerrados}`} />
      </Tabs>
      {filtered.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No hay pedidos en esta categoría.
        </Typography>
      ) : (
        <Stack spacing={1.5} divider={filter !== "cerrados" ? <Divider flexItem /> : undefined}>
          {filtered.map((p, i) => (
            <PedidoHistorialCard
              key={pedidoId(p)}
              pedido={p}
              defaultExpanded={i === 0}
              onEditEntrega={onEditEntrega}
              detailsByCardId={detailsByCardId}
              loadingDetails={loadingTcgdex}
            />
          ))}
        </Stack>
      )}
      </Box>
    </Paper>
  );
}
