import { useState } from "react";
import axios from "axios";
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { formatCOP } from "../../utils/convert";
import { extractAxiosErrorMessage } from "./extract-axios-error";
import { parseAbonoAmountCop } from "./parse-abono-amount";
import {
  clientesKpiCardSx,
  clientesMutedLabelSx,
  clientesStatValueSx,
} from "./clientes-page-layout";

export type AbonoCapitalItem = {
  id: string;
  amount_cop: number;
  created_at: string;
};

export type AbonosCapitalData = {
  total_pvp_cop: number;
  abonado_cop: number;
  saldo_cop: number;
  abonos: AbonoCapitalItem[];
};

function formatAbonoFecha(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" });
}

type NotifyFn = (message: string, severity: "success" | "error") => void;

type Props = {
  data?: AbonosCapitalData;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  allowMutate: boolean;
  addPending: boolean;
  deletePending: boolean;
  onAdd: (amount: number) => Promise<void>;
  onDelete: (abonoId: string) => Promise<void>;
  onNotify: NotifyFn;
  hideOnConflict?: boolean;
};

export default function AbonosCapitalBlock({
  data,
  isLoading,
  isError,
  error,
  allowMutate,
  addPending,
  deletePending,
  onAdd,
  onDelete,
  onNotify,
  hideOnConflict = true,
}: Props) {
  const [addOpen, setAddOpen] = useState(false);
  const [amountRaw, setAmountRaw] = useState("");
  const [amountError, setAmountError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AbonoCapitalItem | null>(null);

  if (isLoading) {
    return (
      <Stack direction="row" alignItems="center" gap={1} sx={{ py: 1 }}>
        <CircularProgress size={18} />
        <Typography variant="body2" color="text.secondary">
          Cargando abonos…
        </Typography>
      </Stack>
    );
  }

  if (isError) {
    if (hideOnConflict && axios.isAxiosError(error) && error.response?.status === 409) {
      return null;
    }
    return (
      <Typography variant="body2" color="error">
        {extractAxiosErrorMessage(error, "No se pudieron cargar los abonos.")}
      </Typography>
    );
  }

  if (!data) return null;

  const canAdd = allowMutate && data.saldo_cop > 0;
  const saldoColor = data.saldo_cop < 0 ? "error.main" : "text.primary";

  const closeAdd = () => {
    setAddOpen(false);
    setAmountRaw("");
    setAmountError(null);
  };

  const submitAdd = async () => {
    const parsed = parseAbonoAmountCop(amountRaw, data.saldo_cop);
    if (!parsed.ok) {
      setAmountError(parsed.message);
      return;
    }
    try {
      await onAdd(parsed.amount);
      onNotify("Abono registrado.", "success");
      closeAdd();
    } catch (err) {
      onNotify(extractAxiosErrorMessage(err, "No se pudo registrar el abono."), "error");
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      await onDelete(pendingDelete.id);
      onNotify("Abono eliminado.", "success");
      setPendingDelete(null);
    } catch (err) {
      onNotify(extractAxiosErrorMessage(err, "No se pudo eliminar el abono."), "error");
    }
  };

  return (
    <Stack spacing={2}>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { lg: "repeat(3, 1fr)" },
          gap: 1.5,
        }}
      >
        <Box sx={clientesKpiCardSx}>
          <Typography sx={clientesMutedLabelSx}>Total PVP</Typography>
          <Typography variant="h6" sx={clientesStatValueSx}>
            {formatCOP(data.total_pvp_cop)}
          </Typography>
        </Box>
        <Box sx={clientesKpiCardSx}>
          <Typography sx={clientesMutedLabelSx}>Abonado</Typography>
          <Typography variant="h6" sx={clientesStatValueSx}>
            {formatCOP(data.abonado_cop)}
          </Typography>
        </Box>
        <Box sx={clientesKpiCardSx}>
          <Typography sx={clientesMutedLabelSx}>Saldo</Typography>
          <Typography variant="h6" sx={{ ...clientesStatValueSx, color: saldoColor }}>
            {formatCOP(data.saldo_cop)}
          </Typography>
        </Box>
      </Box>

      {!allowMutate ? (
        <Typography variant="body2" color="text.secondary">
          El pedido ya no está reservado; los abonos quedan como registro.
        </Typography>
      ) : !canAdd ? (
        <Typography variant="body2" color="text.secondary">
          {data.total_pvp_cop <= 0
            ? "No hay PVP en las cartas; no se puede agregar un abono hasta asignar precios."
            : data.saldo_cop < 0
              ? "El saldo es negativo (el PVP bajó respecto a lo abonado). No se pueden agregar abonos."
              : "No hay saldo para abonar."}
        </Typography>
      ) : null}

      {allowMutate ? (
        <Box>
          <Button
            variant="contained"
            disabled={!canAdd || addPending}
            onClick={() => setAddOpen(true)}
            sx={{ textTransform: "none", fontWeight: 600 }}
          >
            Agregar abono
          </Button>
        </Box>
      ) : null}

      {data.abonos.length > 0 ? (
        <Stack spacing={0}>
          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.75 }}>
            Abonos
          </Typography>
          {data.abonos.map((abono) => (
            <Stack
              key={abono.id}
              direction="row"
              alignItems="center"
              spacing={1.5}
              sx={{ py: 1, borderBottom: 1, borderColor: "divider" }}
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography fontWeight={600}>{formatCOP(abono.amount_cop)}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {formatAbonoFecha(abono.created_at)}
                </Typography>
              </Box>
              {allowMutate ? (
                <Button
                  color="error"
                  variant="outlined"
                  size="small"
                  disabled={deletePending}
                  onClick={() => setPendingDelete(abono)}
                  sx={{ textTransform: "none", fontWeight: 600 }}
                >
                  Borrar
                </Button>
              ) : null}
            </Stack>
          ))}
        </Stack>
      ) : (
        <Typography variant="body2" color="text.secondary">
          Aún no hay abonos registrados.
        </Typography>
      )}

      <Dialog open={addOpen} onClose={addPending ? undefined : closeAdd}>
        <DialogTitle>Agregar abono</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Saldo disponible: {formatCOP(data.saldo_cop)}
          </Typography>
          <TextField
            autoFocus
            fullWidth
            label="Monto (COP)"
            value={amountRaw}
            onChange={(e) => {
              setAmountRaw(e.target.value.replace(/[^\d]/g, ""));
              setAmountError(null);
            }}
            error={Boolean(amountError)}
            helperText={amountError ?? "Solo pesos enteros, sin decimales."}
            slotProps={{ htmlInput: { inputMode: "numeric", pattern: "[0-9]*" } }}
            sx={{ mt: 0.5, minWidth: 280 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeAdd} disabled={addPending} sx={{ textTransform: "none" }}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            disabled={addPending}
            onClick={() => void submitAdd()}
            sx={{ textTransform: "none", fontWeight: 600 }}
          >
            {addPending ? "Guardando…" : "Agregar"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={pendingDelete != null}
        onClose={deletePending ? undefined : () => setPendingDelete(null)}
      >
        <DialogTitle>Eliminar abono</DialogTitle>
        <DialogContent>
          <Typography>
            ¿Eliminar el abono de {pendingDelete ? formatCOP(pendingDelete.amount_cop) : ""}?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setPendingDelete(null)}
            disabled={deletePending}
            sx={{ textTransform: "none" }}
          >
            Cancelar
          </Button>
          <Button
            color="error"
            variant="contained"
            disabled={deletePending}
            onClick={() => void confirmDelete()}
            sx={{ textTransform: "none", fontWeight: 600 }}
          >
            {deletePending ? "Eliminando…" : "Eliminar"}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
