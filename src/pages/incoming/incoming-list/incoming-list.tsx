import { useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  exportAllOpenIncomingBatchesToPdf,
  type BatchItemPdf,
  type BatchMetaPdf,
} from "../export-incoming-batch-pdf";
import { API_INCOMING } from "../../clientes/cliente-types";

type IncomingBatchItemRow = {
  batch_id: string;
  status: string;
  purchase_date: string;
  created_at: string;
  total_eur_cards_cost: number;
  total_cop_cards_cost: number;
  remaining_total_quantity: number;
};

type IncomingShipRoundRow = {
  round_id: string;
  shipping_total_cop: number;
  status: string;
  created_at: string;
};

export default function IncomingListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [shippingInput, setShippingInput] = useState<string>("");
  const [creatingShipRound, setCreatingShipRound] = useState(false);
  const [mensaje, setMensaje] = useState<string>("");
  const [deletingRoundId, setDeletingRoundId] = useState<string | null>(null);
  const [deletingBatchId, setDeletingBatchId] = useState<string | null>(null);
  const [exportingPdf, setExportingPdf] = useState(false);

  const { data, isLoading, error } = useQuery<IncomingBatchItemRow[]>({
    queryKey: ["incoming-batch-open"],
    queryFn: async () => {
      const res = await axios.get(`${API_INCOMING}/batch/open`);
      return Array.isArray(res.data) ? (res.data as IncomingBatchItemRow[]) : [];
    },
  });

  const batches = useMemo(() => data ?? [], [data]);

  const {
    data: shipRounds = [],
    isLoading: shipRoundsLoading,
    error: shipRoundsError,
  } = useQuery<IncomingShipRoundRow[]>({
    queryKey: ["incoming-ship-round-open"],
    queryFn: async () => {
      const res = await axios.get(`${API_INCOMING}/ship-round/open`);
      return Array.isArray(res.data) ? (res.data as IncomingShipRoundRow[]) : [];
    },
  });

  const createShipRound = async () => {
    setMensaje("");
    const val = parseFloat(shippingInput.replace(",", "."));
    if (!Number.isFinite(val) || val <= 0) {
      setMensaje("Ingresa el total COP del envío de esta tanda.");
      return;
    }

    try {
      setCreatingShipRound(true);
      const res = await axios.post(`${API_INCOMING}/ship-round`, {
        shipping_total_cop: val,
      });
      const roundId = res.data?.round_id as string;
      navigate(`/incoming/ship-round/${roundId}`);
    } catch (e: any) {
      setMensaje(
        e?.response?.data?.message ||
          e?.response?.data?.error ||
          "No se pudo crear la tanda global.",
      );
    } finally {
      setCreatingShipRound(false);
    }
  };

  const deleteShipRound = async (roundId: string) => {
    const confirm = window.confirm(
      "¿Eliminar esta tanda global? Esta acción no se puede deshacer.",
    );
    if (!confirm) return;

    try {
      setDeletingRoundId(roundId);
      setMensaje("");
      const res = await axios.delete(`${API_INCOMING}/ship-round/${roundId}`);
      if (!res.data?.success) {
        setMensaje(res.data?.message || "No se pudo eliminar la tanda.");
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["incoming-ship-round-open"] });
      setMensaje("✅ Tanda eliminada.");
    } catch (e: any) {
      setMensaje(
        e?.response?.data?.message ||
          e?.response?.data?.error ||
          "No se pudo eliminar la tanda.",
      );
    } finally {
      setDeletingRoundId(null);
    }
  };

  const deleteBatch = async (batchId: string) => {
    const confirm = window.confirm(
      "¿Eliminar este batch completo? Se eliminarán sus items de compras en camino.",
    );
    if (!confirm) return;

    try {
      setDeletingBatchId(batchId);
      setMensaje("");
      const res = await axios.delete(`${API_INCOMING}/batch/${batchId}`);
      if (!res.data?.success) {
        setMensaje(res.data?.message || "No se pudo eliminar el batch.");
        return;
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["incoming-batch-open"] }),
        queryClient.invalidateQueries({ queryKey: ["incoming-ship-round-open"] }),
      ]);
      setMensaje("✅ Batch eliminado.");
    } catch (e: any) {
      setMensaje(
        e?.response?.data?.message ||
          e?.response?.data?.error ||
          "No se pudo eliminar el batch.",
      );
    } finally {
      setDeletingBatchId(null);
    }
  };

  const exportarPdfLotesAbiertos = async () => {
    if (batches.length === 0) return;
    setErrorMsg("");
    setExportingPdf(true);
    try {
      const sections = await Promise.all(
        batches.map(async (b) => {
          const [metaRes, itemsRes] = await Promise.all([
            axios.get(`${API_INCOMING}/batch/${b.batch_id}`),
            axios.get(`${API_INCOMING}/batch/${b.batch_id}/items`),
          ]);
          return {
            meta: metaRes.data as BatchMetaPdf,
            items: (Array.isArray(itemsRes.data) ? itemsRes.data : []) as BatchItemPdf[],
          };
        }),
      );
      exportAllOpenIncomingBatchesToPdf(sections);
    } catch {
      setErrorMsg("No se pudo generar el PDF. Revisa la conexión con el servidor.");
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <h1 className="text-2xl font-bold text-gray-800">Compras en camino</h1>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={exportarPdfLotesAbiertos}
            disabled={isLoading || batches.length === 0 || exportingPdf}
            className="bg-slate-700 hover:bg-slate-800 text-white px-4 py-2 rounded font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {exportingPdf ? "Generando PDF…" : "Exportar PDF (lotes abiertos)"}
          </button>
          <button
            type="button"
            onClick={() => navigate("/incoming/new")}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-medium"
          >
            Nueva compra
          </button>
        </div>
      </div>

      {errorMsg ? (
        <p className="text-red-600 text-sm mb-3" role="alert">
          {errorMsg}
        </p>
      ) : null}

      {/* Nueva tanda global */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">
              Tanda global (todas las cartas en camino)
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Ingresa el envío total COP y luego marca arribadas / novedad / pendiente.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3 mt-3">
          <div className="flex-1 min-w-[220px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Total COP del envío
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={shippingInput}
              onChange={(e) => setShippingInput(e.target.value)}
              placeholder="Ej: 350000"
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>
          <button
            type="button"
            onClick={createShipRound}
            disabled={creatingShipRound}
            className="bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {creatingShipRound ? "Creando..." : "Crear tanda"}
          </button>
        </div>

        {mensaje && (
          <p
            className="text-sm mt-3"
            style={{ color: mensaje.includes("No se") ? "#b91c1c" : "#0f766e" }}
          >
            {mensaje}
          </p>
        )}
      </div>

      {/* Tandas globales abiertas */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-4">
        <div className="px-4 py-3 bg-gray-50 text-sm font-semibold text-gray-700">
          Tandas globales abiertas
        </div>
        {shipRoundsLoading && <p className="p-4 text-gray-600">Cargando...</p>}
        {!shipRoundsLoading && shipRoundsError && (
          <p className="p-4 text-red-600">
            Error cargando tandas. Intenta más tarde.
          </p>
        )}
        {!shipRoundsLoading && !shipRoundsError && shipRounds.length === 0 && (
          <p className="p-4 text-gray-600">
            Aún no hay tandas globales abiertas. Crea una tanda para iniciar.
          </p>
        )}
        {!shipRoundsLoading && !shipRoundsError && shipRounds.length > 0 && (
          <div className="divide-y divide-gray-100">
            {shipRounds.map((r) => (
              <div
                key={r.round_id}
                className="grid grid-cols-12 gap-2 px-4 py-3 items-center"
              >
                <div className="col-span-3">
                  <p className="font-medium text-gray-800 break-all">
                    {r.round_id}
                  </p>
                </div>
                <div className="col-span-2 text-sm text-gray-700">{r.status}</div>
                <div className="col-span-4 text-sm text-gray-700">
                  Envío COP:{" "}
                  {Math.round(r.shipping_total_cop).toLocaleString("es-CO")}
                </div>
                <div className="col-span-3 flex items-center gap-3">
                  <Link
                    to={`/incoming/ship-round/${r.round_id}`}
                    className="text-blue-600 hover:underline font-medium"
                  >
                    Revisar
                  </Link>
                  <button
                    type="button"
                    onClick={() => deleteShipRound(r.round_id)}
                    disabled={deletingRoundId === r.round_id}
                    className="text-red-600 hover:underline text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {deletingRoundId === r.round_id ? "Eliminando..." : "Eliminar"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {isLoading && <p className="text-gray-600">Cargando...</p>}
      {!isLoading && error && (
        <p className="text-red-600">Error cargando compras. Intenta más tarde.</p>
      )}

      {!isLoading && !error && batches.length === 0 && (
        <p className="text-gray-600">
          No hay compras en camino abiertas. Crea una nueva para iniciar el proceso.
        </p>
      )}

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-gray-50 text-xs font-semibold text-gray-600">
          <div className="col-span-3">Fecha compra</div>
          <div className="col-span-2">Estado</div>
          <div className="col-span-2">Restante</div>
          <div className="col-span-3">Costos (cartas)</div>
          <div className="col-span-2">Acciones</div>
        </div>

        <div className="divide-y divide-gray-100">
          {batches.map((b) => (
            <div
              key={b.batch_id}
              className="grid grid-cols-12 gap-2 px-4 py-3 items-center"
            >
              <div className="col-span-3">
                <p className="font-medium text-gray-800">
                  {new Date(b.purchase_date).toLocaleDateString("es-CO")}
                </p>
                <p className="text-xs text-gray-500 break-all">{b.batch_id}</p>
              </div>
              <div className="col-span-2 text-sm text-gray-700">{b.status}</div>
              <div className="col-span-2 text-sm text-gray-700">
                {b.remaining_total_quantity}
              </div>
              <div className="col-span-3 text-sm text-gray-700">
                EUR {b.total_eur_cards_cost.toFixed(2)} / COP{" "}
                {Math.round(b.total_cop_cards_cost).toLocaleString("es-CO")}
              </div>
              <div className="col-span-2 flex items-center gap-3">
                <Link
                  to={`/incoming/batch/${b.batch_id}`}
                  className="text-blue-600 hover:underline font-medium"
                >
                  Revisar
                </Link>
                <button
                  type="button"
                  onClick={() => deleteBatch(b.batch_id)}
                  disabled={deletingBatchId === b.batch_id}
                  className="text-red-600 hover:underline text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deletingBatchId === b.batch_id ? "Eliminando..." : "Eliminar"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

