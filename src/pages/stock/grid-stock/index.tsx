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

import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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
import {
  isQuantityProduct,
  isZeroProfitCardId,
  resolveStockImageUrl,
} from "../../../constants/bulk-product";
import { CardThumb } from "../../../components/card-thumb";
import {
  PANEL_DATAGRID_DENSITY,
  PANEL_DATAGRID_IMAGE_COL_WIDTH,
  PANEL_DATAGRID_ROW_HEIGHT,
} from "../../../theme/panel-density";
import { LoadingScreen } from "../../../components/loading";
import { ensureBulkProduct } from "../../../api/ensure-bulk";
import { PvpInlineCell } from "./pvp-inline-cell";
import { StockRowActions } from "./stock-row-actions";
import { StockInventoryStats, StockToolbar } from "./stock-toolbar";
import { API_BASE, apiUrl } from "../../../config/api";
import {
  filterQrExportRowsByStockIds,
  openStockQrLabelsPrintWindow,
  type StockQrExportRow,
} from "../../../modules/stock-barcode";
import {
  mapReservedClientByStockId,
  stockReservationStateLabel,
} from "../../../utils/reserved-client-by-stock";
import {
  API_RESERVA,
  type ClientItem,
  type ReservaItem,
} from "../../clientes/cliente-types";
import {
  CLIENTES_QUERY_KEY,
  STOCK_LIST_QUERY_KEY,
  fetchClientesRaw,
  fetchStockListRaw,
  selectClientList,
  selectStockVisibleInGrid,
} from "../../../api/list-queries";
import { useOwner } from "../../../modules/owner";
import {
  exportStockInventoryPdf,
  filterStockWithInventoryPhotosForPdf,
} from "../export-stock-inventory-pdf";
import { InventoryPhotoViewDialog } from "../fotos-inventario/inventory-photo-view-dialog";
import type {
  InventoryPhotoSessionMode,
  MissingPhotoRow,
} from "../fotos-inventario/inventory-photo-session";
import { useEventCallback } from "../../../utils/use-event-callback";

export type StockItem = StockListItem;

const EMPTY_STOCK: StockItem[] = [];
const EMPTY_RESERVAS: ReservaItem[] = [];
const EMPTY_CLIENTES: ClientItem[] = [];
const EMPTY_PHOTO_INDEX: Record<string, string> = {};

function toMissingPhotoRow(row: StockItem): MissingPhotoRow {
  return {
    _id: row._id,
    card_id: row.card_id,
    card_name: row.card_name,
    image_url: row.image_url,
    language: row.language,
    rareza: row.rareza ?? null,
    card_state: row.card_state,
  };
}

const getStockRowId = (row: StockItem) => row._id;

const getStockRowClassName = (params: { row: StockItem }) => {
  const tienePvp = params.row.pvp && params.row.pvp > 0;
  if (params.row.card_state === "propiedad") {
    return "propiedad-row";
  }
  return !tienePvp ? "sin-pvp-row" : "";
};

