import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import {
  Alert,
  Button,
  Snackbar,
  TextField,
  Tooltip,
} from "@mui/material";
import { apiUrl } from "../../config/api";
import type { StockListItem } from "../../types/stock";
import { formatCOP } from "../../utils/convert";
import { operationalRarezaLabel } from "../../constants/item-rareza";
import { filterStockVisibleInGrid } from "../../utils/stock-grid-visible";
import {
  openStockQrLabelsPrintWindow,
  type StockQrExportRow,
} from "../../modules/stock-barcode";
import {
  computeQrLabelPageStats,
  expandQueueToExportRows,
  filterStockForSearch,
  formatQrLabelPageStatsMessage,
  usePrintQueue,
} from "../../modules/stock-qr-print-queue";

function rarezaLabel(item: StockListItem): string | null {
  let rz =
    item.rareza != null && String(item.rareza).trim() !== ""
      ? String(item.rareza).trim()
      : "";
  if (rz === "" && item.holofoil) rz = "holofoil";
  if (rz === "" && item.league_card) rz = "league card";
  return rz === "" ? null : operationalRarezaLabel(rz);
}

function cardStateLabel(state: string): string {
  const labels: Record<string, string> = {
    disponible: "Disponible",
    en_stock_colombia: "En stock Colombia",
    reserva: "Reserva",
    vendida: "Vendida",
    propiedad: "Propiedad",
    near_mint: "Near mint",
  };
  return labels[state] ?? state;
}

