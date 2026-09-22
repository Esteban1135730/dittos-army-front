import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Snackbar,
  Stack,
  Typography,
} from "@mui/material";
import { CardThumb } from "../../components/card-thumb";
import { formatCOP } from "../../utils/convert";
import {
  acceptMobilePendingSale,
  listMobilePendingSales,
  rejectMobilePendingSale,
  type MobilePendingSale,
} from "../../api/mobile-pending";

const QUERY_KEY = ["sales-mobile-pending"] as const;

type ConfirmAction = {
  kind: "accept" | "reject";
  row: MobilePendingSale;
};

function axiosMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as
      | { message?: string | string[]; conflict_reason?: string }
      | undefined;
    const msg = data?.conflict_reason ?? data?.message;
    if (typeof msg === "string" && msg.trim()) return msg;
    if (Array.isArray(msg) && msg[0]) return String(msg[0]);
    if (err.response?.status === 401) {
      return "Token de sync incorrecto. Revisa VITE_SYNC_TOKEN.";
    }
  }
  return fallback;
}

function formatWhen(raw?: string): string {
  if (!raw) return "—";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function VentasDesdeMovilPage() {
  const queryClient = useQueryClient();
  const [confirm, setConfirm] = useState<ConfirmAction | null>(null);
  const [snack, setSnack] = useState<{
    severity: "success" | "error";
    text: string;
  } | null>(null);

  const listQuery = useQuery({
    queryKey: QUERY_KEY,
    queryFn: listMobilePendingSales,
  });

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    await queryClient.invalidateQueries({ queryKey: ["sales-dashboard"] });
    await queryClient.invalidateQueries({ queryKey: ["stock"] });
  };

  const acceptMut = useMutation({
    mutationFn: (id: string) => acceptMobilePendingSale(id),
    onSuccess: async () => {
      setConfirm(null);
      setSnack({ severity: "success", text: "Venta aceptada." });
      await invalidate();
    },
    onError: (err) => {
      setConfirm(null);
      void listQuery.refetch();
      setSnack({
        severity: "error",
        text: axiosMessage(
          err,
          "No se pudo aceptar. La carta puede no estar en stock.",
        ),
      });
    },
  });

  const rejectMut = useMutation({
    mutationFn: (id: string) => rejectMobilePendingSale(id),
    onSuccess: async () => {
      setConfirm(null);
      setSnack({ severity: "success", text: "Aviso rechazado. El stock no cambió." });
      await invalidate();
    },
    onError: (err) => {
      setSnack({
        severity: "error",
        text: axiosMessage(err, "No se pudo rechazar."),
      });
    },
  });

  const inFlightId = acceptMut.isPending
    ? acceptMut.variables
    : rejectMut.isPending
      ? rejectMut.variables
      : null;

  const rows = listQuery.data ?? [];
  const confirming = confirm?.row;

  const empty = useMemo(
    () => !listQuery.isLoading && rows.length === 0,
    [listQuery.isLoading, rows.length],
  );

  return (
    <Box sx={{ maxWidth: 960, mx: "auto", pb: 2 }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        alignItems={{ sm: "center" }}
        justifyContent="space-between"
        gap={1}
        sx={{ mb: 1.5 }}
      >
        <Typography variant="h6" fontWeight={800}>
          Ventas desde móvil
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Avisos del APK. El stock sigue vendible hasta aceptar.
        </Typography>
      </Stack>

      {listQuery.isError ? (
        <Alert severity="error" sx={{ mb: 1.5 }}>
          {axiosMessage(listQuery.error, "No se pudieron cargar los avisos.")}
        </Alert>
      ) : null}

      {listQuery.isLoading ? (
        <Stack alignItems="center" py={6}>
          <CircularProgress size={28} />
        </Stack>
      ) : empty ? (
        <Paper
          variant="outlined"
          sx={{ p: 2.5, borderRadius: 2, textAlign: "center" }}
        >
          <Typography color="text.secondary">
            No hay ventas pendientes desde el móvil.
          </Typography>
        </Paper>
      ) : (
        <Stack gap={1}>
          {rows.map((row) => (
            <PendingRow
              key={row._id}
              row={row}
              disabled={inFlightId != null}
              busy={inFlightId === row._id}
              onAccept={() => setConfirm({ kind: "accept", row })}
              onReject={() => setConfirm({ kind: "reject", row })}
            />
          ))}
        </Stack>
      )}

      <Dialog
        open={Boolean(confirm)}
        onClose={() => {
          if (!acceptMut.isPending && !rejectMut.isPending) setConfirm(null);
        }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>
          {confirm?.kind === "accept" ? "Aceptar venta" : "Rechazar aviso"}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            {confirm?.kind === "accept"
              ? `¿Registrar la venta de “${confirming?.card_name || confirming?.stock_id}” por COP ${formatCOP(confirming?.amount_cop ?? 0)}?`
              : `¿Rechazar el aviso de “${confirming?.card_name || confirming?.stock_id}”? El stock no cambia.`}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setConfirm(null)}
            disabled={acceptMut.isPending || rejectMut.isPending}
          >
            Cancelar
          </Button>
          <Button
            variant="contained"
            color={confirm?.kind === "reject" ? "error" : "primary"}
            disabled={acceptMut.isPending || rejectMut.isPending}
            onClick={() => {
              if (!confirm) return;
              if (confirm.kind === "accept") acceptMut.mutate(confirm.row._id);
              else rejectMut.mutate(confirm.row._id);
            }}
          >
            {acceptMut.isPending || rejectMut.isPending ? (
              <CircularProgress size={18} color="inherit" />
            ) : confirm?.kind === "accept" ? (
              "Aceptar"
            ) : (
              "Rechazar"
            )}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={Boolean(snack)}
        autoHideDuration={4000}
        onClose={() => setSnack(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        {snack ? (
          <Alert
            onClose={() => setSnack(null)}
            severity={snack.severity}
            variant="filled"
            sx={{ width: "100%" }}
          >
            {snack.text}
          </Alert>
        ) : null}
      </Snackbar>
    </Box>
  );
}

function PendingRow({
  row,
  disabled,
  busy,
  onAccept,
  onReject,
}: {
  row: MobilePendingSale;
  disabled: boolean;
  busy: boolean;
  onAccept: () => void;
  onReject: () => void;
}) {
  const isConflict = row.status === "conflict";
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.25,
        borderRadius: 2,
        borderColor: isConflict ? "warning.main" : "divider",
      }}
    >
      <Stack direction="row" gap={1.25} alignItems="center">
        <CardThumb
          src={row.image_url}
          alt={row.card_name || "carta"}
          size="sm"
          enlargeOnHover
        />
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Stack direction="row" gap={0.75} alignItems="center" flexWrap="wrap">
            <Typography fontWeight={700} noWrap>
              {row.card_name || "Sin nombre"}
            </Typography>
            {isConflict ? (
              <Chip size="small" color="warning" label="Conflicto" />
            ) : (
              <Chip size="small" color="info" label="Pendiente" />
            )}
          </Stack>
          <Typography variant="body2" fontWeight={700}>
            COP {formatCOP(row.amount_cop)}
          </Typography>
          {row.notes ? (
            <Typography variant="caption" color="text.secondary" display="block">
              {row.notes}
            </Typography>
          ) : null}
          <Typography variant="caption" color="text.secondary" display="block">
            {formatWhen(row.created_at)} · stock {row.stock_id}
          </Typography>
          {isConflict && row.conflict_reason ? (
            <Alert severity="warning" sx={{ mt: 0.75, py: 0 }}>
              {row.conflict_reason}
            </Alert>
          ) : null}
        </Box>
        <Stack gap={0.75} alignItems="stretch" sx={{ flexShrink: 0 }}>
          <Button
            size="small"
            variant="contained"
            disabled={disabled || isConflict}
            onClick={onAccept}
          >
            {busy ? <CircularProgress size={16} color="inherit" /> : "Aceptar"}
          </Button>
          <Button
            size="small"
            color="error"
            variant="outlined"
            disabled={disabled}
            onClick={onReject}
          >
            Rechazar
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
}
