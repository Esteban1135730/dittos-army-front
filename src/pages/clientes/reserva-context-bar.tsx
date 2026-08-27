import { Alert, Box, Button, Chip, Paper, Stack, Typography } from "@mui/material";
import type { ClientItem } from "./cliente-types";

type Props = {
  client: ClientItem;
  units: number;
  onEditCliente: () => void;
  onImportWhatsApp: () => void;
  onEnviarWhatsApp: () => void;
  onCopiarMensaje: () => void;
  waBusy?: boolean;
  copiando?: boolean;
  canEnviar: boolean;
};

export default function ReservaContextBar({
  client,
  units,
  onEditCliente,
  onImportWhatsApp,
  onEnviarWhatsApp,
  onCopiarMensaje,
  waBusy,
  copiando,
  canEnviar,
}: Props) {
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
        borderColor: "info.main",
        borderWidth: 2,
      }}
    >
      <Box
        sx={{
          px: 2.5,
          py: 1.5,
          bgcolor: "grey.50",
          borderBottom: 1,
          borderColor: "info.light",
        }}
      >
        <Stack direction="row" alignItems="center" flexWrap="wrap" gap={1}>
          <Typography variant="subtitle2" fontWeight={700} sx={{ flex: 1 }}>
            Contexto de la reserva
          </Typography>
          <Chip label="En camino" size="small" color="info" sx={{ fontWeight: 600 }} />
          {client.celular ? (
            <Typography variant="caption" color="text.secondary">
              WA: {client.celular}
            </Typography>
          ) : null}
        </Stack>
      </Box>
      <Stack spacing={2} sx={{ p: 2.5 }}>
        <Alert severity="info" icon={false}>
          Aparta cartas de lotes en camino. El PVP que asignes queda editable y sale en el mensaje
          al cliente. No se mezcla con el pedido de stock.
        </Alert>
        <Typography variant="body2" color="text.secondary">
          {units > 0
            ? `${units} unidad${units === 1 ? "" : "es"} apartada${units === 1 ? "" : "s"} para este cliente.`
            : "Aún no hay cartas en esta reserva. Busca en el catálogo de lotes en camino."}
        </Typography>
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
          <Button variant="contained" size="small" onClick={onImportWhatsApp}>
            Importar WhatsApp
          </Button>
          <Button
            variant="contained"
            color="success"
            size="small"
            disabled={!canEnviar || waBusy}
            onClick={onEnviarWhatsApp}
          >
            {waBusy ? "Enviando…" : "Enviar reserva"}
          </Button>
          <Button
            variant="outlined"
            size="small"
            disabled={!canEnviar || copiando}
            onClick={onCopiarMensaje}
          >
            {copiando ? "Copiando…" : "Copiar mensaje"}
          </Button>
          <Button variant="outlined" size="small" onClick={onEditCliente}>
            Datos cliente
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
}
