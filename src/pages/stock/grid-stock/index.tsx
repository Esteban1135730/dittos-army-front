import { useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { DataGrid, type GridColDef } from "@mui/x-data-grid";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Snackbar,
} from "@mui/material";

import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { exportToPDF, exportCatalogToPDF } from "../../../utils/pdf";
import { useExchangeRates } from "../../../utils/tasa";
import { formatCOP } from "../../../utils/convert";
import type { StockListItem, UpdateStockRequestBody } from "../../../types/stock";
import { operationalRarezaLabel } from "../../../constants/item-rareza";
import {
  STOCK_TAG_LABEL,
  STOCK_TAG_VALUES,
  type StockTagId,
} from "../../../constants/stock-tags";
import { PvpInlineCell } from "./pvp-inline-cell";
import { API_BASE, apiUrl } from "../../../config/api";
import {
  filterQrExportRowsByStockIds,
  openStockQrLabelsPrintWindow,
  type StockQrExportRow,
} from "../../../modules/stock-barcode";
import { filterStockVisibleInGrid } from "../../../utils/stock-grid-visible";

export type StockItem = StockListItem;

function rarezaFromListRow(item: StockListItem): string | null {
  let rz =
    item.rareza != null && String(item.rareza).trim() !== ""
      ? String(item.rareza).trim()
      : "";
  if (rz === "" && item.holofoil) rz = "holofoil";
  if (rz === "" && item.league_card) rz = "league card";
  return rz === "" ? null : rz;
}

function listRowToUpdateBody(
  item: StockListItem,
  tags: string[]
): UpdateStockRequestBody {
  const rz = rarezaFromListRow(item);
  const body: UpdateStockRequestBody = {
    id: item._id,
    card_id: item.card_id,
    card_name: item.card_name ?? "",
    image_url: item.image_url ?? "",
    currency: item.currency,
    shipment: item.shipment,
    unity_cost: item.unity_cost,
    cards_in_shipmet: item.cards_in_shipmet,
    card_state: item.card_state,
    language: item.language ?? "",
    holofoil: rz === "holofoil",
    league_card: rz === "league card",
    rareza: rz,
    tags: STOCK_TAG_VALUES.filter((t) => tags.includes(t)),
  };
  if (item.incoming_notes != null && item.incoming_notes !== "") {
    body.incoming_notes = item.incoming_notes;
  }
  return body;
}

type ExchangeConvert = ReturnType<typeof useExchangeRates>["convert"];

function pvpCopFromRow(
  item: StockListItem,
  convert: ExchangeConvert
): number | null {
  if (stockHasBulkTag(item)) return null;
  if (!item.pvp || item.pvp <= 0) return null;

  if (item.pvp_currency === "COP") return item.pvp;
  if (item.pvp_currency === "EUR") return convert.toCopFromEur(item.pvp) ?? 0;
  if (item.pvp_currency === "USD") return convert.toCopFromUsd(item.pvp) ?? 0;
  return 0;
}

function gananciaCopFromRow(
  item: StockListItem,
  convert: ExchangeConvert
): number | null {
  if (stockHasBulkTag(item)) return null;
  const pvpCOP = pvpCopFromRow(item, convert);
  if (pvpCOP == null) return null;

  let costoCOP = 0;
  if (item.currency === "COP") {
    costoCOP = item.card_cost;
  } else if (item.currency === "EUR") {
    costoCOP = convert.toCopFromEur(item.card_cost) ?? 0;
  } else if (item.currency === "USD") {
    costoCOP = convert.toCopFromUsd(item.card_cost) ?? 0;
  }

  return pvpCOP - costoCOP;
}

function gananciaSortValue(
  item: StockListItem,
  convert: ExchangeConvert
): number {
  return gananciaCopFromRow(item, convert) ?? Number.NEGATIVE_INFINITY;
}

function stockHasBulkTag(item: StockListItem): boolean {
  const tags = Array.isArray(item.tags) ? item.tags : [];
  return tags.includes("bulk");
}

function stockIncluidoEnCalculos(item: StockListItem): boolean {
  return !stockHasBulkTag(item);
}

