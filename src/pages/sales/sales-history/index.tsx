import { useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useEffect, useMemo, useState } from "react";
import { DataGrid, type GridColDef } from "@mui/x-data-grid";
import { formatCOP } from "../../../utils/convert";
import { useExchangeRates } from "../../../utils/tasa";
import { API_BASE, apiUrl } from "../../../config/api";
import { CardThumb } from "../../../components/card-thumb";
import {
  PANEL_DATAGRID_DENSITY,
  PANEL_DATAGRID_IMAGE_COL_WIDTH,
  PANEL_DATAGRID_ROW_HEIGHT,
} from "../../../theme/panel-density";
import { LoadingScreen } from "../../../components/loading";
import { isZeroProfitCardId } from "../../../constants/bulk-product";

type SaleHistoryItem = {
  _id: string;
  stock_id: string;
  card_id: string;
  type: "venta" | "reserva" | "propiedad";
  amount_cop: number;
  notes: string;
  created_at: string;
  cycle_closed_at: string | null;
  stock_info: {
    card_name: string;
    image_url: string;
    card_cost: number;
    currency: string;
    language?: string;
    shipment: number;
    cards_in_shipmet: number;
    unity_cost: number;
  };
};

function historySaleCostoCop(
  sale: SaleHistoryItem,
  convert: ReturnType<typeof useExchangeRates>["convert"],
): number {
  if (isZeroProfitCardId(sale.card_id)) return sale.amount_cop;
  const costo = sale.stock_info.card_cost;
  const monedaCosto = sale.stock_info.currency;
  if (monedaCosto === "COP") return costo;
  if (monedaCosto === "EUR") return convert.toCopFromEur(costo) ?? 0;
  if (monedaCosto === "USD") return convert.toCopFromUsd(costo) ?? 0;
  return 0;
}

