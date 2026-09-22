import { Box, Button, Chip, Divider, Paper, Stack, Typography } from "@mui/material";
import { Link } from "react-router-dom";
import { CardThumb } from "../../components/card-thumb";
import { incomingVariantGroupKey } from "../../utils/incoming-variant-group";
import type { ReservaIncomingItem } from "./cliente-types";
import IncomingPvpField, { incomingGroupPrecioCop } from "./incoming-pvp-field";
import ReservaCostMarginAside, {
  incomingGroupUnitCostCop,
  reservaMarginTotalCop,
} from "./reserva-cost-margin";
import ReservaIncomingAbonosBlock from "./reserva-incoming-abonos-block";
import { looksLikeTcgdexCardId, resolveCardImageSrc } from "../../pokemon";
import { useTcgdexCardDetails } from "../../pokemon";
import {
  clientesActionRowSx,
  clientesMutedLabelSx,
  clientesSectionBodySx,
  clientesSectionHeaderSx,
  clientesSectionPaperSx,
  clientesStatValueSx,
} from "./clientes-page-layout";

type GroupedIncoming = {
  key: string;
  qty: number;
  head: ReservaIncomingItem;
  rows: ReservaIncomingItem[];
};

function groupIncoming(items: ReservaIncomingItem[]): GroupedIncoming[] {
  const map = new Map<string, GroupedIncoming>();
  for (const row of items) {
    const key = incomingVariantGroupKey(row.card_id ?? "", row.rareza, row.language ?? "");
    const existing = map.get(key);
    if (!existing) {
      map.set(key, { key, qty: row.quantity, head: row, rows: [row] });
    } else {
      existing.qty += row.quantity;
      existing.rows.push(row);
    }
  }
  return [...map.values()];
}

type Props = {
  clientId: string;
  incoming: ReservaIncomingItem[];
  formatFechaReserva: (iso?: string) => string;
  onSavePvp: (rows: ReservaIncomingItem[], cop: number | null) => Promise<void>;
  onEnviarWhatsApp: () => void;
  onCopiarMensaje: () => void;
  waBusy?: boolean;
  copiando?: boolean;
  onNotify: (message: string, severity: "success" | "error") => void;
};

export default function ReservaActivoPanel({
  clientId,
  incoming,
  formatFechaReserva,
  onSavePvp,
  onEnviarWhatsApp,
  onCopiarMensaje,
  waBusy,
  copiando,
  onNotify,
}: Props) {
  const groups = groupIncoming(incoming);
  const units = incoming.reduce((sum, row) => sum + (row.quantity ?? 0), 0);
  const manageTo = `/clientes/${clientId}/reservar?camino=1`;
  const { detailsByCardId, isLoading: loadingCardImages } = useTcgdexCardDetails(
    incoming.map((row) => row.card_id ?? ""),
  );

  return (
    <Paper
      variant="outlined"
      sx={[
        clientesSectionPaperSx,
        (theme) => ({
          borderColor: theme.palette.ditto.semantic.info,
          borderWidth: 2,
        }),
      ]}
    >
      <Box sx={clientesSectionHeaderSx}>
        <Stack direction="row" alignItems="center" gap={1.5} mb={0}>
          <Typography variant="h6" fontWeight={800} sx={{ flex: 1 }}>
            Reserva en camino
          </Typography>
          <Chip label="En camino" size="small" color="info" sx={{ fontWeight: 600 }} />
          <Chip
            label={`${units} unidad${units === 1 ? "" : "es"}`}
            size="small"
            variant="outlined"
          />
        </Stack>
      </Box>

      <Stack spacing={3} sx={clientesSectionBodySx}>
        <Box
          sx={(theme) => ({
            p: 2.5,
            borderRadius: 2,
            bgcolor: theme.palette.ditto.semantic.infoBg,
            border: 1,
            borderColor: theme.palette.ditto.semantic.info,
          })}
        >
          <Typography sx={clientesMutedLabelSx}>Cartas apartadas</Typography>
          <Typography variant="h5" sx={clientesStatValueSx}>
            {groups.length} variante{groups.length === 1 ? "" : "s"} · {units} ud
            {units === 1 ? "" : "s"}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            El PVP es editable y se envía en el mensaje al cliente. No forma parte del pedido de
            stock.
          </Typography>
        </Box>

        <ReservaIncomingAbonosBlock clientId={clientId} onNotify={onNotify} />

        <Box>
          <Typography sx={{ ...clientesMutedLabelSx, mb: 1.25 }}>Acciones</Typography>
          <Box sx={clientesActionRowSx}>
            <Button variant="contained" component={Link} to={manageTo}>
              Gestionar reserva
            </Button>
            <Button
              variant="contained"
              color="success"
              disabled={waBusy}
              onClick={onEnviarWhatsApp}
            >
              {waBusy ? "Enviando…" : "Enviar reserva"}
            </Button>
            <Button variant="outlined" disabled={copiando} onClick={onCopiarMensaje}>
              {copiando ? "Copiando…" : "Copiar mensaje"}
            </Button>
          </Box>
        </Box>

        <Divider />

        <Box>
          <Typography variant="subtitle1" fontWeight={700} gutterBottom>
            Cartas en camino
          </Typography>
          <Stack spacing={0} divider={<Divider flexItem />}>
            {groups.map(({ key, qty, head, rows }) => {
              const src = resolveCardImageSrc(
                head.card_id,
                head.image_url,
                detailsByCardId,
                head.language,
              );
              return (
              <Stack
                key={key}
                direction="row"
                spacing={2}
                alignItems="flex-start"
                sx={{ py: 1.75 }}
              >
                <CardThumb
                  src={src}
                  alt={head.card_name ?? "Carta"}
                  size="lg"
                  pending={loadingCardImages && !src && looksLikeTcgdexCardId(head.card_id)}
                  enlargeOnHover={!!src}
                />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography fontWeight={700}>{head.card_name ?? "Carta"}</Typography>
                  <Typography variant="caption" color="text.secondary" display="block">
                    {head.card_id}
                    {qty > 1 ? ` · Cant.: ${qty}` : ""}
                    {head.language ? ` · ${head.language}` : ""}
                    {head.rareza ? ` · ${head.rareza}` : ""}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.25 }}>
                    Reservada {formatFechaReserva(head.created_at)}
                  </Typography>
                </Box>
                <Stack direction="row" alignItems="flex-start" flexWrap="wrap" spacing={1.5}>
                  <IncomingPvpField
                    valueCop={incomingGroupPrecioCop(rows)}
                    onSave={(cop) => onSavePvp(rows, cop)}
                  />
                  <ReservaCostMarginAside
                    costUnitCop={incomingGroupUnitCostCop(rows)}
                    marginTotalCop={reservaMarginTotalCop(
                      incomingGroupPrecioCop(rows),
                      incomingGroupUnitCostCop(rows),
                      qty,
                    )}
                  />
                </Stack>
              </Stack>
              );
            })}
          </Stack>
        </Box>
      </Stack>
    </Paper>
  );
}
