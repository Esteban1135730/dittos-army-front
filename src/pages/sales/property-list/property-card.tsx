import {
  Box,
  Button,
  Chip,
  Divider,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";
import { Link } from "react-router-dom";
import { CardThumb } from "../../../components/card-thumb";
import { formatCOP } from "../../../utils/convert";
import type { KeepSale, PropertyStockItem } from "./property-types";
import { propertyActionRowSx, propertyCardSx, propertyMutedLabelSx } from "./property-page-layout";

type Props = {
  sale: KeepSale;
  stock?: PropertyStockItem;
  stockLoading?: boolean;
  costCop: number;
  busy: boolean;
  onReturn: () => void;
  onDelete: () => void;
  onEditNotes: () => void;
};

export default function PropertyCard({
  sale,
  stock,
  stockLoading = false,
  costCop,
  busy,
  onReturn,
  onDelete,
  onEditNotes,
}: Props) {
  const cardName = stock?.card_name || sale.card_id;
  const pendingStock = stockLoading && !stock;

  return (
    <Box sx={propertyCardSx}>
      <Stack direction="row" spacing={2} alignItems="flex-start">
        <CardThumb
          src={stock?.image_url}
          alt={cardName}
          size="lg"
          pending={pendingStock}
          enlargeOnHover={!!stock?.image_url}
        />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={1} mb={1}>
            {pendingStock ? (
              <Skeleton variant="text" width="72%" height={28} />
            ) : (
              <Typography variant="subtitle1" fontWeight={700} noWrap title={cardName}>
                {cardName}
              </Typography>
            )}
            <Chip size="small" label="En propiedad" color="secondary" variant="outlined" />
          </Stack>

          {pendingStock ? (
            <Skeleton variant="text" width="55%" height={18} sx={{ mb: 1.25 }} />
          ) : (
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.25 }}>
              {stock?.card_id ?? sale.card_id}
              {stock?.rareza ? ` · ${stock.rareza}` : ""}
            </Typography>
          )}

          <Stack spacing={0.75} sx={{ mb: 1.5 }}>
            <Box>
              <Typography sx={propertyMutedLabelSx}>Costo de compra</Typography>
              {pendingStock ? (
                <Skeleton variant="text" width="68%" height={22} />
              ) : (
                <Typography variant="body2" fontWeight={600}>
                  {stock
                    ? `${stock.currency} ${stock.card_cost.toFixed(2)} · ${formatCOP(Math.round(costCop))}`
                    : "—"}
                </Typography>
              )}
            </Box>
            <Box>
              <Typography sx={propertyMutedLabelSx}>Retenida desde</Typography>
              <Typography variant="body2">
                {new Date(sale.created_at).toLocaleString("es-CO", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </Typography>
            </Box>
            <Box>
              <Typography sx={propertyMutedLabelSx}>Notas</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "pre-wrap" }}>
                {sale.notes?.trim() || "Sin notas"}
              </Typography>
            </Box>
          </Stack>

          <Divider sx={{ my: 1.5 }} />

          <Stack spacing={1} sx={propertyActionRowSx}>
            <Stack direction="row" flexWrap="wrap" gap={1}>
              <Button variant="outlined" color="warning" disabled={busy} onClick={onReturn}>
                Devolver a stock
              </Button>
              <Button variant="outlined" disabled={busy} onClick={onEditNotes}>
                Editar notas
              </Button>
              <Button
                variant="outlined"
                component={Link}
                to={`/stock/update/${sale.stock_id}`}
                disabled={busy || pendingStock}
              >
                Ver en inventario
              </Button>
            </Stack>
            <Button variant="text" color="error" disabled={busy} onClick={onDelete}>
              Eliminar definitivamente
            </Button>
          </Stack>
        </Box>
      </Stack>
    </Box>
  );
}