export default function SalesHistory() {
  const { convert } = useExchangeRates();
  const queryClient = useQueryClient();
  const [volviendoId, setVolviendoId] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [paginationModel, setPaginationModel] = useState({
    page: 0,
    pageSize: 20,
  });

  useEffect(() => {
    setPaginationModel((prev) => ({ ...prev, page: 0 }));
  }, [busqueda]);

  const handleVolverAVentasActuales = async (saleId: string) => {
    try {
      setVolviendoId(saleId);
      await axios.post(`${API_BASE}/sales/reopen/${saleId}`);
      await queryClient.invalidateQueries({ queryKey: ["sales-history"] });
      await queryClient.invalidateQueries({ queryKey: ["sales-dashboard"] });
    } catch (err: unknown) {
      const msg =
        (err as any)?.response?.data?.message ?? "No se pudo mover la venta a ventas actuales.";
      alert(msg);
    } finally {
      setVolviendoId(null);
    }
  };

  const {
    data: sales = [],
    isLoading,
    error,
  } = useQuery<SaleHistoryItem[]>({
    queryKey: ["sales-history"],
    queryFn: async () => {
      const res = await axios.get(apiUrl("/sales/history"));
      return res.data;
    },
  });

  const ventasValidas = useMemo(
    () => sales.filter((sale) => sale && sale._id && sale.stock_info),
    [sales]
  );

  const ventasFiltradas = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    if (!termino) return ventasValidas;
    return ventasValidas.filter((sale) => {
      const nombre = (sale.stock_info?.card_name ?? "").toLowerCase();
      const idioma = (sale.stock_info?.language ?? "").toLowerCase();
      return nombre.includes(termino) || idioma.includes(termino);
    });
  }, [ventasValidas, busqueda]);

  const columns: GridColDef[] = [
    {
      field: "image_url",
      headerName: "Imagen",
      renderCell: (params) => {
        const src = params?.row?.stock_info?.image_url;
        return (
          <CardThumb
            src={src}
            alt={params?.row?.stock_info?.card_name || "carta"}
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
      valueGetter: (_value, row) => row?.stock_info?.card_name ?? "",
      width: 250,
    },
    {
      field: "language",
      headerName: "Idioma",
      valueGetter: (_value, row) => row?.stock_info?.language?.trim() || "—",
      width: 100,
    },
    {
      field: "costo_compra",
      headerName: "Costo de Compra",
      renderCell: (params) => {
        if (!params?.row?.stock_info) return <span>-</span>;
        const costoCOP = historySaleCostoCop(params.row as SaleHistoryItem, convert);
        const costoEUR = convert.toEurFromCop(costoCOP) ?? 0;
        const costoUSD = convert.toUsdFromCop(costoCOP) ?? 0;
        const moneda = params.row.stock_info.currency;

        return (
          <div className="flex flex-col gap-1 text-sm">
            <span className={moneda === "COP" ? "font-bold text-blue-600" : ""}>
              COP {formatCOP(costoCOP.toFixed(0))}
            </span>
            <span className="text-xs text-gray-500">
              EUR {costoEUR.toFixed(2)} / USD {costoUSD.toFixed(2)}
            </span>
          </div>
        );
      },
      width: 200,
    },
    {
      field: "precio_venta",
      headerName: "Precio de Venta",
      renderCell: (params) => {
        if (!params?.row) return <span>-</span>;
        const ventaCOP = params.row.amount_cop;
        const ventaEUR = convert.toEurFromCop(ventaCOP) ?? 0;
        const ventaUSD = convert.toUsdFromCop(ventaCOP) ?? 0;

        return (
          <div className="flex flex-col gap-1 text-sm">
            <span className="font-bold text-blue-600">
              COP {formatCOP(ventaCOP.toFixed(0))}
            </span>
            <span className="text-xs text-gray-500">
              EUR {ventaEUR.toFixed(2)} / USD {ventaUSD.toFixed(2)}
            </span>
          </div>
        );
      },
      width: 200,
    },
    {
      field: "ganancia",
      headerName: "Ganancia",
      renderCell: (params) => {
        if (!params?.row?.stock_info || !params?.row?.amount_cop) return <span>-</span>;
        const ventaCOP = params.row.amount_cop;
        const costoCOP = historySaleCostoCop(params.row as SaleHistoryItem, convert);

        const ganancia = ventaCOP - costoCOP;
        const porcentaje = costoCOP > 0 ? (ganancia / costoCOP) * 100 : 0;
        const esGanancia = ganancia > 0;
        const esPerdida = ganancia < 0;

        return (
          <div className="flex flex-col">
            <span
              className={`font-semibold ${
                esGanancia
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
              className={`text-xs ${
                esGanancia
                  ? "text-green-500"
                  : esPerdida
                  ? "text-red-500"
                  : "text-gray-500"
              }`}
            >
              ({esGanancia ? "+" : ""}
              {porcentaje.toFixed(1)}%)
            </span>
          </div>
        );
      },
      width: 180,
    },
    {
      field: "created_at",
      headerName: "Fecha de Venta",
      valueFormatter: (params: any) => {
        if (!params?.value) return "";
        try {
          return new Date(params.value).toLocaleDateString("es-ES", {
            year: "numeric",
            month: "short",
            day: "numeric",
          });
        } catch {
          return "";
        }
      },
      width: 150,
    },
    {
      field: "cycle_closed_at",
      headerName: "Ciclo cerrado el",
      valueFormatter: (params: any) => {
        if (!params?.value) return "";
        try {
          return new Date(params.value).toLocaleDateString("es-ES", {
            year: "numeric",
            month: "short",
            day: "numeric",
          });
        } catch {
          return "";
        }
      },
      width: 150,
    },
    {
      field: "notes",
      headerName: "Notas",
      width: 200,
    },
    {
      field: "acciones",
      headerName: "Acciones",
      sortable: false,
      filterable: false,
      width: 200,
      renderCell: (params) => (
        <button
          type="button"
          onClick={() => handleVolverAVentasActuales(params.row._id)}
          disabled={volviendoId === params.row._id}
          className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
        >
          {volviendoId === params.row._id ? "..." : "Volver a ventas actuales"}
        </button>
      ),
    },
  ];

  if (isLoading)
    return <LoadingScreen message="Cargando histórico de ventas…" />;

  if (error)
    return (
      <p className="text-center text-red-500">
        Error al cargar el histórico de ventas. Intenta más tarde.
      </p>
    );

  return (
    <div className="w-full p-6">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">Histórico de Ventas</h1>
      <p className="text-gray-600 mb-6">
        Ventas de ciclos cerrados. Solo consulta; no se incluyen en el cálculo de ganancias del
        dashboard actual.
      </p>

      <div className="mb-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[220px] max-w-md">
            <div className="relative">
              <input
                type="text"
                placeholder="Buscar por nombre o idioma..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <svg
                className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden
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
                  aria-label="Limpiar búsqueda"
                >
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden
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
        </div>
      </div>

      <div style={{ height: "70vh", width: "100%" }}>
        {ventasValidas.length === 0 ? (
          <p className="text-center text-gray-500 mt-8">
            No hay ventas en el histórico aún. Al cerrar un ciclo desde el dashboard, las ventas
            aparecerán aquí.
          </p>
        ) : ventasFiltradas.length === 0 ? (
          <p className="text-center text-gray-500 mt-8">
            Ninguna venta coincide con «{busqueda.trim()}».
          </p>
        ) : (
          <DataGrid
            rows={ventasFiltradas}
            columns={columns}
            getRowId={(row) => row._id || Math.random().toString()}
            pageSizeOptions={[20, 30, 50]}
            paginationModel={paginationModel}
            onPaginationModelChange={setPaginationModel}
            pagination
            rowHeight={PANEL_DATAGRID_ROW_HEIGHT}
            density={PANEL_DATAGRID_DENSITY}
            disableRowSelectionOnClick
          />
        )}
      </div>
    </div>
  );
}
