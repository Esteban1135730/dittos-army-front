import { Box, Chip, Stack, Typography, Skeleton } from "@mui/material";
import { CardThumb } from "../../components/card-thumb";
import { formatCOP } from "../../utils/convert";
import type { PedidoLine } from "./pedido-types";
import type { TcgdexCardDetail, TcgdexDetailsByCardId } from "./tcgdex-card-detail";
import { lookupTcgdexDetail } from "./tcgdex-card-detail";
import { clientesMutedLabelSx, historialLineasGridSx } from "./clientes-page-layout";
import { reservaLineQuantity } from "./clientes-resumen-pedidos";
import { resolveStockImageUrl } from "../../constants/bulk-product";

type Props = {
  lines: PedidoLine[];
  detailsByCardId: TcgdexDetailsByCardId;
  loadingDetails?: boolean;
};

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <Typography variant="caption" color="text.secondary" display="block" lineHeight={1.5}>
      <Box component="span" sx={clientesMutedLabelSx}>
        {label}
      </Box>{" "}
      {value}
    </Typography>
  );
}

function LineaDetalle({
  line,
  tcg,
  loadingDetails,
}: {
  line: PedidoLine;
  tcg?: TcgdexCardDetail;
  loadingDetails?: boolean;
}) {
  const pendingCatalog =
    !!loadingDetails && !!line.card_id && !tcg && !line.image_url && !line.card_name;
  const image = resolveStockImageUrl(line.card_id, line.image_url || tcg?.imageUrl);
  const name = tcg?.name || line.card_name || line.card_id;
  const units = reservaLineQuantity(line.quantity);

  return (
    <Box
      sx={{
        p: 2,
        border: 1,
        borderColor: "divider",
        borderRadius: 2,
        bgcolor: "background.paper",
        height: "100%",
      }}
    >
      <Stack direction="row" spacing={2} alignItems="flex-start">
        <CardThumb
          src={image}
          alt={name}
          size="md"
          pending={pendingCatalog}
          enlargeOnHover={!!image}
        />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {pendingCatalog ? (
            <Stack spacing={0.75} sx={{ mb: 1 }}>
              <Skeleton variant="text" width="78%" height={26} />
              <Skeleton variant="text" width="52%" height={18} />
              <Skeleton variant="text" width="64%" height={18} />
            </Stack>
          ) : (
            <>
              <Stack direction="row" alignItems="center" flexWrap="wrap" gap={0.75} mb={0.5}>
                <Typography variant="subtitle2" fontWeight={700}>
                  {name}
                </Typography>
                {tcg?.category ? (
                  <Chip size="small" label={tcg.category} variant="outlined" sx={{ height: 22 }} />
                ) : null}
                {tcg?.rarity ? (
                  <Chip size="small" label={tcg.rarity} color="primary" variant="outlined" sx={{ height: 22 }} />
                ) : null}
              </Stack>

              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.75 }}>
                {line.card_id}
                {units > 1 ? ` · Cant.: ${units}` : ""}
                {tcg?.localId && tcg.localId !== line.card_id ? ` · #${tcg.localId}` : ""}
              </Typography>

              {tcg ? (
                <Stack spacing={0.25} sx={{ mb: 1 }}>
                  {tcg.setLabel ? <MetaRow label="Expansión" value={tcg.setLabel} /> : null}
                  {tcg.rarity ? <MetaRow label="Rareza" value={tcg.rarity} /> : null}
                  {tcg.types?.length ? <MetaRow label="Tipo" value={tcg.types.join(" · ")} /> : null}
                  {tcg.hp != null ? <MetaRow label="PS" value={String(tcg.hp)} /> : null}
                  {tcg.stage ? <MetaRow label="Etapa" value={tcg.stage} /> : null}
                  {tcg.illustrator ? <MetaRow label="Ilustrador" value={tcg.illustrator} /> : null}
                  {tcg.regulationMark ? (
                    <MetaRow label="Regulación" value={tcg.regulationMark} />
                  ) : null}
                  {tcg.legalStandard != null ? (
                    <MetaRow
                      label="Standard"
                      value={tcg.legalStandard ? "Legal" : "No legal"}
                    />
                  ) : null}
                </Stack>
              ) : line.card_id ? (
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                  Sin datos TCGdex para este id.
                </Typography>
              ) : null}
            </>
          )}

          <Typography variant="body2" fontWeight={700} color="primary.main">
            {formatCOP(line.precio * units)}
            {units > 1 ? ` (${formatCOP(line.precio)} c/u)` : ""}
            {line.currency && line.currency !== "COP" ? ` · ${line.currency}` : ""}
          </Typography>
        </Box>
      </Stack>
    </Box>
  );
}

export default function PedidoLineasHistorialList({
  lines,
  detailsByCardId,
  loadingDetails,
}: Props) {
  if (lines.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
        Sin cartas en este pedido.
      </Typography>
    );
  }

  return (
    <Stack spacing={1.5}>
      <Box sx={historialLineasGridSx}>
      {lines.map((line) => (
        <LineaDetalle
          key={`${line.stock_id}-${line.card_id}`}
          line={line}
          tcg={lookupTcgdexDetail(line.card_id, detailsByCardId)}
          loadingDetails={loadingDetails}
        />
      ))}
      </Box>
    </Stack>
  );
}
