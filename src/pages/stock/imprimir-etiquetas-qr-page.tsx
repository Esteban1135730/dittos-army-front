import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import {
  Alert,
  Button,
  Checkbox,
  Snackbar,
  TextField,
  Tooltip,
} from "@mui/material";
import { apiUrl } from "../../config/api";
import { ensureBulkProduct } from "../../api/ensure-bulk";
import type { StockListItem } from "../../types/stock";
import { formatCOP } from "../../utils/convert";
import { operationalRarezaLabel } from "../../constants/item-rareza";
import {
  isQuantityProduct,
  resolveStockImageUrl,
} from "../../constants/bulk-product";
import { filterStockVisibleInGrid } from "../../utils/stock-grid-visible";
import {
  downloadOpenLabelQrLabelsCsv,
  openStockQrLabelsPrintWindow,
  openStockQrLabelsThermalPrintWindow,
  type StockQrExportRow,
} from "../../modules/stock-barcode";
import {
  computeQrLabelPageStats,
  expandQueueToExportRows,
  filterStockForSearch,
  formatQrLabelPageStatsMessage,
  usePrintQueue,
} from "../../modules/stock-qr-print-queue";
import {
  isQrEligible,
  parseStockIdsQuery,
} from "../../modules/receipt-wizard";

function rarezaLabel(item: StockListItem): string | null {
  let rz =
    item.rareza != null && String(item.rareza).trim() !== ""
      ? String(item.rareza).trim()
      : "";
  if (rz === "" && item.holofoil) rz = "holofoil";
  if (rz === "" && item.league_card) rz = "league card";
  return rz === "" ? null : operationalRarezaLabel(rz);
}

/** Estados que GET /stock/qr-export admite (alineado al back). */
const QR_PRINTABLE_STATES = new Set([
  "disponible",
  "en_stock_colombia",
  "reserva",
]);

function stockHasListedPvp(item: StockListItem | undefined): boolean {
  return item != null && typeof item.pvp === "number" && item.pvp > 0;
}

