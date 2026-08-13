import { useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  API_CARDTRADER_TRANSIT_LOTS,
  type CardtraderTransitLotRow,
} from "./cardtrader-transit-types";
import { OWNERS_CONFIG, isOwnerKey } from "../../config/owners";

export default function CardtraderTransitListPage() {
  const queryClient = useQueryClient();
  const [mensaje, setMensaje] = useState("");
  const [deletingLotId, setDeletingLotId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery<CardtraderTransitLotRow[]>({
    queryKey: ["cardtrader-transit-lots-open"],
    queryFn: async () => {
      const res = await axios.get(`${API_CARDTRADER_TRANSIT_LOTS}/open`);
      return Array.isArray(res.data) ? (res.data as CardtraderTransitLotRow[]) : [];
    },
  });

  const lots = useMemo(() => data ?? [], [data]);

  const deleteLot = async (lotId: string) => {
    const confirm = window.confirm(
      "¿Eliminar este lote de tránsito CardTrader? Se eliminarán sus líneas.",
    );
    if (!confirm) return;

    try {
      setDeletingLotId(lotId);
      setMensaje("");
      const res = await axios.delete(`${API_CARDTRADER_TRANSIT_LOTS}/${lotId}`);
      if (!res.data?.success) {
        setMensaje(res.data?.message || "No se pudo eliminar el lote.");
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["cardtrader-transit-lots-open"] });
      setMensaje("✅ Lote eliminado.");
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string; error?: string } } };
      setMensaje(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          "No se pudo eliminar el lote.",
      );
    } finally {
      setDeletingLotId(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-4 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Tránsito CardTrader</h1>
          <p className="text-sm text-gray-600 mt-1">
            Lotes registrados desde CT Zero con IDs TCGdex. Fuente operativa actual.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 justify-end">
          <Link
            to="/cardtrader-transit/import"
            className="bg-purple-700 hover:bg-purple-800 text-white px-4 py-2 rounded-md text-sm font-medium"
          >
            Importar desde CT Zero
          </Link>
          <Link
            to="/test-cardtrader"
            className="text-blue-600 hover:underline font-medium text-sm"
          >
            Consolidado tránsito
          </Link>
        </div>
      </div>

      {mensaje ? (
        <p
          className="text-sm mb-3"
          style={{ color: mensaje.startsWith("✅") ? "#0f766e" : "#b91c1c" }}
        >
          {mensaje}
        </p>
      ) : null}

      {isLoading && <p className="text-gray-600">Cargando lotes…</p>}
      {!isLoading && error && (
        <p className="text-red-600">Error cargando lotes. Intenta más tarde.</p>
      )}
      {!isLoading && !error && lots.length === 0 && (
        <p className="text-gray-600">
          No hay lotes abiertos. Importa desde CT Zero para comenzar.
        </p>
      )}

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-gray-50 text-xs font-semibold text-gray-600">
          <div className="col-span-3">Fecha compra</div>
          <div className="col-span-2">Origen</div>
          <div className="col-span-2">Restante</div>
          <div className="col-span-3">Costos (cartas)</div>
          <div className="col-span-2">Acciones</div>
        </div>

        <div className="divide-y divide-gray-100">
          {lots.map((lot) => {
            const ownerKey = isOwnerKey(lot.owner) ? lot.owner : "pablo";
            return (
            <div
              key={lot.lot_id}
              className="grid grid-cols-12 gap-2 px-4 py-3 items-center"
            >
              <div className="col-span-3">
                <p className="font-medium text-gray-800">
                  {new Date(lot.purchase_date).toLocaleDateString("es-CO")}
                </p>
                <p className="text-xs text-gray-500 break-all">{lot.lot_id}</p>
                {lot.ct0_package_key ? (
                  <p className="text-[10px] text-gray-400 mt-0.5">CT0 checkout</p>
                ) : null}
              </div>
              <div className="col-span-2 text-sm text-gray-700">
                {lot.source === "complementos" ? (
                  <span className="inline-flex items-center rounded-full bg-green-100 text-green-800 px-2 py-0.5 text-xs font-semibold">
                    Complementos
                  </span>
                ) : (
                  <span className="uppercase">{lot.source}</span>
                )}
                <span
                  className={`mt-1 flex w-fit items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    ownerKey === "esteban"
                      ? "bg-indigo-100 text-indigo-800"
                      : "bg-slate-100 text-slate-800"
                  }`}
                >
                  {OWNERS_CONFIG.owners[ownerKey].label}
                </span>
              </div>
              <div className="col-span-2 text-sm text-gray-700">
                {lot.remaining_total_quantity}
              </div>
              <div className="col-span-3 text-sm text-gray-700">
                {lot.source === "complementos" ? (
                  <span className="text-green-800 font-medium">Cartas gratis (COP 0)</span>
                ) : (
                  <>
                    {lot.cards_cost_currency} {lot.total_fx_cards_cost.toFixed(2)} lote
                    {lot.registered_items_fx_subtotal != null &&
                    Math.abs(lot.registered_items_fx_subtotal - lot.total_fx_cards_cost) >
                      0.01 ? (
                      <span className="text-gray-500">
                        {" "}
                        · CT0 {lot.registered_items_fx_subtotal.toFixed(2)}
                      </span>
                    ) : null}{" "}
                    / COP {Math.round(lot.total_cop_cards_cost).toLocaleString("es-CO")}
                  </>
                )}
                {lot.legacy_incoming_batch_id ? (
                  <span className="block text-[10px] text-amber-700 mt-0.5">
                    Ref. legacy
                  </span>
                ) : null}
              </div>
              <div className="col-span-2 flex items-center gap-3">
                <Link
                  to={`/cardtrader-transit/lot/${lot.lot_id}`}
                  className="text-blue-600 hover:underline font-medium"
                >
                  Revisar
                </Link>
                <button
                  type="button"
                  onClick={() => deleteLot(lot.lot_id)}
                  disabled={deletingLotId === lot.lot_id}
                  className="text-red-600 hover:underline text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deletingLotId === lot.lot_id ? "Eliminando…" : "Eliminar"}
                </button>
              </div>
            </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
