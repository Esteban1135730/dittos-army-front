import { useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useMemo, useState } from "react";
import { DataGrid, type GridColDef } from "@mui/x-data-grid";
import { formatCOP } from "../../../utils/convert";
import { useExchangeRates } from "../../../utils/tasa";

type SaleWithStock = {
  _id: string;
  stock_id: string;
  card_id: string;
  type: "venta" | "reserva" | "propiedad";
  amount_cop: number;
  notes: string;
  created_at: string;
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

export default function SalesDashboard() {
  const { convert } = useExchangeRates();
  const queryClient = useQueryClient();
  const [mostrarModalEditar, setMostrarModalEditar] = useState(false);
  const [ventaEditando, setVentaEditando] = useState<SaleWithStock | null>(null);
  const [precioVentaEditado, setPrecioVentaEditado] = useState<number | "">("");
  const [notasEditadas, setNotasEditadas] = useState("");
  const [editando, setEditando] = useState(false);
  const [errorEditar, setErrorEditar] = useState("");
  const [deshaciendo, setDeshaciendo] = useState<string | null>(null);

  const {
    data: sales = [],
    isLoading,
    error,
  } = useQuery<SaleWithStock[]>({
    queryKey: ["sales-dashboard"],
    queryFn: async () => {
      const res = await axios.get("http://localhost:3000/sales/dashboard");
      return res.data;
    },
  });

  // Obtener valor total del inventario actual
  const {
    data: stockData = [],
  } = useQuery<any[]>({
    queryKey: ["stock-for-dashboard"],
    queryFn: async () => {
      const res = await axios.get("http://localhost:3000/stock");
      return Array.isArray(res.data) ? res.data : [];
    },
  });

  // Calcular estadísticas generales
  const estadisticas = useMemo(() => {
    let totalVentasCOP = 0;
    let totalCostoCOP = 0;
    let totalGananciaCOP = 0;
    let cartasVendidas = 0;

    sales.forEach((sale) => {
      const costo = sale.stock_info.card_cost;
      const monedaCosto = sale.stock_info.currency;

      // Convertir costo a COP
      let costoCOP = 0;
      if (monedaCosto === "COP") {
        costoCOP = costo;
      } else if (monedaCosto === "EUR") {
        costoCOP = convert.toCopFromEur(costo) ?? 0;
      } else if (monedaCosto === "USD") {
        costoCOP = convert.toCopFromUsd(costo) ?? 0;
      }

      totalVentasCOP += sale.amount_cop;
      totalCostoCOP += costoCOP;
      totalGananciaCOP += sale.amount_cop - costoCOP;
      cartasVendidas += 1;
    });

    // Calcular valor total del inventario actual (solo costo de compra, no PVP) e inversión total
    let valorInventarioCOP = 0;
    let inversionInventarioCOP = 0;
    let inversionTotalCOP = 0;

    // Inversión en cartas no vendidas (inventario actual)
    stockData.forEach((item) => {
      if (item.card_state !== "vendida" && item.card_state !== "propiedad") {
        const costo = item.card_cost || 0;
        const moneda = item.currency;

        // Convertir costo a COP
        let costoCOP = 0;
        if (moneda === "COP") {
          costoCOP = costo;
        } else if (moneda === "EUR") {
          costoCOP = convert.toCopFromEur(costo) ?? 0;
        } else if (moneda === "USD") {
          costoCOP = convert.toCopFromUsd(costo) ?? 0;
        }

        valorInventarioCOP += costoCOP;
        inversionInventarioCOP += costoCOP;
      }
    });

    // Inversión total (vendidas + no vendidas)
    inversionTotalCOP = totalCostoCOP + inversionInventarioCOP;

    // Ganancia/Pérdida real: Total Vendido - Inversión Total
    const gananciaReal = totalVentasCOP - inversionTotalCOP;
    const roiReal = inversionTotalCOP > 0 ? (gananciaReal / inversionTotalCOP) * 100 : 0;

    const roi = totalCostoCOP > 0 ? (totalGananciaCOP / totalCostoCOP) * 100 : 0;
    const porcentajeRecuperado = totalCostoCOP > 0 ? (totalVentasCOP / totalCostoCOP) * 100 : 0;
    const estaRecuperado = totalVentasCOP >= totalCostoCOP;

    return {
      totalVentasCOP,
      totalCostoCOP,
      totalGananciaCOP,
      cartasVendidas,
      roi,
      porcentajeRecuperado,
      estaRecuperado,
      valorInventarioCOP,
      inversionInventarioCOP,
      inversionTotalCOP,
      gananciaReal,
      roiReal,
    };
  }, [sales, stockData, convert]);

  const handleAbrirModalEditar = (venta: SaleWithStock) => {
    setVentaEditando(venta);
    setPrecioVentaEditado(venta.amount_cop);
    setNotasEditadas(venta.notes || "");
    setErrorEditar("");
    setMostrarModalEditar(true);
  };

  const handleCerrarModalEditar = () => {
    setMostrarModalEditar(false);
    setVentaEditando(null);
    setPrecioVentaEditado("");
    setNotasEditadas("");
    setErrorEditar("");
  };

  const handleGuardarEdicion = async () => {
    if (!ventaEditando) return;

    if (precioVentaEditado === "" || precioVentaEditado <= 0) {
      setErrorEditar("Por favor ingresa un precio de venta válido (mayor a 0).");
      return;
    }

    try {
      setEditando(true);
      setErrorEditar("");
      await axios.put(`http://localhost:3000/sales/${ventaEditando._id}`, {
        amount_cop: Number(precioVentaEditado),
        notes: notasEditadas,
      });
      await queryClient.invalidateQueries({ queryKey: ["sales-dashboard"] });
      handleCerrarModalEditar();
    } catch (error: any) {
      setErrorEditar(
        error?.response?.data?.message ||
          "No fue posible actualizar la venta. Intenta más tarde."
      );
    } finally {
      setEditando(false);
    }
  };

  const handleDeshacerVenta = async (ventaId: string) => {
    const confirmar = window.confirm(
      "¿Estás seguro de que deseas deshacer esta venta? La carta volverá a estar disponible en el inventario."
    );
    if (!confirmar) return;

    try {
      setDeshaciendo(ventaId);
      await axios.delete(`http://localhost:3000/sales/${ventaId}`);
      await queryClient.invalidateQueries({ queryKey: ["sales-dashboard"] });
      await queryClient.invalidateQueries({ queryKey: ["stock"] });
      await queryClient.invalidateQueries({ queryKey: ["stock-for-dashboard"] });
    } catch (error: any) {
      alert(
        error?.response?.data?.message ||
          "No fue posible deshacer la venta. Intenta más tarde."
      );
    } finally {
      setDeshaciendo(null);
    }
  };

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
      valueGetter: (params: any) => params?.row?.stock_info?.card_name || "",
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

        // Convertir costo a COP
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
      field: "roi",
      headerName: "ROI",
      renderCell: (params) => {
        if (!params?.row?.stock_info || !params?.row?.amount_cop) return <span>-</span>;
        const costo = params.row.stock_info.card_cost;
        const monedaCosto = params.row.stock_info.currency;
        const ventaCOP = params.row.amount_cop;

        // Convertir costo a COP
        let costoCOP = 0;
        if (monedaCosto === "COP") {
          costoCOP = costo;
        } else if (monedaCosto === "EUR") {
          costoCOP = convert.toCopFromEur(costo) ?? 0;
        } else if (monedaCosto === "USD") {
          costoCOP = convert.toCopFromUsd(costo) ?? 0;
        }

        const ganancia = ventaCOP - costoCOP;
        const roi = costoCOP > 0 ? (ganancia / costoCOP) * 100 : 0;

        const esGanancia = roi > 0;
        const esPerdida = roi < 0;

        return (
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
            {roi.toFixed(1)}%
          </span>
        );
      },
      width: 100,
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
        <div className="flex gap-2">
          <button
            onClick={() => handleAbrirModalEditar(params.row)}
            className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
          >
            Editar
          </button>
          <button
            onClick={() => handleDeshacerVenta(params.row._id)}
            disabled={deshaciendo === params.row._id}
            className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            {deshaciendo === params.row._id ? "Deshaciendo..." : "Deshacer"}
          </button>
        </div>
      ),
    },
  ];

  if (isLoading)
    return (
      <p className="text-center text-gray-500">Cargando dashboard de ventas...</p>
    );

  if (error)
    return (
      <p className="text-center text-red-500">
        ❌ Error al cargar el dashboard de ventas. Intenta más tarde.
      </p>
    );

  return (
    <div className="w-full p-6">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">Dashboard de Ventas</h1>

      {/* Estadísticas Generales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow-md border border-gray-200">
          <p className="text-sm text-gray-600 mb-2">Total Vendido</p>
          <div className="flex flex-col gap-1">
            <span className="font-bold text-blue-600 text-xl">
              COP {formatCOP(estadisticas.totalVentasCOP.toFixed(0))}
            </span>
            <span className="text-xs text-gray-500">
              EUR {convert.toEurFromCop(estadisticas.totalVentasCOP)?.toFixed(2) ?? "0.00"} / USD{" "}
              {convert.toUsdFromCop(estadisticas.totalVentasCOP)?.toFixed(2) ?? "0.00"}
            </span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-md border border-gray-200">
          <p className="text-sm text-gray-600 mb-2">Total Invertido</p>
          <div className="flex flex-col gap-1">
            <span className="font-bold text-orange-600 text-xl">
              COP {formatCOP(estadisticas.totalCostoCOP.toFixed(0))}
            </span>
            <span className="text-xs text-gray-500">
              EUR {convert.toEurFromCop(estadisticas.totalCostoCOP)?.toFixed(2) ?? "0.00"} / USD{" "}
              {convert.toUsdFromCop(estadisticas.totalCostoCOP)?.toFixed(2) ?? "0.00"}
            </span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-md border border-gray-200">
          <p className="text-sm text-gray-600 mb-2">Ganancia Real vs Inversión</p>
          <div className="flex flex-col gap-2">
            <div>
              <p className="text-xs text-gray-500 mb-1">Valor Inventario Actual</p>
              <span className="font-bold text-purple-600 text-lg">
                COP {formatCOP(estadisticas.valorInventarioCOP.toFixed(0))}
              </span>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Inversión Total</p>
              <span className="font-semibold text-orange-600 text-sm">
                COP {formatCOP(estadisticas.inversionTotalCOP.toFixed(0))}
              </span>
            </div>
            <div className="border-t pt-2 mt-1">
              <p className="text-xs text-gray-500 mb-1">Ganancia/Pérdida Real</p>
              <span
                className={`font-bold text-lg ${
                  estadisticas.gananciaReal > 0
                    ? "text-green-600"
                    : estadisticas.gananciaReal < 0
                    ? "text-red-600"
                    : "text-gray-600"
                }`}
              >
                {estadisticas.gananciaReal > 0 ? "+" : ""}
                {formatCOP(estadisticas.gananciaReal.toFixed(0))}
              </span>
              <span
                className={`text-xs ml-2 ${
                  estadisticas.roiReal > 0
                    ? "text-green-500"
                    : estadisticas.roiReal < 0
                    ? "text-red-500"
                    : "text-gray-500"
                }`}
              >
                ({estadisticas.roiReal > 0 ? "+" : ""}
                {estadisticas.roiReal.toFixed(1)}%)
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-md border border-gray-200">
          <p className="text-sm text-gray-600 mb-2">Ganancia Total</p>
          <div className="flex flex-col gap-1">
            <span
              className={`font-bold text-xl ${
                estadisticas.totalGananciaCOP > 0
                  ? "text-green-600"
                  : estadisticas.totalGananciaCOP < 0
                  ? "text-red-600"
                  : "text-gray-600"
              }`}
            >
              {estadisticas.totalGananciaCOP > 0 ? "+" : ""}
              COP {formatCOP(estadisticas.totalGananciaCOP.toFixed(0))}
            </span>
            <span className="text-xs text-gray-500">
              {estadisticas.totalGananciaCOP > 0 ? "+" : ""}
              EUR {convert.toEurFromCop(estadisticas.totalGananciaCOP)?.toFixed(2) ?? "0.00"} /{" "}
              {estadisticas.totalGananciaCOP > 0 ? "+" : ""}
              USD {convert.toUsdFromCop(estadisticas.totalGananciaCOP)?.toFixed(2) ?? "0.00"}
            </span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-md border border-gray-200">
          <p className="text-sm text-gray-600 mb-2">ROI (Retorno de Inversión)</p>
          <div className="flex flex-col gap-1">
            <span
              className={`font-bold text-xl ${
                estadisticas.roi > 0
                  ? "text-green-600"
                  : estadisticas.roi < 0
                  ? "text-red-600"
                  : "text-gray-600"
              }`}
            >
              {estadisticas.roi > 0 ? "+" : ""}
              {estadisticas.roi.toFixed(1)}%
            </span>
            <span className="text-xs text-gray-500">
              {estadisticas.cartasVendidas} {estadisticas.cartasVendidas === 1 ? "carta" : "cartas"} vendidas
            </span>
          </div>
        </div>
      </div>

      {/* Estado de Recuperación */}
      <div className="bg-white p-4 rounded-lg shadow-md border border-gray-200 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 mb-1">Estado de Recuperación</p>
            <p className="text-lg font-semibold">
              {estadisticas.estaRecuperado ? (
                <span className="text-green-600">
                  ✅ Inversión Recuperada ({estadisticas.porcentajeRecuperado.toFixed(1)}%)
                </span>
              ) : (
                <span className="text-orange-600">
                  ⚠️ Pendiente de Recuperar ({estadisticas.porcentajeRecuperado.toFixed(1)}%)
                </span>
              )}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-600 mb-1">Faltante</p>
            <p className="text-lg font-semibold text-red-600">
              COP {formatCOP((estadisticas.totalCostoCOP - estadisticas.totalVentasCOP).toFixed(0))}
            </p>
          </div>
        </div>
      </div>

      {/* Tabla de Ventas */}
      <div style={{ height: "70vh", width: "100%" }}>
        <h2 className="text-xl font-bold mb-4 text-gray-800">Detalle de Ventas</h2>
        {sales.length === 0 ? (
          <p className="text-center text-gray-500 mt-8">
            No hay ventas registradas aún.
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

      {/* Modal de Editar Venta */}
      {mostrarModalEditar && ventaEditando && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
            <h2 className="text-2xl font-bold mb-4 text-gray-800">
              Editar Venta
            </h2>
            <p className="text-sm text-gray-600 mb-2">
              Carta: <strong>{ventaEditando.stock_info.card_name}</strong>
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Precio de Venta (COP)
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={
                  precioVentaEditado === ""
                    ? ""
                    : typeof precioVentaEditado === "number"
                    ? precioVentaEditado.toString().replace(".", ",")
                    : precioVentaEditado
                }
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === "" || /^[0-9]*[.,]?[0-9]*$/.test(value)) {
                    const normalizedValue = value.replace(",", ".");
                    if (normalizedValue === "" || normalizedValue === ".") {
                      setPrecioVentaEditado("");
                    } else {
                      const num = parseFloat(normalizedValue);
                      setPrecioVentaEditado(isNaN(num) ? "" : num);
                    }
                  }
                }}
                onBlur={(e) => {
                  const value = e.target.value.replace(",", ".");
                  if (value === "" || value === ".") {
                    setPrecioVentaEditado("");
                  } else {
                    const num = parseFloat(value);
                    setPrecioVentaEditado(isNaN(num) ? "" : num);
                  }
                }}
                className="w-full border border-gray-300 px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Ej: 50000 o 50.000"
                autoFocus
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notas
              </label>
              <textarea
                value={notasEditadas}
                onChange={(e) => setNotasEditadas(e.target.value)}
                className="w-full border border-gray-300 px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder="Notas adicionales..."
              />
            </div>
            {errorEditar && (
              <p className="text-sm text-red-600 mb-4">{errorEditar}</p>
            )}
            <div className="flex gap-3 justify-end">
              <button
                onClick={handleCerrarModalEditar}
                disabled={editando}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancelar
              </button>
              <button
                onClick={handleGuardarEdicion}
                disabled={editando || precioVentaEditado === "" || precioVentaEditado <= 0}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {editando ? "Guardando..." : "Guardar Cambios"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

