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

  const expansionByStockId = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of qrExportRows) {
      if (row.expansion) map.set(row.stock_id, row.expansion);
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
        subtitle: `Cola manual · ${rows.length} etiqueta${rows.length === 1 ? "" : "s"} · hoja carta 4×12`,
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
    <div className="w-full max-w-6xl mx-auto p-4 md:p-6">
      <div className="flex flex-wrap items-center gap-3 mb-2">
        <h1 className="text-2xl font-bold text-gray-800">
          Imprimir etiquetas QR
        </h1>
        <Link
          to="/stock"
          className="text-sm text-blue-600 hover:underline no-print"
        >
          Volver a grilla Stock
        </Link>
      </div>
      <p className="text-sm text-gray-600 mb-6">
        Busca líneas de inventario, arma una cola con cantidad y imprime
        etiquetas QR (misma plantilla 4×12 que Exportar QR en Stock).
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white border border-gray-200 rounded-lg p-4">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">Buscador</h2>
          <TextField
            fullWidth
            size="small"
            label="Buscar en inventario"
            placeholder="Mín. 2 caracteres — nombre de carta (como en grilla Stock)"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            disabled={loading}
          />

          {loading ? (
            <p className="text-gray-500 text-sm mt-4">Cargando inventario…</p>
          ) : busqueda.trim().length < 2 ? (
            <p className="text-gray-500 text-sm mt-4">
              Escribe al menos 2 caracteres para ver resultados.
            </p>
          ) : resultados.length === 0 ? (
            <p className="text-gray-500 text-sm mt-4 text-center py-6">
              Sin coincidencias.
            </p>
          ) : (
            <ul className="mt-4 space-y-2 max-h-[28rem] overflow-y-auto">
              {resultados.map((item) => {
                const elegible = eligibleIds.has(item._id);
                const exportRow = exportByStockId.get(item._id);
                const rz = rarezaLabel(item);
                const inQueue = queue.some((e) => e.stockId === item._id);

                return (
                  <li
                    key={item._id}
                    className="flex flex-wrap items-center gap-2 p-2 rounded border border-gray-100 bg-gray-50"
                  >
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt=""
                        className="w-10 h-14 object-cover rounded flex-shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-14 bg-gray-200 rounded flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-[140px]">
                      <p className="font-medium text-sm text-gray-900 leading-tight">
                        {item.card_name || item.card_id}
                      </p>
                      <p className="text-xs text-gray-500">
                        {exportRow?.expansion ? `${exportRow.expansion} · ` : ""}
                        {item.language ? `${item.language} · ` : ""}
                        {rz ? `${rz} · ` : ""}
                        {cardStateLabel(item.card_state)}
                      </p>
                      {exportRow && (
                        <p className="text-xs font-semibold text-blue-800">
                          COP {formatCOP(exportRow.price_cop)}
                        </p>
                      )}
                      <span
                        className={`inline-block mt-1 text-xs px-1.5 py-0.5 rounded ${
                          elegible
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-200 text-gray-600"
                        }`}
                      >
                        {elegible ? "Elegible para QR" : "No elegible"}
                      </span>
                      {inQueue && (
                        <span className="ml-1 text-xs text-blue-700">
                          · en cola
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <TextField
                        type="number"
                        size="small"
                        label="Cant."
                        value={getAddQty(item._id)}
                        onChange={(e) => {
                          const v = parseInt(e.target.value, 10);
                          setAddQtyById((prev) => ({
                            ...prev,
                            [item._id]: Number.isFinite(v) ? v : 1,
                          }));
                        }}
                        inputProps={{ min: 1, style: { width: 48 } }}
                        disabled={!elegible}
                      />
                      <Tooltip
                        title={
                          elegible
                            ? "Añadir a la cola"
                            : "Sin PVP o estado no vendible"
                        }
                      >
                        <span>
                          <Button
                            variant="contained"
                            size="small"
                            disabled={!elegible}
                            onClick={() => handleAdd(item._id)}
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

        <section className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col">
          <h2 className="text-lg font-semibold text-gray-800 mb-2">
            Cola de impresión
          </h2>

          <div className="mb-4 p-3 rounded-lg bg-slate-100 border border-slate-200">
            <p className="text-sm font-medium text-slate-900">
              {formatQrLabelPageStatsMessage(pageStats)}
            </p>
          </div>

          {queue.length === 0 ? (
            <p className="text-gray-500 text-sm flex-1 py-8 text-center">
              La cola está vacía. Busca cartas y pulsa Añadir.
            </p>
          ) : (
            <ul className="space-y-2 flex-1 max-h-[22rem] overflow-y-auto mb-4">
              {queue.map((entry) => {
                const item = stockById.get(entry.stockId);
                const exportRow = exportByStockId.get(entry.stockId);
                const elegible = eligibleIds.has(entry.stockId);

                return (
                  <li
                    key={entry.stockId}
                    className="flex flex-wrap items-center gap-2 p-2 rounded border border-gray-100"
                  >
                    <div className="flex-1 min-w-[120px]">
                      <p className="text-sm font-medium text-gray-900">
                        {item?.card_name ?? exportRow?.card_name ?? entry.stockId}
                      </p>
                      {exportRow?.expansion && (
                        <p className="text-xs text-gray-500">
                          {exportRow.expansion}
                        </p>
                      )}
                      {!elegible && (
                        <p className="text-xs text-amber-700">
                          Ya no elegible para QR
                        </p>
                      )}
                    </div>
                    <TextField
                      type="number"
                      size="small"
                      label="Cant."
                      value={entry.quantity}
                      onChange={(e) => {
                        const v = parseInt(e.target.value, 10);
                        setQuantity(
                          entry.stockId,
                          Number.isFinite(v) ? v : 1,
                        );
                      }}
                      inputProps={{ min: 1, style: { width: 56 } }}
                    />
                    <Button
                      size="small"
                      color="inherit"
                      onClick={() => remove(entry.stockId)}
                    >
                      Quitar
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
            <Button
              variant="contained"
              disabled={totalLabels === 0 || imprimiendo}
              onClick={() => void handleImprimir()}
            >
              {imprimiendo ? "Generando…" : "Imprimir cola"}
            </Button>
            <Button
              variant="outlined"
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
