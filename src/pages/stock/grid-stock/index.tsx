import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { DataGrid, type GridColDef } from "@mui/x-data-grid";

import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { exportToPDF } from "../../../utils/pdf";
import { useExchangeRates } from "../../../utils/tasa";
import { formatCOP } from "../../../utils/convert";

export type StockItem = {
  _id: string;
  card_id: string;
  shipment: number;
  unity_cost: number;
  cards_in_shipmet: number;
  image_url: string;
  card_state: string;
  card_name: string;
  card_cost: number;
  currency: number;
};

export default function StockGrid() {
  const navigate = useNavigate();

  const {
    data: stock = [],
    isLoading,
    error,
  } = useQuery<StockItem[]>({
    queryKey: ["stock"],
    queryFn: async () => {
      const res = await axios.get("http://localhost:3000/stock");
      return Array.isArray(res.data)
        ? res.data.filter((stockItem) => stockItem.card_state != "vendida")
        : [];
    },
  });

  const precioInventario = useMemo(() => {
    let value = 0;
    stock.forEach((item) => {
      value += item.card_cost;
    });
    return value;
  }, [stock]);

  const { convert } = useExchangeRates();

  const handleModificar = (id: string) => {
    navigate(`/stock/update/${id}`);
  };

  const handleAsignarPVP = (id: string) => {
    navigate(`/add-pvp/${id}`);
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
    { field: "card_name", headerName: "Nombre", width: 300 },
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
    { field: "card_id", headerName: "Carta", width: 150 },
    {
      field: "card_state",
      headerName: "Estado",
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
      headerName: "Asignar PVP",
      sortable: false,
      filterable: false,
      width: 130,
      renderCell: (params) => (
        <button
          onClick={() => handleAsignarPVP(params.row.card_id)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded"
        >
          Asignar PVP
        </button>
      ),
    },
  ];

  const [exportando, setExportando] = useState(false);

  const handleExportar = () => {
    setExportando(true);
    exportToPDF(
      stock.filter((stockItem) => stockItem.card_state == "en_stock_colombia"),
      convert.toCopFromEur,
      () => setExportando(false)
    );
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
    <div style={{ height: "90%", width: "100%", margin: "2rem auto" }}>
      <h2 className="text-2xl font-bold mb-4 text-center">
        Inventario Guardado, Total €{precioInventario.toFixed(2)}
      </h2>
      <div className="flex justify-between mb-4">
        <h2 className="text-2xl font-bold text-center">
          Inventario Guardado, Total €{precioInventario.toFixed(2)}
        </h2>
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
      </div>
      <DataGrid
        rows={stock}
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
      />
    </div>
  );
}
