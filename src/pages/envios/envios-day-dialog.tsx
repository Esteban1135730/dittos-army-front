import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from "@mui/material";
import { Link } from "react-router-dom";
import {
  entregaUrgencia,
  entregaUrgenciaLabel,
} from "../clientes/pedido-ui-utils";
import { pedidoStatusLabel } from "../clientes/pedido-entrega-label";
import { entregaLugar } from "./calendar-utils";
import type { PedidoCalendarioItem } from "./types";

type Props = {
  open: boolean;
  ymd: string | null;
  items: PedidoCalendarioItem[];
  unlocatedIds?: Set<string>;
  onClose: () => void;
  onEditItem: (item: PedidoCalendarioItem) => void;
};

function titleForDay(ymd: string | null): string {
  if (!ymd) return "Envíos";
  const [y, m, d] = ymd.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function EnviosDayDialog({
  open,
  ymd,
  items,
  unlocatedIds,
  onClose,
  onEditItem,
}: Props) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ textTransform: "capitalize" }}>{titleForDay(ymd)}</DialogTitle>
      <DialogContent dividers>
        {items.length === 0 ? (
          <Typography color="text.secondary">
            No hay envíos pendientes este día
          </Typography>
        ) : (
          <Stack spacing={1.5}>
            {items.map((item) => {
              const urgencia = entregaUrgencia(item.fecha_tentativa_entrega, item.status);
              const isOverdue = item.overdue || urgencia === "overdue";
              const urgenciaLabel = entregaUrgenciaLabel(
                item.fecha_tentativa_entrega,
                item.status,
              );
                  const sinUbicacion = Boolean(unlocatedIds?.has(item.id));
              return (
                <Box
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onEditItem(item)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onEditItem(item);
                    }
                  }}
                  sx={(theme) => ({
                    p: 1.5,
                    borderRadius: 2,
                    border: 1,
                    borderColor: isOverdue
                      ? theme.palette.ditto.semantic.errorBorder
                      : "divider",
                    bgcolor: isOverdue
                      ? theme.palette.ditto.semantic.errorBg
                      : "background.paper",
                    color: isOverdue ? "error.main" : "text.primary",
                    cursor: "pointer",
                    "&:hover": { borderColor: "primary.main" },
                  })}
                >
                  <Stack
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                    gap={1}
                    flexWrap="wrap"
                  >
                    <Typography fontWeight={700}>{item.client_name}</Typography>
                    <Stack direction="row" gap={0.75} flexWrap="wrap">
                      <Chip
                        size="small"
                        label={pedidoStatusLabel(item.status)}
                        color={item.status === "pagado" ? "success" : "warning"}
                        sx={{ fontWeight: 600 }}
                      />
                      {urgenciaLabel ? (
                        <Chip
                          size="small"
                          label={urgenciaLabel}
                          color={isOverdue ? "error" : urgencia === "today" ? "warning" : "default"}
                          variant={isOverdue ? "filled" : "outlined"}
                        />
                      ) : null}
                    </Stack>
                  </Stack>
                  <Typography variant="body2" sx={{ mt: 0.75 }} color="inherit">
                    {entregaLugar(item) || "Sin lugar de entrega"}
                    {sinUbicacion ? " · sin ubicación" : ""}
                  </Typography>
                  <Button
                    component={Link}
                    to={`/clientes/${item.client_id}`}
                    size="small"
                    onClick={(e) => e.stopPropagation()}
                    sx={{ mt: 0.75, textTransform: "none", fontWeight: 600, px: 0 }}
                  >
                    Ver cliente
                  </Button>
                </Box>
              );
            })}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} sx={{ textTransform: "none", fontWeight: 600 }}>
          Cerrar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