export default function StockGrid() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [busqueda, setBusqueda] = useState("");
  /** Tags seleccionados en el filtro: la fila debe incluir todos (AND). */
  const [filtroTags, setFiltroTags] = useState<StockTagId[]>([]);
  /** Solo líneas sin ningún tag; incompatible con `filtroTags` (se limpia al elegir tags). */
  const [filtroSinTags, setFiltroSinTags] = useState(false);
  const [marcandoPropiedad, setMarcandoPropiedad] = useState<string | null>(
    null
  );
  const [errorPropiedad, setErrorPropiedad] = useState("");
  const [mostrarModalVenta, setMostrarModalVenta] = useState(false);
  const [ventaStockId, setVentaStockId] = useState<string | null>(null);
  const [ventaCardId, setVentaCardId] = useState<string | null>(null);
  const [precioVenta, setPrecioVenta] = useState<number | "">("");
  const [vendiendo, setVendiendo] = useState(false);
  const [errorVenta, setErrorVenta] = useState("");
  /** Fila en la que se está guardando un cambio de tags (evita doble envío). */
  const [tagSavingRowId, setTagSavingRowId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StockItem | null>(null);
  const [deleteDeleting, setDeleteDeleting] = useState(false);
  const [deleteDialogError, setDeleteDialogError] = useState("");
  const [pvpSavingRowId, setPvpSavingRowId] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "error";
  }>({ open: false, message: "", severity: "success" });

  const toast = (message: string, severity: "success" | "error") =>
    setSnackbar({ open: true, message, severity });

  const {
    data: stock = [],
    isLoading,
    error,
  } = useQuery<StockItem[]>({
    queryKey: ["stock"],
    queryFn: async () => {
      const res = await axios.get(apiUrl("/stock"));
      return Array.isArray(res.data)
        ? filterStockVisibleInGrid(res.data)
        : [];
    },
  });

  const { convert } = useExchangeRates();

  const stockParaCalculos = useMemo(
    () => stock.filter(stockIncluidoEnCalculos),
    [stock]
  );

  // Calcular precio del inventario en COP/EUR/USD
  const precioInventario = useMemo(() => {
    let totalCOP = 0;

    stockParaCalculos.forEach((item) => {
      if (item.currency === "COP") {
        totalCOP += item.card_cost;
      } else if (item.currency === "EUR") {
        totalCOP += convert.toCopFromEur(item.card_cost) ?? 0;
      } else if (item.currency === "USD") {
        totalCOP += convert.toCopFromUsd(item.card_cost) ?? 0;
      }
    });

    return {
      cop: totalCOP,
      eur: convert.toEurFromCop(totalCOP) ?? 0,
      usd: convert.toUsdFromCop(totalCOP) ?? 0,
    };
  }, [stockParaCalculos, convert]);

  const ventasEsperadas = useMemo(() => {
    let totalCOP = 0;

    stockParaCalculos.forEach((item) => {
      const pvpCOP = pvpCopFromRow(item, convert);
      if (pvpCOP != null) totalCOP += pvpCOP;
    });

    return {
      cop: totalCOP,
      eur: convert.toEurFromCop(totalCOP) ?? 0,
      usd: convert.toUsdFromCop(totalCOP) ?? 0,
    };
  }, [stockParaCalculos, convert]);

  // Calcular ganancia esperada en COP/EUR/USD
  const gananciaEsperada = useMemo(() => {
    let totalGananciaCOP = 0;

    stockParaCalculos.forEach((item) => {
      const ganancia = gananciaCopFromRow(item, convert);
      if (ganancia != null) totalGananciaCOP += ganancia;
    });

    return {
      cop: totalGananciaCOP,
      eur: convert.toEurFromCop(totalGananciaCOP) ?? 0,
      usd: convert.toUsdFromCop(totalGananciaCOP) ?? 0,
    };
  }, [stockParaCalculos, convert]);

  // Ordenar stock: primero los sin PVP, luego los con PVP
  const stockOrdenado = useMemo(() => {
    return [...stock].sort((a, b) => {
      const aTienePvp = a.pvp && a.pvp > 0;
      const bTienePvp = b.pvp && b.pvp > 0;

      if (!aTienePvp && bTienePvp) return -1; // a sin PVP va primero
      if (aTienePvp && !bTienePvp) return 1;  // b sin PVP va primero
      return 0; // mantener orden original si ambos tienen o no tienen PVP
    });
  }, [stock]);

  const toggleFiltroTag = (tag: StockTagId) => {
    setFiltroSinTags(false);
    setFiltroTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const toggleFiltroSinTags = () => {
    if (filtroSinTags) {
      setFiltroSinTags(false);
    } else {
      setFiltroTags([]);
      setFiltroSinTags(true);
    }
  };

  // Filtrar stock por búsqueda y por tags (AND entre tags seleccionados, o solo sin tags)
  const stockFiltrado = useMemo(() => {
    let rows = stockOrdenado;
    if (busqueda.trim()) {
      const terminoBusqueda = busqueda.toLowerCase().trim();
      rows = rows.filter((item) =>
        (item.card_name ?? "").toLowerCase().includes(terminoBusqueda)
      );
    }
    if (filtroSinTags) {
      rows = rows.filter((item) => {
        const rowTags = Array.isArray(item.tags) ? item.tags : [];
        return rowTags.length === 0;
      });
    } else if (filtroTags.length > 0) {
      rows = rows.filter((item) => {
        const rowTags = Array.isArray(item.tags) ? item.tags : [];
        return filtroTags.every((t) => rowTags.includes(t));
      });
    }
    return rows;
  }, [stockOrdenado, busqueda, filtroTags, filtroSinTags]);

  // Contar cartas únicas sin PVP (agrupadas por card_id)
  const cartasSinPvp = useMemo(() => {
    const cartasUnicas = new Map<string, boolean>();
    stockParaCalculos.forEach((item) => {
      if (!cartasUnicas.has(item.card_id)) {
        const tienePvp = !!(item.pvp && item.pvp > 0);
        cartasUnicas.set(item.card_id, tienePvp);
      }
    });
    return Array.from(cartasUnicas.values()).filter((tienePvp) => !tienePvp).length;
  }, [stockParaCalculos]);

  const handleModificar = (id: string) => {
    navigate(`/stock/update/${id}`);
  };

  const handleMarcarPropiedad = async (stockId: string, cardId: string) => {
    const confirmar = window.confirm(
      "¿Marcar esta carta como propiedad?"
    );
    if (!confirmar) return;

    try {
      setMarcandoPropiedad(stockId);
      setErrorPropiedad("");
      await axios.post(apiUrl("/sales/keep"), {
        stock_id: stockId,
        card_id: cardId,
      });
      await queryClient.invalidateQueries({ queryKey: ["stock"] });
    } catch (error) {
      setErrorPropiedad("No fue posible marcar la carta como propiedad.");
    } finally {
      setMarcandoPropiedad(null);
    }
  };

  const handleAbrirModalVenta = (stockId: string, cardId: string, pvp?: number, pvpCurrency?: string) => {
    setVentaStockId(stockId);
    setVentaCardId(cardId);

    // Si existe PVP, convertirlo a COP y establecerlo como valor por defecto
    if (pvp && pvp > 0 && pvpCurrency) {
      let pvpEnCOP = 0;
      if (pvpCurrency === "COP") {
        pvpEnCOP = pvp;
      } else if (pvpCurrency === "EUR") {
        pvpEnCOP = convert.toCopFromEur(pvp) ?? 0;
      } else if (pvpCurrency === "USD") {
        pvpEnCOP = convert.toCopFromUsd(pvp) ?? 0;
      }
      setPrecioVenta(pvpEnCOP > 0 ? pvpEnCOP : "");
    } else {
      setPrecioVenta("");
    }

    setErrorVenta("");
    setMostrarModalVenta(true);
  };

  const handleCerrarModalVenta = () => {
    setMostrarModalVenta(false);
    setVentaStockId(null);
    setVentaCardId(null);
    setPrecioVenta("");
    setErrorVenta("");
  };

  const handleToggleRowTag = async (row: StockItem, tag: StockTagId) => {
    if (tagSavingRowId !== null) return;
    const rowTags = Array.isArray(row.tags) ? [...row.tags] : [];
    const set = new Set(rowTags);
    if (set.has(tag)) {
      set.delete(tag);
    } else {
      set.add(tag);
    }
    const nextTags = STOCK_TAG_VALUES.filter((t) => set.has(t));
    setTagSavingRowId(row._id);
    try {
      await axios.post(
        apiUrl("/stock/update"),
        listRowToUpdateBody(row, nextTags)
      );
      await queryClient.invalidateQueries({ queryKey: ["stock"] });
    } catch {
      window.alert("No se pudo actualizar el tag. Revisa la consola o intenta de nuevo.");
    } finally {
      setTagSavingRowId(null);
    }
  };

  const handleOpenDeleteDialog = (row: StockItem) => {
    setDeleteDialogError("");
    setDeleteTarget(row);
  };

  const handleCloseDeleteDialog = () => {
    if (deleteDeleting) return;
    setDeleteTarget(null);
    setDeleteDialogError("");
  };

  const handleConfirmDeleteStock = async () => {
    if (!deleteTarget) return;
    setDeleteDeleting(true);
    setDeleteDialogError("");
    try {
      await axios.delete(
        `${API_BASE}/stock/${encodeURIComponent(deleteTarget._id)}`
      );
      await queryClient.invalidateQueries({ queryKey: ["stock"] });
      setDeleteTarget(null);
    } catch (e: unknown) {
      const ax = e as {
        response?: { data?: { message?: string | string[] } };
      };
      const msg = ax.response?.data?.message;
      const text = Array.isArray(msg) ? msg[0] : msg;
      setDeleteDialogError(
        typeof text === "string"
          ? text
          : "No se pudo eliminar la línea. Intenta más tarde."
      );
    } finally {
      setDeleteDeleting(false);
    }
  };

  const handleVender = async () => {
    if (!ventaStockId || !ventaCardId) {
      setErrorVenta("Error: faltan datos de la carta.");
      return;
    }

    if (precioVenta === "" || precioVenta <= 0) {
      setErrorVenta("Por favor ingresa un precio de venta válido (mayor a 0).");
      return;
    }

    try {
      setVendiendo(true);
      setErrorVenta("");
      await axios.post(apiUrl("/sales/sell"), {
        stock_id: ventaStockId,
        card_id: ventaCardId,
        amount_cop: Number(precioVenta),
        notes: "Venta registrada desde inventario",
      });
      await queryClient.invalidateQueries({ queryKey: ["stock"] });
      handleCerrarModalVenta();
    } catch (error: any) {
      setErrorVenta(
        error?.response?.data?.message ||
        "No fue posible registrar la venta. Intenta más tarde."
      );
    } finally {
      setVendiendo(false);
    }
  };

  const columns: GridColDef[] = [
    {
      field: "image_url",
      headerName: "Imagen",
      renderCell: (params) => (
        <img
          src={params.value}
          alt="carta"
          className="object-contain w-12 h-16"
        />
      ),
      sortable: false,
      filterable: false,
      width: 80,
    },
    {
      field: "card_name",
      headerName: "Nombre",
      width: 300,
      renderCell: (params) => (
        <span>
          {params.row.card_name}
          {(params.row.league_card ||
            params.row.rareza === "league card") && (
            <span className="text-blue-600 font-semibold ml-1">(liga)</span>
          )}
        </span>
      ),
    },
    {
      field: "rareza",
      headerName: "Rareza",
      width: 130,
      renderCell: (params) => {
        const r = params.row.rareza;
        if (r == null || String(r).trim() === "") {
          return <span className="text-gray-400">—</span>;
        }
        return (
          <span className="text-sm text-gray-800">
            {operationalRarezaLabel(String(r).trim())}
          </span>
        );
      },
    },
    {
      field: "tags",
      headerName: "Tags",
      width: 260,
      sortable: false,
      filterable: false,
      renderCell: (params) => {
        const row = params.row as StockItem;
        const tags = Array.isArray(row.tags) ? row.tags : [];
        const busy = tagSavingRowId === row._id;
        return (
          <div
            className="flex flex-wrap items-center gap-x-3 gap-y-1 py-0.5"
            onClick={(e) => e.stopPropagation()}
          >
            {STOCK_TAG_VALUES.map((tagId) => (
              <label
                key={tagId}
                className="inline-flex items-center gap-1 cursor-pointer text-xs text-gray-800 whitespace-nowrap"
                title={STOCK_TAG_LABEL[tagId]}
              >
                <input
                  type="checkbox"
                  checked={tags.includes(tagId)}
                  disabled={busy}
                  onChange={() => void handleToggleRowTag(row, tagId)}
                  className="rounded border-gray-400"
                />
                {STOCK_TAG_LABEL[tagId]}
              </label>
            ))}
          </div>
        );
      },
    },
    {
      field: "card_cost",
      headerName: "Costo de la carta",
      renderCell: (params) => (
        <>
          {params.row.currency == "COP"
            ? "COP " + params.value.toFixed(2)
            : "EURO " +
            params.value.toFixed(2) +
            " - COP " +
            formatCOP(convert.toCopFromEur(params.value)?.toFixed(0))}
        </>
      ),
      width: 200,
    },
    {
      field: "pvp",
      headerName: "PVP",
      sortable: false,
      filterable: false,
      renderCell: (params) => {
        const row = params.row as StockItem;
        return (
          <PvpInlineCell
            row={row}
            busy={pvpSavingRowId === row._id}
            onBusyChange={(saving) =>
              setPvpSavingRowId(saving ? row._id : null)
            }
            onOutcome={toast}
            onSaved={() => queryClient.invalidateQueries({ queryKey: ["stock"] })}
          />
        );
      },
      width: 160,
    },
    {
      field: "ganancia",
      headerName: "Ganancia",
      type: "number",
      valueGetter: (_value, row) =>
        gananciaSortValue(row as StockItem, convert),
      renderCell: (params) => {
        const ganancia = gananciaCopFromRow(params.row as StockItem, convert);
        if (ganancia == null) {
          return <span className="text-gray-400">—</span>;
        }

        const costoCOP =
          params.row.currency === "COP"
            ? params.row.card_cost
            : params.row.currency === "EUR"
              ? convert.toCopFromEur(params.row.card_cost) ?? 0
              : params.row.currency === "USD"
                ? convert.toCopFromUsd(params.row.card_cost) ?? 0
                : 0;
        const porcentaje = costoCOP > 0 ? (ganancia / costoCOP) * 100 : 0;

        const esGanancia = ganancia > 0;
        const esPerdida = ganancia < 0;

        return (
          <div className="flex items-center gap-3">
            <span
              className={`font-semibold ${esGanancia
                  ? "text-green-600"
                  : esPerdida
                    ? "text-red-600"
                    : "text-gray-600"
                }`}
            >
              {esGanancia ? "+" : ""}
              {formatCOP(ganancia.toFixed(0))}
            </span>
            <span
              className={`text-sm font-medium ${esGanancia
                  ? "text-green-600"
                  : esPerdida
                    ? "text-red-600"
                    : "text-gray-600"
                }`}
            >
              ({esGanancia ? "+" : ""}
              {porcentaje.toFixed(1)}%)
            </span>
          </div>
        );
      },
      width: 200,
    },
    { field: "card_id", headerName: "Carta", width: 150 },
    {
      field: "card_state",
      headerName: "Estado Venta",
      renderCell: (params) => {
        if (params.row.card_state === "propiedad") {
          return (
            <span className="text-rose-600 font-semibold">En propiedad</span>
          );
        }
        if (params.row.card_state === "vendida") {
          return <span className="text-gray-500 font-medium">Vendida</span>;
        }
        if (params.row.card_state === "reserva") {
          return <span className="text-yellow-600 font-medium">Reservada</span>;
        }
        return <span className="text-green-600 font-medium">Disponible</span>;
      },
      width: 160,
    },
    {
      field: "modificar",
      headerName: "Modificar",
      sortable: false,
      filterable: false,
      width: 120,
      renderCell: (params) => (
        <button
          onClick={() => handleModificar(params.row._id)}
          className="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1 rounded"
        >
          Modificar
        </button>
      ),
    },
    {
      field: "asignarPVP",
      headerName: "Asignar/Modificar PVP",
      sortable: false,
      filterable: false,
      width: 160,
      renderCell: (params) => {
        const tienePvp = params.row.pvp && params.row.pvp > 0;
        return (
          <Link
            to={`/add-pvp/${params.row.card_id}`}
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded inline-block no-underline"
          >
            {tienePvp ? "Modificar PVP" : "Asignar PVP"}
          </Link>
        );
      },
    },
    {
      field: "propiedad",
      headerName: "Quedarme",
      sortable: false,
      filterable: false,
      width: 150,
      renderCell: (params) => (
        <button
          onClick={() =>
            handleMarcarPropiedad(params.row._id, params.row.card_id)
          }
          disabled={
            params.row.card_state === "propiedad" ||
            marcandoPropiedad === params.row._id
          }
          className={`px-3 py-1 rounded ${params.row.card_state === "propiedad"
              ? "bg-gray-300 text-gray-600 cursor-not-allowed"
              : "bg-rose-600 text-white hover:bg-rose-700"
            }`}
        >
          {marcandoPropiedad === params.row._id ? "Marcando..." : "Propiedad"}
        </button>
      ),
    },
    {
      field: "vendido",
      headerName: "Vendido",
      sortable: false,
      filterable: false,
      width: 120,
      renderCell: (params) => (
        <button
          onClick={() =>
            handleAbrirModalVenta(
              params.row._id,
              params.row.card_id,
              params.row.pvp,
              params.row.pvp_currency
            )
          }
          disabled={
            params.row.card_state === "vendida" ||
            params.row.card_state === "propiedad"
          }
          className={`px-3 py-1 rounded ${params.row.card_state === "vendida" ||
              params.row.card_state === "propiedad"
              ? "bg-gray-300 text-gray-600 cursor-not-allowed"
              : "bg-green-600 text-white hover:bg-green-700"
            }`}
        >
          Vendido
        </button>
      ),
    },
    {
      field: "eliminar",
      headerName: "Eliminar",
      sortable: false,
      filterable: false,
      width: 110,
      renderCell: (params) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleOpenDeleteDialog(params.row as StockItem);
          }}
          className="bg-red-700 hover:bg-red-800 text-white px-3 py-1 rounded text-sm"
        >
          Eliminar
        </button>
      ),
    },
  ];

  const [exportando, setExportando] = useState(false);
  const [exportandoBarcode, setExportandoBarcode] = useState(false);
  const [imprimiendo, setImprimiendo] = useState(false);
  const [limpiandoPvp, setLimpiandoPvp] = useState(false);
  const [actualizandoTienda, setActualizandoTienda] = useState(false);

  const handleLimpiarTodosPvp = async () => {
    const confirmar = window.confirm(
      "¿Eliminar todos los PVP asignados? Las cartas quedarán sin precio de venta. Esta acción no se puede deshacer."
    );
    if (!confirmar) return;

    try {
      setLimpiandoPvp(true);
      const res = await axios.delete(apiUrl("/pvp"));
      const deleted = res.data?.deletedCount ?? 0;
      await queryClient.invalidateQueries({ queryKey: ["stock"] });
      if (deleted > 0) {
        window.alert(`Se eliminaron ${deleted} PVP correctamente.`);
      }
    } catch (err) {
      window.alert("No se pudieron eliminar los PVP. Intenta más tarde.");
    } finally {
      setLimpiandoPvp(false);
    }
  };

  const handleExportar = () => {
    setExportando(true);
    exportToPDF(
      stock.filter((stockItem: StockItem) => stockItem.card_state == "en_stock_colombia"),
      convert.toCopFromEur,
      () => setExportando(false)
    );
  };

  const hayFiltrosVisibles =
    busqueda.trim().length > 0 || filtroTags.length > 0 || filtroSinTags;

  const handleExportarQr = async () => {
    try {
      setExportandoBarcode(true);
      const res = await axios.get<StockQrExportRow[]>(
        apiUrl("/stock/qr-export"),
      );
      const apiRows = Array.isArray(res.data) ? res.data : [];
      const visibleIds = stockFiltrado.map((item) => item._id);
      const rows = filterQrExportRowsByStockIds(apiRows, visibleIds);

      if (rows.length === 0) {
        window.alert(
          hayFiltrosVisibles
            ? `Ninguna de las ${stockFiltrado.length} líneas visibles tiene PVP en stock vendible para QR. Quita filtros o asigna PVP.`
            : "No hay líneas con PVP en stock vendible para exportar QR.",
        );
        return;
      }

      const subtitleParts = [
        `${rows.length} etiquetas`,
        hayFiltrosVisibles
          ? `filtro activo (${stockFiltrado.length} visibles en grilla)`
          : "todo el stock con PVP",
        "hoja A4 5×12",
      ];

      await openStockQrLabelsPrintWindow(rows, {
        subtitle: subtitleParts.join(" · "),
      });
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "No se pudieron generar las etiquetas QR.";
      window.alert(msg);
    } finally {
      setExportandoBarcode(false);
    }
  };

  const handleImprimirCatalogo = () => {
    setImprimiendo(true);
    exportCatalogToPDF(
      stock.filter((stockItem) => stockItem.card_state != "vendida"),
      convert.toCopFromEur,
      convert.toEurFromCop,
      () => setImprimiendo(false)
    );
  };

  const handleActualizarInformacionTienda = async () => {
    try {
      setActualizandoTienda(true);
      const { data } = await axios.post(apiUrl("/stock/publish-store-catalog"));
      const inv = data?.inventory;
      const up = data?.upcoming;
      const publish = data?.publish;
      const invOk = inv?.success === true;
      const upOk = up?.success === true;

      if (!invOk || !upOk) {
        const parts: string[] = [];
        if (!invOk) parts.push("Inventario: " + (inv?.error || "error"));
        if (!upOk) parts.push("Próximamente: " + (up?.error || "error"));
        window.alert("Error al actualizar la tienda. " + parts.join(" "));
        return;
      }

      const base = `Catálogo generado: ${inv.count ?? 0} cartas, ${up.count ?? 0} en Próximamente.`;
      if (!publish?.enabled) {
        window.alert(
          `${base}\nPublicación git desactivada (STORE_AUTO_PUBLISH=false).`
        );
        return;
      }
      if (publish.pushed) {
        window.alert(
          `${base}\nPublicado en git (${publish.branch}). Firebase desplegará la tienda en unos minutos.`
        );
        return;
      }
      if (publish.skippedReason) {
        window.alert(`${base}\n${publish.skippedReason}`);
        return;
      }
      window.alert(
        `${base}\nNo se pudo publicar en git: ${publish.error || data?.error || "error desconocido"}`
      );
    } catch (err: unknown) {
      const msg = err && typeof err === "object" && "response" in err
        ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
        : null;
      window.alert("No se pudo actualizar la información de la tienda. " + (msg || "Intenta más tarde."));
    } finally {
      setActualizandoTienda(false);
    }
  };

  if (isLoading)
    return <p className="text-center text-gray-500">Cargando stock...</p>;

  if (error)
    return (
      <p className="text-center text-red-500">
        ❌ Error al cargar el stock. Intenta más tarde.
      </p>
    );

  return (

    <div className="w-full min-w-0">
      {cartasSinPvp > 0 && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 rounded">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-red-500"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium">
                Tienes {cartasSinPvp} {cartasSinPvp === 1 ? "carta sin asignar" : "cartas sin asignar"} un valor de mercado (PVP)
              </p>
            </div>
          </div>
        </div>
      )}
      <div className="mb-4">
        <div className="flex flex-wrap items-center gap-4 mb-3">
          <div className="flex-1 min-w-[220px]">
            <div className="relative">
              <input
                type="text"
                placeholder="Buscar por nombre de carta..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <svg
                className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              {busqueda && (
                <button
                  type="button"
                  onClick={() => setBusqueda("")}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              )}
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <div className="relative">
              <button
                onClick={handleExportar}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                Exportar PDF
              </button>

              {exportando && (
                <div className="absolute top-0 right-0 mt-2 mr-2 text-sm text-gray-700 bg-white px-3 py-2 border rounded shadow">
                  Generando PDF...
                </div>
              )}
            </div>
            <div className="relative">
              <button
                type="button"
                onClick={() => void handleExportarQr()}
                disabled={exportandoBarcode}
                className="bg-violet-600 text-white px-4 py-2 rounded hover:bg-violet-700 disabled:opacity-60"
              >
                {exportandoBarcode ? "Generando…" : "Exportar QR"}
              </button>
            </div>
            <div className="relative">
              <button
                onClick={handleImprimirCatalogo}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
              >
                Imprimir Catálogo
              </button>

              {imprimiendo && (
                <div className="absolute top-0 right-0 mt-2 mr-2 text-sm text-gray-700 bg-white px-3 py-2 border rounded shadow">
                  Generando catálogo...
                </div>
              )}
            </div>
            <button
              onClick={handleLimpiarTodosPvp}
              disabled={limpiandoPvp}
              className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {limpiandoPvp ? "Limpiando..." : "Limpiar todos los PVP"}
            </button>
            <button
              type="button"
              title="Genera inventory.json y upcoming.json en dittos-army-store/public y hace push a main (despliegue Firebase)"
              onClick={handleActualizarInformacionTienda}
              disabled={actualizandoTienda}
              className="bg-amber-600 text-white px-4 py-2 rounded hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {actualizandoTienda ? "Actualizando..." : "Actualizar tienda (catálogo + Próximamente)"}
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 mb-4 text-sm text-gray-700">
          <span className="font-medium shrink-0">
            Filtrar por tags (varias = deben tenerlas todas; “Sin tags” solo líneas vacías):
          </span>
          {STOCK_TAG_VALUES.map((tag) => {
            const active = filtroTags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() => toggleFiltroTag(tag)}
                className={`px-3 py-1 rounded-full border transition ${
                  active
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white border-gray-300 hover:border-gray-400"
                }`}
              >
                {STOCK_TAG_LABEL[tag]}
              </button>
            );
          })}
          <button
            type="button"
            onClick={toggleFiltroSinTags}
            className={`px-3 py-1 rounded-full border border-dashed transition ${
              filtroSinTags
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white border-gray-400 hover:border-gray-500"
            }`}
          >
            Sin tags
          </button>
          {(filtroTags.length > 0 || filtroSinTags) && (
            <button
              type="button"
              onClick={() => {
                setFiltroTags([]);
                setFiltroSinTags(false);
              }}
              className="text-blue-600 hover:underline ml-1"
            >
              Quitar filtros de tags
            </button>
          )}
        </div>
        <div className="flex flex-col gap-4 mt-4">
            <div className="bg-white p-4 rounded-lg shadow-md border border-gray-200">
              <h3 className="text-lg font-semibold mb-3 text-gray-700">
                Estadísticas del Inventario
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-gray-600 mb-2">Precio del Inventario</p>
                  <div className="flex flex-col gap-1">
                    <span className="font-bold text-blue-600 text-lg">
                      COP {formatCOP(precioInventario.cop.toFixed(0))}
                    </span>
                    <span className="text-sm text-gray-500">
                      EUR {precioInventario.eur.toFixed(2)} / USD {precioInventario.usd.toFixed(2)}
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-2">Ventas Esperadas</p>
                  <div className="flex flex-col gap-1">
                    <span className="font-bold text-indigo-600 text-lg">
                      COP {formatCOP(ventasEsperadas.cop.toFixed(0))}
                    </span>
                    <span className="text-sm text-gray-500">
                      EUR {ventasEsperadas.eur.toFixed(2)} / USD {ventasEsperadas.usd.toFixed(2)}
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-2">Ganancia Esperada</p>
                  <div className="flex flex-col gap-1">
                    <span
                      className={`font-bold text-lg ${gananciaEsperada.cop > 0
                          ? "text-green-600"
                          : gananciaEsperada.cop < 0
                            ? "text-red-600"
                            : "text-gray-600"
                        }`}
                    >
                      {gananciaEsperada.cop > 0 ? "+" : ""}
                      COP {formatCOP(gananciaEsperada.cop.toFixed(0))}
                    </span>
                    <span className="text-sm text-gray-500">
                      {gananciaEsperada.eur > 0 ? "+" : ""}
                      EUR {gananciaEsperada.eur.toFixed(2)} /{" "}
                      {gananciaEsperada.usd > 0 ? "+" : ""}
                      USD {gananciaEsperada.usd.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            {busqueda && (
              <p className="text-sm text-gray-600 text-center md:text-left">
                Mostrando {stockFiltrado.length}{" "}
                {stockFiltrado.length === 1 ? "resultado" : "resultados"} de{" "}
                {stock.length} cartas
              </p>
            )}
          </div>
          {errorPropiedad && (
            <p className="text-sm text-red-600 text-center mt-2">
              {errorPropiedad}
            </p>
          )}
        </div>

        <Dialog
          open={deleteTarget !== null}
          onClose={handleCloseDeleteDialog}
          aria-labelledby="delete-stock-title"
        >
          <DialogTitle id="delete-stock-title">Eliminar línea de stock</DialogTitle>
          <DialogContent>
            <DialogContentText component="div">
              {deleteTarget && (
                <>
                  <p className="mb-2">
                    Vas a eliminar de forma permanente esta carta del inventario:
                  </p>
                  <p className="font-medium text-gray-900">
                    {deleteTarget.card_name ?? deleteTarget.card_id}
                  </p>
                  <p className="mt-3 text-sm text-gray-600">
                    No podrás deshacer esta acción. Si la línea tiene reserva o venta
                    registrada, el sistema rechazará el borrado.
                  </p>
                </>
              )}
              {deleteDialogError ? (
                <p className="mt-3 text-sm text-red-600">{deleteDialogError}</p>
              ) : null}
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDeleteDialog} disabled={deleteDeleting}>
              Cancelar
            </Button>
            <Button
              color="error"
              variant="contained"
              onClick={() => void handleConfirmDeleteStock()}
              disabled={deleteDeleting || !deleteTarget}
            >
              {deleteDeleting ? "Eliminando…" : "Eliminar"}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Modal de Venta */}
        {mostrarModalVenta && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
              <h2 className="text-2xl font-bold mb-4 text-gray-800">
                Registrar Venta
              </h2>
              <p className="text-sm text-gray-600 mb-4">
                Ingresa el precio en el que se vendió la carta (en COP):
              </p>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Precio de Venta (COP)
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={
                    precioVenta === ""
                      ? ""
                      : typeof precioVenta === "number"
                        ? precioVenta.toString().replace(".", ",")
                        : precioVenta
                  }
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === "" || /^[0-9]*[.,]?[0-9]*$/.test(value)) {
                      const normalizedValue = value.replace(",", ".");
                      if (normalizedValue === "" || normalizedValue === ".") {
                        setPrecioVenta("");
                      } else {
                        const num = parseFloat(normalizedValue);
                        setPrecioVenta(isNaN(num) ? "" : num);
                      }
                    }
                  }}
                  onBlur={(e) => {
                    const value = e.target.value.replace(",", ".");
                    if (value === "" || value === ".") {
                      setPrecioVenta("");
                    } else {
                      const num = parseFloat(value);
                      setPrecioVenta(isNaN(num) ? "" : num);
                    }
                  }}
                  className="w-full border border-gray-300 px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Ej: 50000 o 50.000"
                  autoFocus
                />
              </div>
              {errorVenta && (
                <p className="text-sm text-red-600 mb-4">{errorVenta}</p>
              )}
              <div className="flex gap-3 justify-end">
                <button
                  onClick={handleCerrarModalVenta}
                  disabled={vendiendo}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleVender}
                  disabled={vendiendo || precioVenta === "" || precioVenta <= 0}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {vendiendo ? "Registrando..." : "Registrar Venta"}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="w-full overflow-x-auto -mx-1 px-1">
          <div className="min-w-[640px]">
            <DataGrid
              rows={stockFiltrado}
              columns={columns}
              getRowId={(row) => row._id}
              pageSizeOptions={[20, 30, 40]}
              initialState={{
                pagination: {
                  paginationModel: { pageSize: 20, page: 0 },
                },
              }}
              pagination
              disableRowSelectionOnClick
              autosizeOptions={{ includeHeaders: true }}
              getRowClassName={(params) => {
                const tienePvp = params.row.pvp && params.row.pvp > 0;
                if (params.row.card_state === "propiedad") {
                  return "propiedad-row";
                }
                return !tienePvp ? "sin-pvp-row" : "";
              }}
              sx={{
                "& .sin-pvp-row": {
                  backgroundColor: "#fee2e2 !important", // rojo claro
                  "&:hover": {
                    backgroundColor: "#fecaca !important", // rojo más oscuro al hover
                  },
                },
                "& .propiedad-row": {
                  backgroundColor: "#ffe4e6 !important",
                  "&:hover": {
                    backgroundColor: "#fecdd3 !important",
                  },
                },
              }}
            />
          </div>
        </div>
        <Snackbar
          open={snackbar.open}
          autoHideDuration={4500}
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
          anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        >
          <Alert
            severity={snackbar.severity}
            variant="filled"
            onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
            sx={{ width: "100%" }}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
    </div>
  );
}