function qrBlockReason(
  item: StockListItem | undefined,
  inQrExport: boolean,
): string {
  if (inQrExport) return "";
  if (!item) return "No está en inventario visible";
  if (!QR_PRINTABLE_STATES.has(item.card_state)) {
    return `Estado no imprimible (${cardStateLabel(item.card_state)})`;
  }
  if (!stockHasListedPvp(item)) return "Sin PVP";
  return "Con PVP en stock pero aún no en export QR — recarga la página";
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
  const [searchParams] = useSearchParams();
  const receiptStockIds = useMemo(
    () => parseStockIdsQuery(searchParams.get("stockIds")),
    [searchParams],
  );

  const [busqueda, setBusqueda] = useState("");
  const [addQtyById, setAddQtyById] = useState<Record<string, number>>({});
  const [imprimiendo, setImprimiendo] = useState<
    "a4" | "thermal" | "openlabel" | "all-a4" | "all-thermal" | null
  >(null);
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

  const { queue, add, addManyMissing, setQuantity, remove, removeMany, clear, totalLabels, queuedIds } =
    usePrintQueue();

  const [receiptSeeded, setReceiptSeeded] = useState(false);
  const receiptIdsKey = receiptStockIds.join(",");

  useEffect(() => {
    setReceiptSeeded(false);
  }, [receiptIdsKey]);

  useEffect(() => {
    void ensureBulkProduct().then((r) => {
      if (!r.ok) {
        showSnackbar(r.error ?? "No se pudo asegurar el SKU bulk", "warning");
      }
    });
    // Solo al montar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fromReceipt = receiptStockIds.length > 0;

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
    // Tras create-tanda / PVP del wizard, no reutilizar caché obsoleta.
    refetchOnMount: fromReceipt ? "always" : true,
  });

  const { data: qrExportRows = [], isLoading: loadingQr } = useQuery<
    StockQrExportRow[]
  >({
    queryKey: ["stock", "qr-export"],
    queryFn: async () => {
      const res = await axios.get(apiUrl("/stock/qr-export"));
      return Array.isArray(res.data) ? res.data : [];
    },
    refetchOnMount: fromReceipt ? "always" : true,
  });

  const exportByStockId = useMemo(() => {
    const map = new Map<string, StockQrExportRow>();
    for (const row of qrExportRows) {
      const key = String(row.stock_id ?? "").trim().toLowerCase();
      if (key) map.set(key, row);
    }
    return map;
  }, [qrExportRows]);

  const eligibleIds = useMemo(
    () =>
      new Set(
        qrExportRows
          .map((r) => String(r.stock_id ?? "").trim().toLowerCase())
          .filter(Boolean),
      ),
    [qrExportRows],
  );

  const stockById = useMemo(() => {
    const map = new Map<string, StockListItem>();
    for (const item of stock) {
      const key = String(item._id ?? "").trim().toLowerCase();
      if (key) map.set(key, item);
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
    const key = String(stockId ?? "").trim().toLowerCase();
    if (!eligibleIds.has(key)) return;
    add(key, getAddQty(key));
    showSnackbar("Añadido a la cola de impresión");
  };

  const receiptItems = useMemo(() => {
    if (receiptStockIds.length === 0) return [];
    return receiptStockIds.map((id) => {
      const key = id.toLowerCase();
      const item = stockById.get(key);
      const exportRow = exportByStockId.get(key);
      const elegible = isQrEligible(key, eligibleIds);
      return {
        id: key,
        item,
        elegible,
        exportRow,
        blockReason: elegible
          ? null
          : qrBlockReason(item, exportRow != null),
      };
    });
  }, [receiptStockIds, stockById, eligibleIds, exportByStockId]);

  const receiptEligibleIds = useMemo(
    () => receiptItems.filter((r) => r.elegible).map((r) => r.id),
    [receiptItems],
  );

  const receiptSelectedCount = useMemo(
    () => receiptEligibleIds.filter((id) => queuedIds.has(id)).length,
    [receiptEligibleIds, queuedIds],
  );

  /** Al cargar recepción: preselecciona en cola solo las elegibles (con PVP). */
  useEffect(() => {
    if (receiptSeeded) return;
    if (receiptStockIds.length === 0) return;
    if (loadingStock || loadingQr) return;
    if (receiptEligibleIds.length > 0) {
      addManyMissing(receiptEligibleIds);
    }
    setReceiptSeeded(true);
  }, [
    receiptSeeded,
    receiptStockIds.length,
    loadingStock,
    loadingQr,
    receiptEligibleIds,
    addManyMissing,
  ]);

  const handleToggleReceiptItem = (id: string, elegible: boolean, checked: boolean) => {
    if (!elegible) return;
    if (checked) addManyMissing([id]);
    else remove(id);
  };

  const handleSelectAllReceiptEligible = () => {
    addManyMissing(receiptEligibleIds);
    showSnackbar(
      `Seleccionadas ${receiptEligibleIds.length} línea${receiptEligibleIds.length === 1 ? "" : "s"} con PVP`,
    );
  };

  const handleClearReceiptSelection = () => {
    removeMany(receiptEligibleIds);
  };

  const allEligibleIds = useMemo(() => [...eligibleIds], [eligibleIds]);

  const handleAddAllEligible = () => {
    if (allEligibleIds.length === 0) {
      showSnackbar(
        "No hay líneas elegibles para QR (necesitan PVP y estado vendible).",
        "warning",
      );
      return;
    }
    const before = queuedIds.size;
    addManyMissing(allEligibleIds);
    const added = allEligibleIds.filter((id) => !queuedIds.has(id)).length;
    const already = allEligibleIds.length - added;
    showSnackbar(
      already > 0 && before > 0
        ? `Cola: ${allEligibleIds.length} elegibles (${added} nuevas, ${already} ya estaban).`
        : `Añadidas ${allEligibleIds.length} línea${allEligibleIds.length === 1 ? "" : "s"} elegibles a la cola.`,
    );
  };

  const resolveQueueRows = () => {
    const { rows, omittedCount } = expandQueueToExportRows(
      queue,
      exportByStockId,
    );
    return { rows, omittedCount };
  };

  const handleImprimirTodoStock = async (mode: "a4" | "thermal") => {
    if (qrExportRows.length === 0) {
      showSnackbar(
        "No hay líneas con PVP en stock vendible para imprimir QR.",
        "error",
      );
      return;
    }
    const ok = window.confirm(
      `¿Imprimir todo el stock elegible?\n\n` +
        `• ${qrExportRows.length} etiqueta${qrExportRows.length === 1 ? "" : "s"} QR\n` +
        `• Formato: ${mode === "thermal" ? "térmica 50×25 mm" : "hoja A4 5×12"}\n\n` +
        `Solo incluye líneas con PVP y estado imprimible (disponible / Colombia / reserva).`,
    );
    if (!ok) return;

    try {
      setImprimiendo(mode === "thermal" ? "all-thermal" : "all-a4");
      const subtitle = `Todo el stock con PVP · ${qrExportRows.length} etiqueta${qrExportRows.length === 1 ? "" : "s"} · ${
        mode === "thermal" ? "térmica 50×25 mm" : "hoja A4 5×12"
      }`;
      if (mode === "thermal") {
        await openStockQrLabelsThermalPrintWindow(qrExportRows, { subtitle });
      } else {
        await openStockQrLabelsPrintWindow(qrExportRows, { subtitle });
      }
      showSnackbar(
        `Generadas ${qrExportRows.length} etiqueta${qrExportRows.length === 1 ? "" : "s"} de todo el stock.`,
      );
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "No se pudieron generar las etiquetas QR.";
      showSnackbar(msg, "error");
    } finally {
      setImprimiendo(null);
    }
  };

  const handleImprimir = async (mode: "a4" | "thermal") => {
    if (totalLabels === 0) return;
    try {
      setImprimiendo(mode);
      const { rows, omittedCount } = resolveQueueRows();

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

      if (mode === "thermal") {
        await openStockQrLabelsThermalPrintWindow(rows, {
          subtitle: `Cola manual · ${rows.length} etiqueta${rows.length === 1 ? "" : "s"} · térmica 50×25 mm`,
        });
      } else {
        await openStockQrLabelsPrintWindow(rows, {
          subtitle: `Cola manual · ${rows.length} etiqueta${rows.length === 1 ? "" : "s"} · hoja A4 5×12`,
        });
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "No se pudieron generar las etiquetas QR.";
      showSnackbar(msg, "error");
    } finally {
      setImprimiendo(null);
    }
  };

  const handleExportOpenLabel = () => {
    if (totalLabels === 0) return;
    try {
      setImprimiendo("openlabel");
      const { rows, omittedCount } = resolveQueueRows();

      if (rows.length === 0) {
        showSnackbar(
          "Ninguna línea de la cola es elegible para QR. Revisa PVP y estado.",
          "error",
        );
        return;
      }

      if (omittedCount > 0) {
        showSnackbar(
          `Se omitieron ${omittedCount} etiqueta${omittedCount === 1 ? "" : "s"} no elegibles; se exportan ${rows.length}.`,
          "warning",
        );
      }

      downloadOpenLabelQrLabelsCsv(rows);
      showSnackbar(
        `CSV OpenLabel+ descargado · ${rows.length} etiqueta${rows.length === 1 ? "" : "s"}`,
      );
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "No se pudo exportar el CSV para OpenLabel+.";
      showSnackbar(msg, "error");
    } finally {
      setImprimiendo(null);
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

      <section className="bg-white border border-gray-200 rounded-lg p-4 md:p-5 mb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg md:text-xl font-semibold text-gray-800">
              Todo el stock
            </h2>
            <p className="text-sm text-gray-600 mt-0.5">
              {loading
                ? "Cargando elegibles…"
                : `${qrExportRows.length} línea${qrExportRows.length === 1 ? "" : "s"} elegible${qrExportRows.length === 1 ? "" : "s"} (con PVP).`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="contained"
              disabled={loading || qrExportRows.length === 0 || imprimiendo !== null}
              onClick={() => void handleImprimirTodoStock("a4")}
            >
              {imprimiendo === "all-a4" ? "Generando…" : "Imprimir todo (A4)"}
            </Button>
            <Button
              variant="outlined"
              disabled={loading || qrExportRows.length === 0 || imprimiendo !== null}
              onClick={() => void handleImprimirTodoStock("thermal")}
            >
              {imprimiendo === "all-thermal"
                ? "Generando…"
                : "Imprimir todo (térmica)"}
            </Button>
            <Button
              variant="outlined"
              color="inherit"
              disabled={
                loading ||
                allEligibleIds.length === 0 ||
                (allEligibleIds.length > 0 &&
                  allEligibleIds.every((id) => queuedIds.has(id)))
              }
              onClick={handleAddAllEligible}
            >
              Añadir todo a la cola
            </Button>
          </div>
        </div>
      </section>

      {receiptItems.length > 0 && (
        <section className="bg-white border border-gray-200 rounded-lg p-4 md:p-5 mb-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <div>
              <h2 className="text-lg md:text-xl font-semibold text-gray-800">
                De esta recepción ({receiptItems.length})
              </h2>
              <p className="text-sm text-gray-600 mt-0.5">
                Seleccionadas {receiptSelectedCount} de {receiptEligibleIds.length}{" "}
                elegibles (con PVP en export QR). Sin PVP no se pueden seleccionar.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="small"
                variant="outlined"
                disabled={
                  loading ||
                  receiptEligibleIds.length === 0 ||
                  receiptSelectedCount === receiptEligibleIds.length
                }
                onClick={handleSelectAllReceiptEligible}
              >
                Todas elegibles
              </Button>
              <Button
                size="small"
                variant="text"
                disabled={receiptSelectedCount === 0}
                onClick={handleClearReceiptSelection}
              >
                Quitar selección
              </Button>
            </div>
          </div>
          {loading ? (
            <p className="text-gray-500 text-sm">Cargando líneas de recepción…</p>
          ) : (
            <ul className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {receiptItems.map(({ id, item, elegible, exportRow, blockReason }) => {
                const selected = elegible && queuedIds.has(id);
                return (
                  <li
                    key={id}
                    className={`flex items-center gap-3 md:gap-4 p-2.5 md:p-3 rounded-lg border ${
                      selected
                        ? "border-blue-300 bg-blue-50"
                        : elegible
                          ? "border-gray-200 bg-gray-50"
                          : "border-gray-100 bg-gray-100 opacity-80"
                    }`}
                  >
                    <Checkbox
                      size="small"
                      checked={selected}
                      disabled={!elegible}
                      onChange={(_, checked) =>
                        handleToggleReceiptItem(id, elegible, checked)
                      }
                      inputProps={{
                        "aria-label": elegible
                          ? `Seleccionar ${item?.card_name ?? id}`
                          : `${blockReason ?? "No elegible"} — no seleccionable`,
                      }}
                    />
                    {item &&
                    resolveStockImageUrl(item.card_id, item.image_url) ? (
                      <img
                        src={resolveStockImageUrl(item.card_id, item.image_url)}
                        alt=""
                        className="w-12 h-16 object-contain rounded-md bg-white border border-gray-200 flex-shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-16 bg-gray-200 rounded-md flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm md:text-base text-gray-900 truncate">
                        {item?.card_name ?? exportRow?.card_name ?? id}
                      </p>
                      {exportRow ? (
                        <p className="text-sm font-bold text-blue-800">
                          COP {formatCOP(exportRow.price_cop)}
                        </p>
                      ) : (
                        <p className="text-xs text-gray-500">
                          {blockReason ?? "No elegible QR"}
                        </p>
                      )}
                    </div>
                    <span
                      className={`inline-block text-xs px-2 py-0.5 rounded flex-shrink-0 ${
                        elegible
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-200 text-gray-600"
                      }`}
                    >
                      {elegible ? "Elegible" : blockReason ?? "No elegible"}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

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
                const stockKey = String(item._id ?? "").trim().toLowerCase();
                const elegible = eligibleIds.has(stockKey);
                const exportRow = exportByStockId.get(stockKey);
                const rz = rarezaLabel(item);
                const inQueue = queue.some((e) => e.stockId === stockKey);

                return (
                  <li
                    key={stockKey}
                    className="flex items-center gap-3 md:gap-4 p-3 md:p-4 rounded-lg border border-gray-200 bg-gray-50"
                  >
                    {resolveStockImageUrl(item.card_id, item.image_url) ? (
                      <img
                        src={resolveStockImageUrl(item.card_id, item.image_url)}
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
                        {isQuantityProduct({
                          product_kind: item.product_kind,
                          card_id: item.card_id,
                        })
                          ? ` · Stock: ${typeof item.quantity === "number" ? item.quantity : 0}`
                          : ""}
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
                          {elegible
                            ? "Elegible para QR"
                            : qrBlockReason(item, false)}
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
                        value={getAddQty(stockKey)}
                        onChange={(e) => {
                          const v = parseInt(e.target.value, 10);
                          setAddQtyById((prev) => ({
                            ...prev,
                            [stockKey]: Number.isFinite(v) ? v : 1,
                          }));
                        }}
                        inputProps={{ min: 1, style: { width: 64 } }}
                        disabled={!elegible}
                      />
                      <Tooltip
                        title={
                          elegible
                            ? "Añadir a la cola"
                            : qrBlockReason(item, false)
                        }
                      >
                        <span>
                          <Button
                            variant="contained"
                            disabled={!elegible}
                            onClick={() => handleAdd(stockKey)}
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
                const stockKey = String(entry.stockId ?? "")
                  .trim()
                  .toLowerCase();
                const item = stockById.get(stockKey);
                const exportRow = exportByStockId.get(stockKey);
                const elegible = eligibleIds.has(stockKey);
                const imageUrl = item?.image_url;

                return (
                  <li
                    key={stockKey || entry.stockId}
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
                            stockKey || entry.stockId,
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
              disabled={totalLabels === 0 || imprimiendo !== null}
              onClick={() => void handleImprimir("a4")}
            >
              {imprimiendo === "a4" ? "Generando…" : "Imprimir cola"}
            </Button>
            <Button
              variant="outlined"
              size="large"
              disabled={totalLabels === 0 || imprimiendo !== null}
              onClick={() => void handleImprimir("thermal")}
            >
              {imprimiendo === "thermal"
                ? "Generando…"
                : "Imprimir térmica (50×25)"}
            </Button>
            <Button
              variant="outlined"
              size="large"
              disabled={totalLabels === 0 || imprimiendo !== null}
              onClick={handleExportOpenLabel}
            >
              {imprimiendo === "openlabel"
                ? "Exportando…"
                : "Exportar CSV OpenLabel+"}
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
