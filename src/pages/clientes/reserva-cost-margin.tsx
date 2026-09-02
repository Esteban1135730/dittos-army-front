import { Box, Typography } from "@mui/material";
import { formatCOP } from "../../utils/convert";

export function incomingGroupUnitCostCop(
  rows: Array<{ unit_cost_cop?: number | null; quantity?: number }>,
): number | null {
  let sum = 0;
  let qty = 0;
  for (const row of rows) {
    const cost = row.unit_cost_cop;
    if (typeof cost !== "number" || !Number.isFinite(cost) || cost <= 0) continue;
    const q =
      typeof row.quantity === "number" && Number.isInteger(row.quantity) && row.quantity >= 1
        ? row.quantity
        : 1;
    sum += cost * q;
    qty += q;
  }
  if (qty <= 0) return null;
  return sum / qty;
}

/** Ganancia total: (PVP unitario − costo unitario) × cantidad. Null si no hay PVP. */
export function reservaMarginTotalCop(
  pvpUnitCop: number | null,
  costUnitCop: number | null,
  quantity = 1,
): number | null {
  if (pvpUnitCop == null || !Number.isFinite(pvpUnitCop) || pvpUnitCop <= 0) return null;
  const cost = costUnitCop != null && Number.isFinite(costUnitCop) ? costUnitCop : 0;
  const qty =
    typeof quantity === "number" && Number.isInteger(quantity) && quantity >= 1 ? quantity : 1;
  return (pvpUnitCop - cost) * qty;
}

type Props = {
  costUnitCop: number | null;
  marginTotalCop: number | null;
};

export default function ReservaCostMarginAside({ costUnitCop, marginTotalCop }: Props) {
  const costLabel =
    costUnitCop != null && costUnitCop > 0 ? formatCOP(Math.round(costUnitCop)) : "—";
  const showMargin = marginTotalCop != null;
  const marginColor =
    marginTotalCop == null
      ? "text.primary"
      : marginTotalCop > 0
        ? "success.main"
        : marginTotalCop < 0
          ? "error.main"
          : "text.primary";

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "flex-start",
        gap: 1.5,
        flexShrink: 0,
        minWidth: 0,
      }}
    >
      <Box sx={{ minWidth: 72 }}>
        <Typography variant="caption" color="text.secondary" display="block">
          Costo
        </Typography>
        <Typography variant="body2" fontWeight={600} sx={{ fontVariantNumeric: "tabular-nums" }}>
          {costLabel}
        </Typography>
      </Box>
      {showMargin ? (
        <Box sx={{ minWidth: 88 }}>
          <Typography variant="caption" color="text.secondary" display="block">
            Ganancia
          </Typography>
          <Typography
            variant="body2"
            fontWeight={700}
            color={marginColor}
            sx={{ fontVariantNumeric: "tabular-nums" }}
          >
            {formatCOP(Math.round(marginTotalCop))}
          </Typography>
        </Box>
      ) : null}
    </Box>
  );
}