const STOCK_GRID_SX = {
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
} as const;

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
  if (isZeroProfitCardId(item.card_id)) return 0;
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
  const { can, owner } = useOwner();
  const canExportTienda = can("export-tienda");
  const canInventoryPhotos = can("stock-inventario-fotos");
  const [inventoryPhotoView, setInventoryPhotoView] = useState<{
    stockId: string;
    cardName: string;
    photoPath: string;
    row: MissingPhotoRow;
  } | null>(null);
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
  const [ventaProductKind, setVentaProductKind] = useState<"unit" | "quantity">(
    "unit",
  );
  const [ventaMaxQty, setVentaMaxQty] = useState(1);
  const [ventaQty, setVentaQty] = useState(1);
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

  const toast = useCallback(
    (message: string, severity: "success" | "error") =>
      setSnackbar({ open: true, message, severity }),
    [],
  );
  const busquedaDiferida = useDeferredValue(busqueda);

  useEffect(() => {
    void ensureBulkProduct().then((r) => {
      if (!r.ok) {
        toast(r.error ?? "No se pudo asegurar el SKU bulk", "error");
      } else if (r.data?.created) {
        void queryClient.invalidateQueries({ queryKey: ["stock"] });
      }
    });
    // Solo al montar la grilla.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const {
    data: stock = EMPTY_STOCK,
    isLoading,
    error,
  } = useQuery({
    queryKey: STOCK_LIST_QUERY_KEY,
    queryFn: () => fetchStockListRaw(),
    select: selectStockVisibleInGrid,
  });

  const { data: reservas = EMPTY_RESERVAS } = useQuery<ReservaItem[]>({
    queryKey: ["reservas"],
    queryFn: async () => {
      const res = await axios.get(API_RESERVA);
      return Array.isArray(res.data) ? res.data : [];
    },
  });

  const { data: inventoryPhotoIndex = EMPTY_PHOTO_INDEX } = useQuery<
    Record<string, string>
  >({
    queryKey: ["stock-inventory-photos-index", owner],
    enabled: canInventoryPhotos,
    queryFn: async () => {
      const res = await axios.get<Record<string, string>>(
        apiUrl("/stock/inventory-photos/index"),
      );
      return res.data ?? {};
    },
  });

  const { data: clientes = EMPTY_CLIENTES } = useQuery({
    queryKey: CLIENTES_QUERY_KEY,
    queryFn: fetchClientesRaw,
    select: selectClientList,
  });

  const reservedClientByStockId = useMemo(
    () => mapReservedClientByStockId(reservas, clientes),
    [reservas, clientes],
  );

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
    if (busquedaDiferida.trim()) {
      const terminoBusqueda = busquedaDiferida.toLowerCase().trim();
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
  }, [stockOrdenado, busquedaDiferida, filtroTags, filtroSinTags]);

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

  const handleAbrirModalVenta = (row: StockItem) => {
    setVentaStockId(row._id);
    setVentaCardId(row.card_id);
    const isQty = isQuantityProduct({
      product_kind: row.product_kind,
      card_id: row.card_id,
    });
    setVentaProductKind(isQty ? "quantity" : "unit");
    const maxQ =
      isQty && typeof row.quantity === "number" && row.quantity > 0
        ? row.quantity
        : 1;
    setVentaMaxQty(maxQ);
    setVentaQty(1);

    const pvp = row.pvp;
    const pvpCurrency = row.pvp_currency;
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
    setVentaProductKind("unit");
    setVentaMaxQty(1);
    setVentaQty(1);
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

    const qty =
      ventaProductKind === "quantity" ? Math.floor(Number(ventaQty)) : 1;
    if (!Number.isInteger(qty) || qty < 1) {
      setErrorVenta("La cantidad debe ser un entero >= 1.");
      return;
    }
    if (ventaProductKind === "quantity" && qty > ventaMaxQty) {
      setErrorVenta(`Stock insuficiente (disponible: ${ventaMaxQty}).`);
      return;
    }

    try {
      setVendiendo(true);
      setErrorVenta("");
      const res = await axios.post(apiUrl("/sales/sell"), {
        stock_id: ventaStockId,
        card_id: ventaCardId,
        amount_cop: Number(precioVenta),
        notes: "Venta registrada desde inventario",
        quantity: qty,
      });
      if (res.data?.success === false) {
        setErrorVenta(
          res.data?.message ||
            "No fue posible registrar la venta. Intenta más tarde.",
        );
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["stock"] });
      handleCerrarModalVenta();
    } catch (error: any) {
      setErrorVenta(
        error?.response?.data?.message ||
          "No fue posible registrar la venta. Intenta más tarde.",
      );
    } finally {
      setVendiendo(false);
    }
  };

  const onModificar = useEventCallback(handleModificar);
  const onMarcarPropiedad = useEventCallback(handleMarcarPropiedad);
  const onVender = useEventCallback(handleAbrirModalVenta);
  const onEliminar = useEventCallback(handleOpenDeleteDialog);
  const onToggleRowTag = useEventCallback(handleToggleRowTag);
  const onViewInventoryPhoto = useEventCallback(
    (row: StockItem, photoPath: string) =>
      setInventoryPhotoView({
        stockId: row._id,
        cardName: row.card_name,
        photoPath,
        row: toMissingPhotoRow(row),
      }),
  );

  const columns = useMemo<GridColDef[]>(() => [
    {
      field: "image_url",
      headerName: "Imagen",
      renderCell: (params) => {
        const row = params.row as StockItem;
        const src = resolveStockImageUrl(row.card_id, params.value as string);
        return (
          <CardThumb
            src={src}
            alt={row.card_name || "carta"}
            size="sm"
            enlargeOnHover
          />
        );
      },
      sortable: false,
      filterable: false,
      width: PANEL_DATAGRID_IMAGE_COL_WIDTH,
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
      field: "acciones",
      headerName: "Acciones",
      sortable: false,
      filterable: false,
      width: 200,
      renderCell: (params) => (
        <StockRowActions
          row={params.row as StockItem}
          marcandoPropiedad={marcandoPropiedad}
          inventoryPhotoPath={inventoryPhotoIndex[(params.row as StockItem)._id]}
          onModificar={onModificar}
          onMarcarPropiedad={onMarcarPropiedad}
          onVender={onVender}
          onEliminar={onEliminar}
          onViewInventoryPhoto={onViewInventoryPhoto}
        />
      ),
    },
    {
      field: "quantity",
      headerName: "Cant.",
      width: 90,
      renderCell: (params) => {
        const row = params.row as StockItem;
        if (
          !isQuantityProduct({
            product_kind: row.product_kind,
            card_id: row.card_id,
          })
        ) {
          return <span className="text-gray-400">—</span>;
        }
        return (
          <span className="font-semibold text-gray-800">
            {typeof row.quantity === "number" ? row.quantity : 0}
          </span>
        );
      },
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
                  onChange={() => void onToggleRowTag(row, tagId)}
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
      valueGetter: (_value, row) =>
        stockReservationStateLabel(
          row.card_state,
          reservedClientByStockId.get(String(row._id)),
        ),
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
          const reserved = reservedClientByStockId.get(String(params.row._id));
          return (
            <div className="flex h-full flex-col justify-center leading-tight">
              <span className="text-yellow-600 font-medium">Reservada</span>
              {reserved ? (
                <span
                  className="truncate text-sm font-semibold text-yellow-700"
                  title={reserved.nombre}
                >
                  {reserved.nombre}
                </span>
              ) : null}
            </div>
          );
        }
        return <span className="text-green-600 font-medium">Disponible</span>;
      },
      width: 200,
    },
  ], [
    convert,
    inventoryPhotoIndex,
    marcandoPropiedad,
    onEliminar,
    onMarcarPropiedad,
    onModificar,
    onToggleRowTag,
    onVender,
    onViewInventoryPhoto,
    pvpSavingRowId,
    queryClient,
    reservedClientByStockId,
    tagSavingRowId,
    toast,
  ]);

  const [exportando, setExportando] = useState(false);
  const [exportandoBarcode, setExportandoBarcode] = useState(false);
  const [exportandoInventarioFotos, setExportandoInventarioFotos] = useState(false);
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

  const openInventoryPhotoSession = (mode: InventoryPhotoSessionMode) => {
    if (!inventoryPhotoView) return;
    const { stockId, photoPath, row } = inventoryPhotoView;
    setInventoryPhotoView(null);
    navigate("/stock/fotos-inventario", {
      state: {
        stockId,
        mode,
        photoPath,
        row,
      },
    });
  };

  const handleExportInventoryPhotosPdf = async () => {
    try {
      setExportandoInventarioFotos(true);
      const rows = filterStockWithInventoryPhotosForPdf(
        stock,
        inventoryPhotoIndex,
      );
      const result = await exportStockInventoryPdf(rows, {
        toCopFromEur: convert.toCopFromEur,
        photoIndex: inventoryPhotoIndex,
        owner,
      });
      const imgNote =
        result.imageFailures > 0
          ? ` (${result.imageFailures} foto(s) no se pudieron cargar)`
          : "";
      window.alert(
        `PDF generado: ${result.rows} carta(s) con foto${imgNote}.`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "No se pudo generar el PDF.";
      window.alert(msg);
    } finally {
      setExportandoInventarioFotos(false);
    }
  };

  const hayFiltrosVisibles =
    busquedaDiferida.trim().length > 0 || filtroTags.length > 0 || filtroSinTags;

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
    return <LoadingScreen message="Cargando stock…" />;

  if (error)
    return (
      <p className="text-center text-red-500">
        ❌ Error al cargar el stock. Intenta más tarde.
      </p>
    );

  return (

    <div className="w-full min-w-0">
      {cartasSinPvp > 0 && (
        <Alert severity="warning" sx={{ mb: 1, py: 0 }}>
          {cartasSinPvp === 1
            ? "1 carta sin PVP"
            : `${cartasSinPvp} cartas sin PVP`}
        </Alert>
      )}

      <StockToolbar
        busqueda={busqueda}
        onBusquedaChange={setBusqueda}
        exportando={exportando}
        exportandoBarcode={exportandoBarcode}
        imprimiendo={imprimiendo}
        limpiandoPvp={limpiandoPvp}
        actualizandoTienda={actualizandoTienda}
        canExportTienda={canExportTienda}
        canInventoryPhotos={canInventoryPhotos}
        exportandoInventarioFotos={exportandoInventarioFotos}
        onExportPdf={handleExportar}
        onExportQr={handleExportarQr}
        onPrintCatalog={handleImprimirCatalogo}
        onClearAllPvp={handleLimpiarTodosPvp}
        onUpdateStore={handleActualizarInformacionTienda}
        onOpenPhotoCapture={() => navigate("/stock/fotos-inventario")}
        onExportInventoryPhotosPdf={() => void handleExportInventoryPhotosPdf()}
      />

      <div className="flex flex-wrap items-center gap-1.5 mb-1.5 text-sm text-gray-700">
        <span className="font-medium shrink-0 text-xs uppercase tracking-wide text-gray-500">
          Tags
        </span>
        {STOCK_TAG_VALUES.map((tag) => {
          const active = filtroTags.includes(tag);
          return (
            <button
              key={tag}
              type="button"
              onClick={() => toggleFiltroTag(tag)}
              className={`px-2.5 py-0.5 rounded-full border text-xs transition ${
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
          className={`px-2.5 py-0.5 rounded-full border border-dashed text-xs transition ${
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
            className="text-xs text-blue-600 hover:underline ml-1"
          >
            Quitar
          </button>
        )}
      </div>

      <StockInventoryStats
        precioInventario={precioInventario}
        ventasEsperadas={ventasEsperadas}
        gananciaEsperada={gananciaEsperada}
      />

      {busqueda ? (
        <p className="text-xs text-gray-600 mb-1">
          {stockFiltrado.length}{" "}
          {stockFiltrado.length === 1 ? "resultado" : "resultados"} de {stock.length}
        </p>
      ) : null}
      {errorPropiedad ? (
        <p className="text-sm text-red-600 mb-1">{errorPropiedad}</p>
      ) : null}

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
            <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl max-h-[calc(100dvh-24px)] overflow-y-auto">
              <h2 className="text-xl font-bold mb-4 text-gray-800">
                Registrar Venta
              </h2>
              <p className="text-sm text-gray-600 mb-4">
                Ingresa el precio unitario de venta (en COP)
                {ventaProductKind === "quantity"
                  ? " y la cantidad de unidades."
                  : ":"}
              </p>
              {ventaProductKind === "quantity" ? (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Cantidad (máx. {ventaMaxQty})
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={ventaMaxQty}
                    step={1}
                    value={ventaQty}
                    onChange={(e) => {
                      const n = parseInt(e.target.value, 10);
                      setVentaQty(Number.isFinite(n) ? n : 1);
                    }}
                    className="w-full border border-gray-300 px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              ) : null}
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
                  autoFocus={ventaProductKind !== "quantity"}
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
              getRowId={getStockRowId}
              pageSizeOptions={[20, 30, 40]}
              rowHeight={PANEL_DATAGRID_ROW_HEIGHT}
              density={PANEL_DATAGRID_DENSITY}
              initialState={{
                pagination: {
                  paginationModel: { pageSize: 20, page: 0 },
                },
              }}
              pagination
              disableRowSelectionOnClick
              autosizeOptions={{ includeHeaders: true }}
              getRowClassName={getStockRowClassName}
              sx={STOCK_GRID_SX}
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

        <InventoryPhotoViewDialog
          open={inventoryPhotoView != null}
          cardName={inventoryPhotoView?.cardName ?? ""}
          photoPath={inventoryPhotoView?.photoPath ?? null}
          onClose={() => setInventoryPhotoView(null)}
          onEditPhoto={() => openInventoryPhotoSession("edit")}
          onRetakePhoto={() => openInventoryPhotoSession("retake")}
        />
    </div>
  );
}
