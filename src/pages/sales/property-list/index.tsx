import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { useEffect, useState } from "react";
import { formatCOP } from "../../../utils/convert";

type KeepSale = {
  _id: string;
  stock_id: string;
  card_id: string;
  amount_cop: number;
  notes?: string;
  created_at: string;
};

type StockItem = {
  _id: string;
  card_name: string;
  image_url: string;
  card_cost: number;
  currency: string;
  card_state: string;
};

export default function PropertyList() {
  const [stockData, setStockData] = useState<Record<string, StockItem>>({});

  const { data: keepCards = [], isLoading } = useQuery<KeepSale[]>({
    queryKey: ["property-cards"],
    queryFn: async () => {
      const res = await axios.get("http://localhost:3000/sales/keep");
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
          axios.get(`http://localhost:3000/stock/${id}`)
        );
        const responses = await Promise.allSettled(requests);
        const updated: Record<string, StockItem> = {};
        responses.forEach((res, index) => {
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
                  <p className="text-sm text-gray-500 mt-2">Pérdida</p>
                  <p className="font-bold text-rose-600">
                    {stock
                      ? formatCOP(stock.card_cost.toFixed(0))
                      : "COP 0"}
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


