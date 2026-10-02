import { useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Alert,
  Box,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { formatCOP } from "../../../utils/convert";
import { useExchangeRates } from "../../../utils/tasa";
import { mapSettledWithConcurrency } from "../../../utils/concurrency";
import { apiUrl, API_BASE } from "../../../config/api";
import { LoadingScreen } from "../../../components/loading";
import PropertyCard from "./property-card";
import {
  PropertyDeleteDialog,
  PropertyNotesDialog,
  PropertyReturnDialog,
  cardNameForSale,
} from "./property-dialogs";
import {
  propertyCardsGridSx,
  propertyHighlightPanelSx,
  propertyKpiCardSx,
  propertyKpiGridSx,
  propertyMutedLabelSx,
  propertyPageSx,
  propertySectionPaperSx,
  propertyStatValueSx,
  propertyToolbarSx,
} from "./property-page-layout";
import type { KeepSale, PropertySortKey, PropertyStockItem } from "./property-types";
import { extractAxiosMessage, propertyCostInCop } from "./property-utils";

const SORT_LABELS: Record<PropertySortKey, string> = {
  fecha: "Fecha · más reciente",
  nombre: "Nombre · A–Z",
  costo: "Costo · mayor primero",
};

export default function PropertyList() {
  const { convert } = useExchangeRates();
  const queryClient = useQueryClient();

  const [stockData, setStockData] = useState<Record<string, PropertyStockItem>>({});
  const [stockLoadingIds, setStockLoadingIds] = useState<Set<string>>(() => new Set());
  const [stockFailedIds, setStockFailedIds] = useState<Set<string>>(() => new Set());
  const [busqueda, setBusqueda] = useState("");
  const [orden, setOrden] = useState<PropertySortKey>("fecha");

  const [returnTarget, setReturnTarget] = useState<KeepSale | null>(null);
  const [returnLoading, setReturnLoading] = useState(false);
  const [returnError, setReturnError] = useState("");

  const [deleteTarget, setDeleteTarget] = useState<KeepSale | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const [notesTarget, setNotesTarget] = useState<KeepSale | null>(null);
  const [notesDraft, setNotesDraft] = useState("");
  const [notesLoading, setNotesLoading] = useState(false);
  const [notesError, setNotesError] = useState("");

  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string }>({
    open: false,
    message: "",
  });

  const { data: keepCards = [], isLoading, isError } = useQuery<KeepSale[]>({
    queryKey: ["property-cards"],
    queryFn: async () => {
      const res = await axios.get(apiUrl("/sales/keep"));
      return Array.isArray(res.data) ? res.data : [];
    },
  });

  const inFlightStockIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const inFlight = inFlightStockIdsRef.current;
    const pendingIds = Array.from(
      new Set(
        keepCards
          .map((sale) => sale.stock_id)
          .filter(
            (id) =>
              id &&
              !stockData[id] &&
              !stockFailedIds.has(id) &&
              !inFlight.has(id),
          ),
      ),
    );
    if (pendingIds.length === 0) return;

    pendingIds.forEach((id) => inFlight.add(id));
    setStockLoadingIds((prev) => {
      const next = new Set(prev);
      pendingIds.forEach((id) => next.add(id));
      return next;
    });

    void (async () => {
      const responses = await mapSettledWithConcurrency(pendingIds, (id) =>
        axios.get(`${API_BASE}/stock/${id}`),
      );
      const updated: Record<string, PropertyStockItem> = {};
      const failed: string[] = [];

      responses.forEach((res, index) => {
        const stockId = pendingIds[index];
        if (res.ok && res.value?.data?._id) {
          updated[res.value.data._id] = res.value.data;
        } else {
          failed.push(stockId);
        }
      });
      pendingIds.forEach((id) => inFlight.delete(id));

      if (Object.keys(updated).length > 0) {
        setStockData((prev) => ({ ...prev, ...updated }));
      }

      setStockLoadingIds((prev) => {
        const next = new Set(prev);
        pendingIds.forEach((id) => next.delete(id));
        return next;
      });

      if (failed.length > 0) {
        setStockFailedIds((prev) => {
          const next = new Set(prev);
          failed.forEach((id) => next.add(id));
          return next;
        });
      }
    })();
  }, [keepCards, stockData, stockFailedIds]);

  const filasFiltradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    let rows = keepCards.filter((sale) => {
      if (!q) return true;
      const stock = stockData[sale.stock_id];
      const name = stock?.card_name?.toLowerCase() ?? sale.card_id.toLowerCase();
      const id = (stock?.card_id ?? sale.card_id).toLowerCase();
      return name.includes(q) || id.includes(q);
    });

    rows = [...rows].sort((a, b) => {
      if (orden === "fecha") {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      if (orden === "nombre") {
        const na = stockData[a.stock_id]?.card_name?.toLowerCase() ?? a.card_id;
        const nb = stockData[b.stock_id]?.card_name?.toLowerCase() ?? b.card_id;
        return na.localeCompare(nb, "es");
      }
      return (
        propertyCostInCop(stockData[b.stock_id], convert) -
        propertyCostInCop(stockData[a.stock_id], convert)
      );
    });

    return rows;
  }, [keepCards, stockData, busqueda, orden, convert]);

  const valorInvertidoCOP = useMemo(
    () =>
      filasFiltradas.reduce(
        (total, sale) => total + propertyCostInCop(stockData[sale.stock_id], convert),
        0,
      ),
    [filasFiltradas, stockData, convert],
  );

  const invalidateProperty = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["property-cards"] }),
      queryClient.invalidateQueries({ queryKey: ["stock"] }),
      queryClient.invalidateQueries({ queryKey: ["sales-dashboard"] }),
    ]);
  };

  const showSuccess = (message: string) => setSnackbar({ open: true, message });

  const handleConfirmReturn = async () => {
    if (!returnTarget) return;
    setReturnLoading(true);
    setReturnError("");
    try {
      const res = await axios.delete<{ success: boolean; message?: string }>(
        apiUrl(`/sales/${returnTarget._id}`),
      );
      if (res.data?.success === false) {
        setReturnError(res.data.message || "No se pudo devolver la carta al stock.");
        return;
      }
      setReturnTarget(null);
      showSuccess("Carta devuelta al inventario.");
      await invalidateProperty();
    } catch (error: unknown) {
      setReturnError(extractAxiosMessage(error, "No se pudo devolver la carta al stock."));
    } finally {
      setReturnLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    setDeleteError("");
    try {
      const res = await axios.delete<{ success: boolean; message?: string }>(
        apiUrl(`/sales/keep/${deleteTarget._id}`),
      );
      if (res.data?.success === false) {
        setDeleteError(res.data.message || "No se pudo eliminar la carta.");
        return;
      }
      setDeleteTarget(null);
      showSuccess("Carta eliminada del inventario.");
      await invalidateProperty();
    } catch (error: unknown) {
      setDeleteError(extractAxiosMessage(error, "No se pudo eliminar la carta."));
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleSaveNotes = async () => {
    if (!notesTarget) return;
    setNotesLoading(true);
    setNotesError("");
    try {
      const res = await axios.put<{ success: boolean; message?: string }>(
        apiUrl(`/sales/${notesTarget._id}`),
        { notes: notesDraft },
      );
      if (res.data?.success === false) {
        setNotesError(res.data.message || "No se pudieron guardar las notas.");
        return;
      }
      setNotesTarget(null);
      setNotesDraft("");
      showSuccess("Notas actualizadas.");
      await invalidateProperty();
    } catch (error: unknown) {
      setNotesError(extractAxiosMessage(error, "No se pudieron guardar las notas."));
    } finally {
      setNotesLoading(false);
    }
  };

  const hayKeeps = keepCards.length > 0;
  const sinCoincidencias = hayKeeps && filasFiltradas.length === 0;
  const globalBusy = returnLoading || deleteLoading || notesLoading;

  if (isLoading) {
    return <LoadingScreen message="Cargando cartas en propiedad…" />;
  }

  return (
    <Stack spacing={3} sx={propertyPageSx}>
      <Box sx={propertyToolbarSx}>
        <Box>
          <Typography variant="h4" component="h1" fontWeight={800} letterSpacing="-0.02em">
            En propiedad
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Cartas retenidas del inventario vendible — devuélvelas a stock o elimínalas si ya no
            aplican.
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" flexShrink={0}>
          {hayKeeps
            ? `${filasFiltradas.length} de ${keepCards.length} carta${keepCards.length === 1 ? "" : "s"}`
            : "Sin registros"}
        </Typography>
      </Box>

      {isError ? (
        <Alert severity="error">No se pudo cargar la lista. Verifica que el backend esté activo.</Alert>
      ) : null}

      {hayKeeps ? (
        <>
          <Box sx={propertyKpiGridSx}>
            <Paper variant="outlined" sx={propertyKpiCardSx}>
              <Typography sx={propertyMutedLabelSx}>Cartas retenidas</Typography>
              <Typography variant="h5" sx={propertyStatValueSx}>
                {keepCards.length}
              </Typography>
            </Paper>
            <Paper variant="outlined" sx={propertyKpiCardSx}>
              <Typography sx={propertyMutedLabelSx}>Visibles (filtro)</Typography>
              <Typography variant="h5" sx={propertyStatValueSx}>
                {filasFiltradas.length}
              </Typography>
            </Paper>
            <Paper variant="outlined" sx={[propertyKpiCardSx, propertyHighlightPanelSx]}>
              <Typography sx={propertyMutedLabelSx}>Costo acumulado visible</Typography>
              <Typography variant="h5" sx={propertyStatValueSx}>
                {sinCoincidencias ? "—" : formatCOP(Math.round(valorInvertidoCOP))}
              </Typography>
              {!sinCoincidencias ? (
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                  EUR {convert.toEurFromCop(valorInvertidoCOP)?.toFixed(2) ?? "0.00"} · USD{" "}
                  {convert.toUsdFromCop(valorInvertidoCOP)?.toFixed(2) ?? "0.00"}
                </Typography>
              ) : null}
            </Paper>
            <Paper variant="outlined" sx={propertyKpiCardSx}>
              <Typography sx={propertyMutedLabelSx}>Acceso rápido</Typography>
              <Typography variant="body2" sx={{ mt: 0.75 }}>
                Marca cartas desde{" "}
                <Link to="/stock" style={{ fontWeight: 600 }}>
                  inventario
                </Link>{" "}
                o revisión de stock.
              </Typography>
            </Paper>
          </Box>

          <Paper variant="outlined" sx={{ ...propertySectionPaperSx, p: 2.5 }}>
            <Stack direction="row" alignItems="center" gap={2}>
              <TextField
                size="small"
                label="Buscar carta"
                placeholder="Nombre o ID TCGdex…"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                sx={{ width: 360, flexShrink: 0 }}
              />
              <FormControl size="small" sx={{ minWidth: 220 }}>
                <InputLabel id="orden-propiedad-label">Ordenar por</InputLabel>
                <Select
                  labelId="orden-propiedad-label"
                  label="Ordenar por"
                  value={orden}
                  onChange={(e) => setOrden(e.target.value as PropertySortKey)}
                >
                  {(Object.keys(SORT_LABELS) as PropertySortKey[]).map((key) => (
                    <MenuItem key={key} value={key}>
                      {SORT_LABELS[key]}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
          </Paper>
        </>
      ) : null}

      {!hayKeeps ? (
        <Paper variant="outlined" sx={{ ...propertySectionPaperSx, p: 6, textAlign: "center" }}>
          <Typography variant="h6" fontWeight={700} gutterBottom>
            Sin cartas en propiedad
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 480, mx: "auto" }}>
            Cuando retengas cartas del inventario aparecerán aquí con opciones para devolverlas a
            stock, anotar el motivo o eliminarlas del sistema.
          </Typography>
        </Paper>
      ) : sinCoincidencias ? (
        <Alert severity="info">Ninguna carta coincide con «{busqueda.trim()}».</Alert>
      ) : (
        <Box sx={propertyCardsGridSx}>
          {filasFiltradas.map((sale) => {
            const busy =
              globalBusy &&
              (returnTarget?._id === sale._id ||
                deleteTarget?._id === sale._id ||
                notesTarget?._id === sale._id);

            return (
              <PropertyCard
                key={sale._id}
                sale={sale}
                stock={stockData[sale.stock_id]}
                stockLoading={stockLoadingIds.has(sale.stock_id)}
                costCop={propertyCostInCop(stockData[sale.stock_id], convert)}
                busy={!!busy}
                onReturn={() => {
                  setReturnTarget(sale);
                  setReturnError("");
                }}
                onDelete={() => {
                  setDeleteTarget(sale);
                  setDeleteError("");
                }}
                onEditNotes={() => {
                  setNotesTarget(sale);
                  setNotesDraft(sale.notes ?? "");
                  setNotesError("");
                }}
              />
            );
          })}
        </Box>
      )}

      <PropertyReturnDialog
        open={returnTarget !== null}
        cardName={cardNameForSale(returnTarget, stockData)}
        loading={returnLoading}
        error={returnError}
        onClose={() => {
          if (returnLoading) return;
          setReturnTarget(null);
          setReturnError("");
        }}
        onConfirm={() => void handleConfirmReturn()}
      />

      <PropertyDeleteDialog
        open={deleteTarget !== null}
        cardName={cardNameForSale(deleteTarget, stockData)}
        loading={deleteLoading}
        error={deleteError}
        onClose={() => {
          if (deleteLoading) return;
          setDeleteTarget(null);
          setDeleteError("");
        }}
        onConfirm={() => void handleConfirmDelete()}
      />

      <PropertyNotesDialog
        open={notesTarget !== null}
        cardName={cardNameForSale(notesTarget, stockData)}
        notes={notesDraft}
        loading={notesLoading}
        error={notesError}
        onChange={setNotesDraft}
        onClose={() => {
          if (notesLoading) return;
          setNotesTarget(null);
          setNotesDraft("");
          setNotesError("");
        }}
        onSave={() => void handleSaveNotes()}
      />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity="success" variant="filled" onClose={() => setSnackbar((s) => ({ ...s, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Stack>
  );
}
