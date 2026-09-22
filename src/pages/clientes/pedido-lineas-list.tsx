import { Box, Stack, Typography } from "@mui/material";
import { CardThumb } from "../../components/card-thumb";
import { formatCOP } from "../../utils/convert";
import type { PedidoLine } from "./pedido-types";
import { reservaLineQuantity } from "./clientes-resumen-pedidos";
import {
  lookupTcgdexDetail,
  resolveCardImageSrc,
  type TcgdexDetailsByCardId,
} from "../../pokemon";

type Props = {
  lines: PedidoLine[];
  maxVisible?: number;
  dense?: boolean;
  detailsByCardId?: TcgdexDetailsByCardId;
};

export default function PedidoLineasList({
  lines,
  maxVisible,
  dense,
  detailsByCardId = {},
}: Props) {
  if (lines.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
        Sin cartas en este pedido.
      </Typography>
    );
  }
  const limit = maxVisible ?? lines.length;
  const visible = lines.slice(0, limit);
  const rest = lines.length - visible.length;

  return (
    <Stack spacing={dense ? 0.75 : 1.25}>
      {visible.map((l) => {
        const units = reservaLineQuantity(l.quantity);
        const tcg = lookupTcgdexDetail(l.card_id, detailsByCardId);
        const image = resolveCardImageSrc(l.card_id, l.image_url || tcg?.imageUrl, detailsByCardId);
        const name = l.card_name || tcg?.name || l.card_id || "Carta";
        return (
        <Stack key={l.stock_id} direction="row" spacing={1.5} alignItems="center">
          <CardThumb
            src={image}
            alt={name}
            size={dense ? "sm" : "md"}
            enlargeOnHover={!!image}
          />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" fontWeight={600} noWrap>
              {name}
            </Typography>
            {!dense && l.card_id ? (
              <Typography variant="caption" color="text.secondary" noWrap display="block">
                {l.card_id}
                {units > 1 ? ` · Cant.: ${units}` : ""}
              </Typography>
            ) : null}
          </Box>
          <Typography variant="body2" fontWeight={600} sx={{ flexShrink: 0 }}>
            {formatCOP(l.precio * units)}
          </Typography>
        </Stack>
        );
      })}
      {rest > 0 ? (
        <Typography variant="caption" color="text.secondary">
          +{rest} carta{rest === 1 ? "" : "s"} más
        </Typography>
      ) : null}
    </Stack>
  );
}
