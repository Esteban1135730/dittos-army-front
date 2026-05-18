import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../../../api/client";
import { useEffect, useMemo, useState } from "react";
import { formatCOP } from "../../../utils/convert";
import { useExchangeRates } from "../../../utils/tasa";
import type { StockListItem } from "../../../types/stock";

type KeepSale = {
  _id: string;
  stock_id: string;
  card_id: string;
  amount_cop: number;
  notes?: string;
  created_at: string;
};

type StockItem = Pick<
  StockListItem,
  "_id" | "card_name" | "image_url" | "card_cost" | "currency" | "card_state"
>;

export default function PropertyList() {
  const { convert } = useExchangeRates();
  const [stockData, setStockData] = useState<Record<string, StockItem>>({});

  const { data: keepCards = [], isLoading } = useQuery<KeepSale[]>({
    queryKey: ["property-cards"],
    queryFn: async () => {
      const res = await apiClient.get("/sales/keep");
      return res.data;
    },
  });

  useEffect(() => {
    const fetchStocks = async () => {
      const pendingIds = keepCards
        .map((sale) => sale.stock_id)
        .filter((id) => !stockData[id]);

      if (pendingIds.length === 0) return;

      try {
        const requests = pendingIds.map((id) =>
          apiClient.get(`/stock/${id}`)
        );
        const responses = await Promise.allSettled(requests);
        const updated: Record<string, StockItem> = {};
        responses.forEach((res) => {
          if (res.status === "fulfilled" && res.value?.data?._id) {
            updated[res.value.data._id] = res.value.data;
          }
        });
        if (Object.keys(updated).length > 0) {
          setStockData((prev) => ({ ...prev, ...updated }));
        }
      } catch (error) {
        console.log("No se pudo cargar información de algunas cartas.");
      }
    };

    if (keepCards.length > 0) {
      fetchStocks();
    }
  }, [keepCards]);

  const valorInvertidoCOP = useMemo(() => {
    let total = 0;
    keepCards.forEach((sale) => {
      const stock = stockData[sale.stock_id];
      if (!stock?.card_cost) return;
      const moneda = stock.currency;
      if (moneda === "COP") {
        total += stock.card_cost;
      } else if (moneda === "EUR") {
        total += convert.toCopFromEur(stock.card_cost) ?? 0;
      } else if (moneda === "USD") {
        total += convert.toCopFromUsd(stock.card_cost) ?? 0;
      }
    });
    return total;
  }, [keepCards, stockData, convert]);

  if (isLoading) {
    return <p className="text-center text-gray-500">Cargando cartas...</p>;
  }

  return (
    <div className="max-w-5xl mx-auto mt-10 bg-white shadow rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-800">
          Cartas marcadas como propiedad
        </h1>
        <p className="text-sm text-gray-500">
          Total: {keepCards.length}{" "}
          {keepCards.length === 1 ? "carta" : "cartas"}
        </p>
      </div>

      {keepCards.length > 0 && (
        <div className="mb-6 p-4 rounded-lg border border-gray-200 bg-gray-50 shadow-sm">
          <p className="text-sm text-gray-600 mb-1">Valor invertido en estas cartas</p>
          <p className="text-xl font-bold text-gray-800">
            COP {formatCOP(valorInvertidoCOP.toFixed(0))}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            EUR {convert.toEurFromCop(valorInvertidoCOP)?.toFixed(2) ?? "0.00"} / USD{" "}
            {convert.toUsdFromCop(valorInvertidoCOP)?.toFixed(2) ?? "0.00"}
          </p>
        </div>
      )}

      {keepCards.length === 0 ? (
        <p className="text-center text-gray-500">
          No tienes cartas marcadas como propiedad.
        </p>
      ) : (
        <div className="space-y-4">
          {keepCards.map((sale) => {
            const stock = stockData[sale.stock_id];
            return (
              <div
                key={sale._id}
                className="flex items-center gap-4 border rounded-lg p-4 shadow-sm bg-rose-50"
              >
                <img
                  src={stock?.image_url}
                  alt={stock?.card_name}
                  className="w-20 h-28 object-contain rounded border"
                />
                <div className="flex-1">
                  <h2 className="text-lg font-semibold text-gray-800">
                    {stock?.card_name || sale.card_id}
                  </h2>
                  <p className="text-sm text-gray-600">
                    ID Stock: {sale.stock_id}
                  </p>
                  <p className="text-sm text-gray-600">
                    Precio compra:{" "}
                    {stock
                      ? `${stock.currency} ${stock.card_cost.toFixed(2)}`
                      : "N/A"}
                  </p>
                  {sale.notes && (
                    <p className="text-sm text-gray-600">
                      Nota: {sale.notes}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">Fecha</p>
                  <p className="font-semibold text-gray-800">
                    {new Date(sale.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


