import { useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useState } from "react";
import { DataGrid, type GridColDef } from "@mui/x-data-grid";
import { formatCOP } from "../../../utils/convert";
import { useExchangeRates } from "../../../utils/tasa";
import { API_BASE, apiUrl } from "../../../config/api";

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
    shipment: number;
    cards_in_shipmet: number;
    unity_cost: number;
  };
};

export default function SalesHistory() {
  const { convert } = useExchangeRates();
  const queryClient = useQueryClient();
  const [volviendoId, setVolviendoId] = useState<string | null>(null);

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

  const columns: GridColDef[] = [
    {
      field: "image_url",
      headerName: "Imagen",
      renderCell: (params) => {
        if (!params?.row?.stock_info?.image_url) return <span>-</span>;
        return (
          <img
            src={params.row.stock_info.image_url}
            alt="carta"
            className="object-contain w-12 h-16"
          />
        );
      },
      sortable: false,
      filterable: false,
      width: 80,
    },
    {
      field: "card_name",
      headerName: "Nombre",
      valueGetter: (_value, row) => row?.stock_info?.card_name ?? "",
      width: 250,
    },
    {
      field: "costo_compra",
      headerName: "Costo de Compra",
      renderCell: (params) => {
        if (!params?.row?.stock_info) return <span>-</span>;
        const costo = params.row.stock_info.card_cost;
        const moneda = params.row.stock_info.currency;
        let costoCOP = 0;
        let costoEUR = 0;
        let costoUSD = 0;

        if (moneda === "COP") {
          costoCOP = costo;
          costoEUR = convert.toEurFromCop(costo) ?? 0;
          costoUSD = convert.toUsdFromCop(costo) ?? 0;
        } else if (moneda === "EUR") {
          costoEUR = costo;
          costoCOP = convert.toCopFromEur(costo) ?? 0;
          costoUSD = convert.toUsdFromCop(costoCOP) ?? 0;
        } else if (moneda === "USD") {
          costoUSD = costo;
          costoCOP = convert.toCopFromUsd(costo) ?? 0;
          costoEUR = convert.toEurFromCop(costoCOP) ?? 0;
        }

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
        const costo = params.row.stock_info.card_cost;
        const monedaCosto = params.row.stock_info.currency;
        const ventaCOP = params.row.amount_cop;

        let costoCOP = 0;
        if (monedaCosto === "COP") {
          costoCOP = costo;
        } else if (monedaCosto === "EUR") {
          costoCOP = convert.toCopFromEur(costo) ?? 0;
        } else if (monedaCosto === "USD") {
          costoCOP = convert.toCopFromUsd(costo) ?? 0;
        }

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
    return (
      <p className="text-center text-gray-500">Cargando histórico de ventas...</p>
    );

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

      <div style={{ height: "70vh", width: "100%" }}>
        {sales.length === 0 ? (
          <p className="text-center text-gray-500 mt-8">
            No hay ventas en el histórico aún. Al cerrar un ciclo desde el dashboard, las ventas
            aparecerán aquí.
          </p>
        ) : (
          <DataGrid
            rows={sales.filter((sale) => sale && sale._id && sale.stock_info)}
            columns={columns}
            getRowId={(row) => row._id || Math.random().toString()}
            pageSizeOptions={[20, 30, 50]}
            initialState={{
              pagination: {
                paginationModel: { pageSize: 20, page: 0 },
              },
            }}
            pagination
            disableRowSelectionOnClick
          />
        )}
      </div>
    </div>
  );
}
