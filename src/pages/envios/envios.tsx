import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  LinearProgress,
  Paper,
  Snackbar,
  Stack,
  Typography,
} from "@mui/material";
import axios from "axios";
import { useOwner } from "../../modules/owner";
import { extractAxiosErrorMessage } from "../clientes/extract-axios-error";
import NuevoPedidoDialog from "../clientes/nuevo-pedido-dialog";
import { clientesPageSx, clientesSectionPaperSx } from "../clientes/clientes-page-layout";
import EnviosCalendar from "./envios-calendar";
import EnviosDayDialog from "./envios-day-dialog";
import EnviosMap from "./envios-map";
import { fetchPedidoCalendario } from "./fetch-calendario";
import { calendarioToPedidoItem } from "./calendario-to-pedido";
import {
  groupCalendarioByFecha,
  monthGridRange,
  todayYmdLocal,
} from "./calendar-utils";
import { unlocatedDomicilioIds } from "./map-pins";
import { useDayGeocode } from "./use-day-geocode";
import type { PedidoCalendarioItem } from "./types";

const EMPTY_ITEMS: PedidoCalendarioItem[] = [];

export default function EnviosPage() {
  const { owner } = useOwner();
  const now = new Date();
  const todayYmd = todayYmdLocal(now);
  const [cursor, setCursor] = useState(() => ({
    year: now.getFullYear(),
    month: now.getMonth(),
  }));
  const [selectedYmd, setSelectedYmd] = useState(todayYmd);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<PedidoCalendarioItem | null>(null);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "error";
  }>({ open: false, message: "", severity: "success" });

  const { from, to, cells } = useMemo(
    () => monthGridRange(cursor.year, cursor.month),
    [cursor.year, cursor.month],
  );

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["pedido-calendario", from, to, owner],
    queryFn: () => fetchPedidoCalendario(from, to),
  });

  const byFecha = useMemo(
    () => groupCalendarioByFecha(data?.items ?? []),
    [data?.items],
  );
  const selectedItems = byFecha[selectedYmd]?.items ?? EMPTY_ITEMS;
  const coordsByAddress = useDayGeocode(selectedItems);
  const unlocatedIds = useMemo(
    () => unlocatedDomicilioIds(selectedItems, coordsByAddress),
    [selectedItems, coordsByAddress],
  );
  const monthHasItems = (data?.items?.length ?? 0) > 0;
  const monthLabel = new Date(cursor.year, cursor.month, 1).toLocaleDateString("es-CO", {
    month: "long",
    year: "numeric",
  });

  const goMonth = (delta: number) => {
    setCursor((prev) => {
      const d = new Date(prev.year, prev.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  };

  const goToday = () => {
    const t = new Date();
    setCursor({ year: t.getFullYear(), month: t.getMonth() });
    setSelectedYmd(todayYmdLocal(t));
  };

  const openEdit = (item: PedidoCalendarioItem) => {
    setEditItem(item);
  };

  return (
    <Box sx={clientesPageSx}>
      <Stack spacing={0.5} sx={{ mb: 2.5 }}>
        <Typography variant="h5" fontWeight={800}>
          Coordinar envíos
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Pedidos reservados y pagados por fecha tentativa de entrega.
        </Typography>
      </Stack>

      {isFetching ? <LinearProgress sx={{ mb: 2, borderRadius: 1 }} /> : null}

      {isError ? (
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => refetch()}>
              Reintentar
            </Button>
          }
          sx={{ mb: 2 }}
        >
          {extractAxiosErrorMessage(error, "No se pudo cargar el calendario de envíos.")}
        </Alert>
      ) : null}

      <Paper sx={{ ...clientesSectionPaperSx, p: { xs: 2, md: 2.5 } }}>
        {isLoading && !data ? (
          <LinearProgress sx={{ borderRadius: 1 }} />
        ) : (
          <EnviosCalendar
            monthLabel={monthLabel}
            cells={cells}
            byFecha={byFecha}
            selectedYmd={selectedYmd}
            todayYmd={todayYmd}
            onPrev={() => goMonth(-1)}
            onNext={() => goMonth(1)}
            onToday={goToday}
            onSelectDay={(ymd) => {
              setSelectedYmd(ymd);
              setDialogOpen(true);
            }}
          />
        )}
        {!isLoading && !isError && !monthHasItems ? (
          <Typography color="text.secondary" sx={{ mt: 2 }}>
            No hay envíos pendientes este mes
          </Typography>
        ) : null}
      </Paper>

      <Paper sx={{ ...clientesSectionPaperSx, p: { xs: 2, md: 2.5 }, mt: 2 }}>
        <Typography variant="subtitle1" fontWeight={800} sx={{ mb: 1.5 }}>
          Mapa del día
        </Typography>
        <EnviosMap
          items={selectedItems}
          coordsByAddress={coordsByAddress}
          onEditItem={openEdit}
        />
      </Paper>

      <EnviosDayDialog
        open={dialogOpen}
        ymd={selectedYmd}
        items={selectedItems}
        unlocatedIds={unlocatedIds}
        onClose={() => setDialogOpen(false)}
        onEditItem={openEdit}
      />

      {editItem ? (
        <NuevoPedidoDialog
          open
          mode="edit"
          clientId={editItem.client_id}
          pedido={calendarioToPedidoItem(editItem)}
          onClose={() => setEditItem(null)}
          onSaved={() => {
            setSnackbar({
              open: true,
              message: "Entrega actualizada",
              severity: "success",
            });
            void refetch();
          }}
          onError={(err) => {
            const conflict = axios.isAxiosError(err) && err.response?.status === 409;
            setSnackbar({
              open: true,
              message: extractAxiosErrorMessage(
                err,
                conflict
                  ? "Este pedido ya no se puede editar"
                  : "No se pudo guardar la entrega",
              ),
              severity: "error",
            });
            void refetch();
          }}
        />
      ) : null}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
