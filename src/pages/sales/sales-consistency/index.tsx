import { useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { formatCOP } from "../../../utils/convert";
import { useState } from "react";
import { useExchangeRates } from "../../../utils/tasa";
import { apiUrl } from "../../../config/api";
import { CardThumb } from "../../../components/card-thumb";

type OnlyInStockRow = {
  _id: string;
  stock_id: string;
  card_id: string;
  card_name?: string;
  image_url?: string;
};

type ConsistencyResponse = {
  stockVendidas: Array<{ _id: string; stock_id: string; card_id: string }>;
  salesVentas: Array<{
    _id: string;
    stock_id: string;
    card_id: string;
    amount_cop: number;
    created_at: string;
  }>;
  onlyInStock: OnlyInStockRow[];
  onlyInSales: Array<{
    _id: string;
    stock_id: string;
    card_id: string;
    amount_cop: number;
    created_at: string;
  }>;
  summary: {
    totalStockVendida: number;
    totalSales: number;
    onlyInStockCount: number;
    onlyInSalesCount: number;
    matchingCount: number;
  };
};

export default function SalesConsistency() {
  const queryClient = useQueryClient();
  const { convert } = useExchangeRates();
  const [registeringStockId, setRegisteringStockId] = useState<string | null>(null);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [modalPrecioManual, setModalPrecioManual] = useState<OnlyInStockRow | null>(null);
  const [precioManual, setPrecioManual] = useState<string>("");
  const [monedaManual, setMonedaManual] = useState<"COP" | "EUR" | "USD">("COP");
  const [guardandoManual, setGuardandoManual] = useState(false);
  const [errorPrecioManual, setErrorPrecioManual] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery<ConsistencyResponse>({
    queryKey: ["sales-consistency"],
    queryFn: async () => {
      const res = await axios.get(apiUrl("/sales/consistency"));
      return res.data;
    },
  });

  const handleMarcarVendidaAlPvp = async (row: OnlyInStockRow) => {
    setRegisterError(null);
    setRegisteringStockId(row.stock_id);
    try {
      const res = await axios.post<{ success: boolean; message?: string }>(
        apiUrl("/sales/register-from-stock-with-pvp"),
        { stock_id: row.stock_id }
      );
      if (res.data.success) {
        await queryClient.invalidateQueries({ queryKey: ["sales-consistency"] });
        await queryClient.invalidateQueries({ queryKey: ["sales-dashboard"] });
      } else if (res.data.message === "No hay PVP asignado para esta carta") {
        setModalPrecioManual(row);
        setPrecioManual("");
        setMonedaManual("COP");
        setErrorPrecioManual(null);
      } else {
        setRegisterError(res.data.message ?? "Error al registrar la venta.");
      }
    } catch (err: unknown) {
      const msg =
        axios.isAxiosError(err) && err.response?.data?.message
          ? err.response.data.message
          : "Error al registrar la venta al PVP.";
      if (msg.includes("PVP") && msg.toLowerCase().includes("no hay")) {
        setModalPrecioManual(row);
        setPrecioManual("");
        setMonedaManual("COP");
        setErrorPrecioManual(null);
      } else {
        setRegisterError(msg);
      }
    } finally {
      setRegisteringStockId(null);
    }
  };

  const handleCerrarModalPrecioManual = () => {
    setModalPrecioManual(null);
    setPrecioManual("");
    setMonedaManual("COP");
    setErrorPrecioManual(null);
  };

  const handleRegistrarPrecioManual = async () => {
    if (!modalPrecioManual) return;
    const num = parseFloat(precioManual.replace(",", "."));
    if (isNaN(num) || num < 0) {
      setErrorPrecioManual("Ingresa un precio válido (número mayor o igual a 0).");
      return;
    }
    let amountCop = num;
    if (monedaManual === "EUR") {
      amountCop = convert.toCopFromEur(num) ?? 0;
    } else if (monedaManual === "USD") {
      amountCop = convert.toCopFromUsd(num) ?? 0;
    }
    setErrorPrecioManual(null);
    setGuardandoManual(true);
    try {
      await axios.post(apiUrl("/sales/sell"), {
        stock_id: modalPrecioManual.stock_id,
        card_id: modalPrecioManual.card_id,
        amount_cop: Math.round(amountCop),
        notes: "Registrado desde consistencia (precio manual).",
      });
      await queryClient.invalidateQueries({ queryKey: ["sales-consistency"] });
      await queryClient.invalidateQueries({ queryKey: ["sales-dashboard"] });
      handleCerrarModalPrecioManual();
    } catch (err: unknown) {
      const msg =
        axios.isAxiosError(err) && err.response?.data?.message
          ? err.response.data.message
          : "Error al registrar la venta.";
      setErrorPrecioManual(msg);
    } finally {
      setGuardandoManual(false);
    }
  };

  if (isLoading) {
    return (
      <p className="text-center text-gray-500 p-6">Cargando comparación...</p>
    );
  }

  if (error || !data) {
    return (
      <p className="text-center text-red-500 p-6">
        Error al cargar la consistencia. Revisa que el backend esté en marcha.
      </p>
    );
  }

  const { summary, onlyInStock, onlyInSales, stockVendidas, salesVentas } = data;

  return (
    <div className="w-full max-w-6xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-2">
        Consistencia: Stock vendida vs tabla Sales
      </h1>
      <p className="text-sm text-gray-600 mb-6">
        Comparación entre cartas marcadas como vendidas en stock y los
        registros en la tabla de ventas.
      </p>

      {/* Resumen */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
          <p className="text-xs text-gray-500 uppercase">Stock vendida</p>
          <p className="text-xl font-bold text-gray-800">
            {summary.totalStockVendida}
          </p>
          <p className="text-xs text-gray-600">cartas con estado vendida</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
          <p className="text-xs text-gray-500 uppercase">Registros en Sales</p>
          <p className="text-xl font-bold text-gray-800">{summary.totalSales}</p>
          <p className="text-xs text-gray-600">ventas en tabla sales</p>
        </div>
        <div className="bg-green-50 p-4 rounded-lg shadow border border-green-200">
          <p className="text-xs text-green-700 uppercase">Coinciden</p>
          <p className="text-xl font-bold text-green-800">
            {summary.matchingCount}
          </p>
          <p className="text-xs text-green-600">stock vendida con venta</p>
        </div>
        <div className="bg-amber-50 p-4 rounded-lg shadow border border-amber-200">
          <p className="text-xs text-amber-700 uppercase">Solo en Stock</p>
          <p className="text-xl font-bold text-amber-800">
            {summary.onlyInStockCount}
          </p>
          <p className="text-xs text-amber-600">
            vendida en stock sin registro en sales
          </p>
        </div>
        <div className="bg-rose-50 p-4 rounded-lg shadow border border-rose-200">
          <p className="text-xs text-rose-700 uppercase">Solo en Sales</p>
          <p className="text-xl font-bold text-rose-800">
            {summary.onlyInSalesCount}
          </p>
          <p className="text-xs text-rose-600">
            registro en sales sin stock vendida
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tabla: Solo en Stock (vendida sin venta) */}
        <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
          <h2 className="text-lg font-semibold text-gray-800 p-4 border-b bg-amber-50 border-amber-200">
            Solo en Stock — Marcadas vendida pero sin registro en Sales (
            {onlyInStock.length})
          </h2>
          {registerError && (
            <p className="px-4 py-2 bg-red-50 text-red-700 text-sm border-b border-red-100">
              {registerError}
            </p>
          )}
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            {onlyInStock.length === 0 ? (
              <p className="p-4 text-gray-500 text-sm">
                No hay diferencias. Todas las cartas vendida tienen registro en
                sales.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-100 sticky top-0">
                  <tr>
                    <th className="text-left p-2 w-16">Imagen</th>
                    <th className="text-left p-2">Nombre</th>
                    <th className="text-left p-2">card_id</th>
                    <th className="text-left p-2 font-mono text-xs">stock_id</th>
                    <th className="text-left p-2 w-44">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {onlyInStock.map((row) => (
                    <tr key={row._id} className="border-b border-gray-100 align-middle">
                      <td className="p-2">
                        <CardThumb
                          src={row.image_url}
                          alt={row.card_name ?? row.card_id ?? "carta"}
                          size="md"
                          enlargeOnHover
                        />
                      </td>
                      <td className="p-2 font-medium text-gray-800">
                        {row.card_name || row.card_id || "—"}
                      </td>
                      <td className="p-2 text-gray-600">{row.card_id}</td>
                      <td className="p-2 font-mono text-xs text-gray-500">{row.stock_id}</td>
                      <td className="p-2">
                        <button
                          type="button"
                          onClick={() => handleMarcarVendidaAlPvp(row)}
                          disabled={registeringStockId !== null}
                          className="px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded text-xs font-medium"
                        >
                          {registeringStockId === row.stock_id
                            ? "Registrando..."
                            : "Marcar como vendida al PVP"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Tabla: Solo en Sales (venta sin stock vendida) */}
        <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
          <h2 className="text-lg font-semibold text-gray-800 p-4 border-b bg-rose-50 border-rose-200">
            Solo en Sales — Registro de venta sin stock vendida (
            {onlyInSales.length})
          </h2>
          <div className="overflow-x-auto max-h-80 overflow-y-auto">
            {onlyInSales.length === 0 ? (
              <p className="p-4 text-gray-500 text-sm">
                No hay diferencias. Todos los registros de venta tienen su stock
                marcado como vendida.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-100 sticky top-0">
                  <tr>
                    <th className="text-left p-2">stock_id</th>
                    <th className="text-left p-2">card_id</th>
                    <th className="text-right p-2">amount_cop</th>
                    <th className="text-left p-2">created_at</th>
                  </tr>
                </thead>
                <tbody>
                  {onlyInSales.map((row) => (
                    <tr key={row._id} className="border-b border-gray-100">
                      <td className="p-2 font-mono text-xs">{row.stock_id}</td>
                      <td className="p-2">{row.card_id}</td>
                      <td className="p-2 text-right">
                        {formatCOP(row.amount_cop.toFixed(0))}
                      </td>
                      <td className="p-2 text-gray-600">
                        {row.created_at
                          ? new Date(row.created_at).toLocaleString("es-ES")
                          : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Listados completos colapsables */}
      <details className="mt-8 bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        <summary className="p-4 cursor-pointer font-semibold text-gray-800 hover:bg-gray-50">
          Ver listado completo: todas las cartas vendida en stock (
          {stockVendidas.length})
        </summary>
        <div className="overflow-x-auto max-h-60 overflow-y-auto border-t">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 sticky top-0">
              <tr>
                <th className="text-left p-2">stock_id</th>
                <th className="text-left p-2">card_id</th>
              </tr>
            </thead>
            <tbody>
              {stockVendidas.map((row) => (
                <tr key={row._id} className="border-b border-gray-100">
                  <td className="p-2 font-mono text-xs">{row.stock_id}</td>
                  <td className="p-2">{row.card_id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      <details className="mt-4 bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        <summary className="p-4 cursor-pointer font-semibold text-gray-800 hover:bg-gray-50">
          Ver listado completo: todos los registros en Sales (
          {salesVentas.length})
        </summary>
        <div className="overflow-x-auto max-h-60 overflow-y-auto border-t">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 sticky top-0">
              <tr>
                <th className="text-left p-2">sale _id</th>
                <th className="text-left p-2">stock_id</th>
                <th className="text-left p-2">card_id</th>
                <th className="text-right p-2">amount_cop</th>
                <th className="text-left p-2">created_at</th>
              </tr>
            </thead>
            <tbody>
              {salesVentas.map((row) => (
                <tr key={row._id} className="border-b border-gray-100">
                  <td className="p-2 font-mono text-xs">{row._id}</td>
                  <td className="p-2 font-mono text-xs">{row.stock_id}</td>
                  <td className="p-2">{row.card_id}</td>
                  <td className="p-2 text-right">
                    {formatCOP(row.amount_cop.toFixed(0))}
                  </td>
                  <td className="p-2 text-gray-600">
                    {row.created_at
                      ? new Date(row.created_at).toLocaleString("es-ES")
                      : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      {/* Modal: precio manual cuando no hay PVP */}
      {modalPrecioManual && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">
              Precio de venta manual
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Esta carta no tiene PVP asignado. Indica el precio de venta para
              registrar la venta en la tabla Sales.
            </p>
            <div className="flex items-center gap-3 mb-4 p-3 bg-gray-50 rounded-lg">
              <CardThumb
                src={modalPrecioManual.image_url}
                alt={modalPrecioManual.card_name ?? modalPrecioManual.card_id}
                size="lg"
              />
              <div>
                <p className="font-medium text-gray-800">
                  {modalPrecioManual.card_name || modalPrecioManual.card_id}
                </p>
                <p className="text-xs text-gray-500">{modalPrecioManual.card_id}</p>
              </div>
            </div>
            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Precio
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={precioManual}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "" || /^[0-9]*[.,]?[0-9]*$/.test(v)) setPrecioManual(v);
                  }}
                  placeholder="Ej: 50000 o 10.50"
                  className="w-full border border-gray-300 px-3 py-2 rounded focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Moneda
                </label>
                <select
                  value={monedaManual}
                  onChange={(e) => setMonedaManual(e.target.value as "COP" | "EUR" | "USD")}
                  className="w-full border border-gray-300 px-3 py-2 rounded focus:ring-2 focus:ring-green-500 focus:border-green-500"
                >
                  <option value="COP">COP</option>
                  <option value="EUR">EUR</option>
                  <option value="USD">USD</option>
                </select>
              </div>
            </div>
            {errorPrecioManual && (
              <p className="text-sm text-red-600 mb-4">{errorPrecioManual}</p>
            )}
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={handleCerrarModalPrecioManual}
                disabled={guardandoManual}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleRegistrarPrecioManual}
                disabled={guardandoManual}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {guardandoManual ? "Registrando..." : "Registrar venta"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
