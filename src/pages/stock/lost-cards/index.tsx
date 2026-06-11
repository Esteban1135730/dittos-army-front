import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { apiUrl } from "../../../config/api";
import type { StockLostRow } from "../revision/types";
import { operationalRarezaLabel } from "../../../constants/item-rareza";

export default function StockLostCardsPage() {
  const { data, isLoading, error } = useQuery<{ items: StockLostRow[] }>({
    queryKey: ["stock", "perdidas"],
    queryFn: async () => {
      const res = await axios.get(apiUrl("/stock/perdidas"));
      return res.data;
    },
  });

  if (isLoading) {
    return (
      <p className="text-center text-gray-500 p-6">Cargando cartas perdidas...</p>
    );
  }

  if (error || !data) {
    return (
      <p className="text-center text-red-500 p-6">
        Error al cargar cartas perdidas.
      </p>
    );
  }

  const items = data.items ?? [];

  return (
    <div className="w-full max-w-5xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-2">
        Cartas perdidas de stock
      </h1>
      <p className="text-sm text-gray-600 mb-6">
        Líneas marcadas como perdidas durante revisiones de inventario (
        {items.length}).
      </p>

      {items.length === 0 ? (
        <p className="text-gray-500 text-center py-12 bg-white rounded-lg border">
          No hay cartas perdidas registradas.
        </p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.stock_id}
              className="flex flex-wrap items-center gap-3 p-3 rounded-lg border bg-white border-gray-200"
            >
              {item.image_url ? (
                <img
                  src={item.image_url}
                  alt=""
                  className="w-12 h-auto rounded"
                />
              ) : (
                <div className="w-12 h-16 bg-gray-200 rounded" />
              )}
              <div className="flex-1 min-w-[180px]">
                <p className="font-medium text-gray-900">
                  {item.card_name || item.card_id}
                </p>
                <p className="text-xs text-gray-500">
                  {item.language ? `${item.language} · ` : ""}
                  {item.rareza
                    ? operationalRarezaLabel(item.rareza)
                    : "sin rareza"}
                </p>
              </div>
              <span className="text-sm text-amber-800 font-medium">Perdida</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