export default function ImprimirEtiquetasQrPage() {
  const [busqueda, setBusqueda] = useState("");
  const [addQtyById, setAddQtyById] = useState<Record<string, number>>({});
  const [imprimiendo, setImprimiendo] = useState(false);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "error" | "warning";
  }>({ open: false, message: "", severity: "success" });

  const showSnackbar = (
    message: string,
    severity: "success" | "error" | "warning" = "success",
  ) => {
    setSnackbar({ open: true, message, severity });
  };

  const { queue, add, setQuantity, remove, clear, totalLabels } =
    usePrintQueue();

  const { data: stock = [], isLoading: loadingStock } = useQuery<
    StockListItem[]
  >({
    queryKey: ["stock"],
    queryFn: async () => {
      const res = await axios.get(apiUrl("/stock"));
      return Array.isArray(res.data)
        ? filterStockVisibleInGrid(res.data)
        : [];
    },
  });

  const { data: qrExportRows = [], isLoading: loadingQr } = useQuery<
    StockQrExportRow[]
  >({
    queryKey: ["stock", "qr-export"],
    queryFn: async () => {
      const res = await axios.get(apiUrl("/stock/qr-export"));
      return Array.isArray(res.data) ? res.data : [];
    },
  });

  const exportByStockId = useMemo(() => {
    const map = new Map<string, StockQrExportRow>();
    for (const row of qrExportRows) {
      map.set(row.stock_id, row);
    }
    return map;
  }, [qrExportRows]);

  const eligibleIds = useMemo(
    () => new Set(qrExportRows.map((r) => r.stock_id)),
    [qrExportRows],
  );

  const stockById = useMemo(() => {
    const map = new Map<string, StockListItem>();
    for (const item of stock) {
      map.set(item._id, item);
    }
    return map;
  }, [stock]);

  const resultados = useMemo(
    () => filterStockForSearch(stock, busqueda),
    [stock, busqueda],
  );

  const pageStats = useMemo(
    () => computeQrLabelPageStats(totalLabels),
    [totalLabels],
  );

  const getAddQty = (stockId: string) => addQtyById[stockId] ?? 1;

  const handleAdd = (stockId: string) => {
    if (!eligibleIds.has(stockId)) return;
    add(stockId, getAddQty(stockId));
    showSnackbar("Añadido a la cola de impresión");
  };

  const handleImprimir = async () => {
    if (totalLabels === 0) return;
    try {
      setImprimiendo(true);
      const { rows, omittedCount } = expandQueueToExportRows(
        queue,
        exportByStockId,
      );

      if (rows.length === 0) {
        showSnackbar(
          "Ninguna línea de la cola es elegible para QR. Revisa PVP y estado.",
          "error",
        );
        return;
      }

      if (omittedCount > 0) {
        showSnackbar(
          `Se omitieron ${omittedCount} etiqueta${omittedCount === 1 ? "" : "s"} no elegibles; se imprimen ${rows.length}.`,
          "warning",
        );
      }

      await openStockQrLabelsPrintWindow(rows, {
        subtitle: `Cola manual · ${rows.length} etiqueta${rows.length === 1 ? "" : "s"} · hoja A4 5×12`,
      });
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "No se pudieron generar las etiquetas QR.";
      showSnackbar(msg, "error");
    } finally {
      setImprimiendo(false);
    }
  };

  const loading = loadingStock || loadingQr;

  return (
    <div className="w-full min-h-[calc(100vh-7rem)] flex flex-col">
      <div className="flex flex-wrap items-center gap-3 mb-1">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800">
          Imprimir etiquetas QR
        </h1>
        <Link
          to="/stock"
          className="text-sm md:text-base text-blue-600 hover:underline no-print"
        >
          Volver a grilla Stock
        </Link>
      </div>
      <p className="text-sm md:text-base text-gray-600 mb-4">
        Busca líneas de inventario, arma una cola con cantidad y imprime
        etiquetas QR (misma plantilla A4 5×12 que Exportar QR en Stock).
      </p>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-4 flex-1 min-h-0">
        <section className="bg-white border border-gray-200 rounded-lg p-4 md:p-5 flex flex-col min-h-[420px] xl:min-h-0">
          <h2 className="text-lg md:text-xl font-semibold text-gray-800 mb-3">
            Buscador
          </h2>
          <TextField
            fullWidth
            label="Buscar en inventario"
            placeholder="Mín. 2 caracteres — nombre de carta (como en grilla Stock)"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            disabled={loading}
          />

          {loading ? (
            <p className="text-gray-500 text-base mt-4">Cargando inventario…</p>
          ) : busqueda.trim().length < 2 ? (
            <p className="text-gray-500 text-base mt-4">
              Escribe al menos 2 caracteres para ver resultados.
            </p>
          ) : resultados.length === 0 ? (
            <p className="text-gray-500 text-base mt-4 text-center py-8">
              Sin coincidencias.
            </p>
          ) : (
            <ul className="mt-4 space-y-3 flex-1 min-h-0 overflow-y-auto pr-1">
              {resultados.map((item) => {
                const elegible = eligibleIds.has(item._id);
                const exportRow = exportByStockId.get(item._id);
                const rz = rarezaLabel(item);
                const inQueue = queue.some((e) => e.stockId === item._id);

                return (
                  <li
                    key={item._id}
                    className="flex items-center gap-3 md:gap-4 p-3 md:p-4 rounded-lg border border-gray-200 bg-gray-50"
                  >
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt=""
                        className="w-20 h-28 md:w-24 md:h-32 object-contain rounded-md bg-white border border-gray-200 flex-shrink-0 shadow-sm"
                      />
                    ) : (
                      <div className="w-20 h-28 md:w-24 md:h-32 bg-gray-200 rounded-md flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-base md:text-lg text-gray-900 leading-snug">
                        {item.card_name || item.card_id}
                      </p>
                      <p className="text-sm md:text-base text-gray-600 mt-1">
                        {exportRow?.expansion ? `${exportRow.expansion} · ` : ""}
                        {item.language ? `${item.language} · ` : ""}
                        {rz ? `${rz} · ` : ""}
                        {cardStateLabel(item.card_state)}
                      </p>
                      {exportRow && (
                        <p className="text-sm md:text-base font-bold text-blue-800 mt-1">
                          COP {formatCOP(exportRow.price_cop)}
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <span
                          className={`inline-block text-sm px-2 py-0.5 rounded ${
                            elegible
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-200 text-gray-600"
                          }`}
                        >
                          {elegible ? "Elegible para QR" : "No elegible"}
                        </span>
                        {inQueue && (
                          <span className="text-sm text-blue-700 font-medium">
                            En cola
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-shrink-0">
                      <TextField
                        type="number"
                        label="Cant."
                        value={getAddQty(item._id)}
                        onChange={(e) => {
                          const v = parseInt(e.target.value, 10);
                          setAddQtyById((prev) => ({
                            ...prev,
                            [item._id]: Number.isFinite(v) ? v : 1,
                          }));
                        }}
                        inputProps={{ min: 1, style: { width: 64 } }}
                        disabled={!elegible}
                      />
                      <Tooltip
                        title={
                          elegible
                            ? "Añadir a la cola"
                            : "Sin PVP o estado no imprimible (p. ej. vendida)"
                        }
                      >
                        <span>
                          <Button
                            variant="contained"
                            disabled={!elegible}
                            onClick={() => handleAdd(item._id)}
                            sx={{ minWidth: 96, whiteSpace: "nowrap" }}
                          >
                            Añadir
                          </Button>
                        </span>
                      </Tooltip>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="bg-white border border-gray-200 rounded-lg p-4 md:p-5 flex flex-col min-h-[320px] xl:min-h-0">
          <h2 className="text-lg md:text-xl font-semibold text-gray-800 mb-3">
            Cola de impresión
          </h2>

          <div className="mb-4 p-3 md:p-4 rounded-lg bg-slate-100 border border-slate-200">
            <p className="text-sm md:text-base font-medium text-slate-900">
              {formatQrLabelPageStatsMessage(pageStats)}
            </p>
          </div>

          {queue.length === 0 ? (
            <p className="text-gray-500 text-base flex-1 py-10 text-center">
              La cola está vacía. Busca cartas y pulsa Añadir.
            </p>
          ) : (
            <ul className="space-y-3 flex-1 min-h-0 overflow-y-auto mb-4 pr-1">
              {queue.map((entry) => {
                const item = stockById.get(entry.stockId);
                const exportRow = exportByStockId.get(entry.stockId);
                const elegible = eligibleIds.has(entry.stockId);
                const imageUrl = item?.image_url;

                return (
                  <li
                    key={entry.stockId}
                    className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 bg-gray-50"
                  >
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt=""
                        className="w-16 h-24 md:w-20 md:h-28 object-contain rounded-md bg-white border border-gray-200 flex-shrink-0"
                      />
                    ) : (
                      <div className="w-16 h-24 md:w-20 md:h-28 bg-gray-200 rounded-md flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-base font-semibold text-gray-900 leading-snug">
                        {item?.card_name ?? exportRow?.card_name ?? entry.stockId}
                      </p>
                      {(exportRow?.expansion || exportRow?.language) && (
                        <p className="text-sm text-gray-600 mt-0.5">
                          {[exportRow?.expansion, exportRow?.language]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      )}
                      <p className="text-sm font-medium text-slate-700 mt-1">
                        {entry.quantity} etiqueta{entry.quantity === 1 ? "" : "s"}
                      </p>
                      {!elegible && (
                        <p className="text-sm text-amber-700 mt-1">
                          Ya no elegible para QR
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-shrink-0">
                      <TextField
                        type="number"
                        label="Cant."
                        value={entry.quantity}
                        onChange={(e) => {
                          const v = parseInt(e.target.value, 10);
                          setQuantity(
                            entry.stockId,
                            Number.isFinite(v) ? v : 1,
                          );
                        }}
                        inputProps={{ min: 1, style: { width: 64 } }}
                      />
                      <Button
                        color="inherit"
                        onClick={() => remove(entry.stockId)}
                        sx={{ minWidth: 88 }}
                      >
                        Quitar
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="flex flex-wrap gap-3 pt-3 border-t border-gray-200">
            <Button
              variant="contained"
              size="large"
              disabled={totalLabels === 0 || imprimiendo}
              onClick={() => void handleImprimir()}
            >
              {imprimiendo ? "Generando…" : "Imprimir cola"}
            </Button>
            <Button
              variant="outlined"
              size="large"
              color="inherit"
              disabled={queue.length === 0}
              onClick={clear}
            >
              Vaciar cola
            </Button>
          </div>
        </section>
      </div>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </div>
  );
}
