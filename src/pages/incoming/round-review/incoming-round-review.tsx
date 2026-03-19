import axios from "axios";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

type IncomingRoundReviewItem = {
  batch_item_id: string;
  card_id: string;
  card_name: string;
  image_url: string;
  language: string;
  quantity_ordered: number;
  remaining_quantity: number;
  unit_cost_cop: number;
  arrived_quantity: number;
  novedad_quantity: number;
  novedad_notes: string;
};

type IncomingRoundReviewResponse = {
  round_id: string;
  batch_id: string;
  shipping_total_cop: number;
  round_status: string;
  arrived_total_quantity: number;
  items: IncomingRoundReviewItem[];
};

const API_INCOMING = "http://localhost:3000/incoming";

function parseIntOrZero(v: string): number {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export default function IncomingRoundReviewPage() {
  const { batchId, roundId } = useParams<{ batchId: string; roundId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [data, setData] = useState<IncomingRoundReviewResponse | null>(null);

  // Estado editable para decisiones
  const [arrivedByItem, setArrivedByItem] = useState<Record<string, number>>({});
  const [novedadByItem, setNovedadByItem] = useState<Record<string, number>>({});
  const [notesByItem, setNotesByItem] = useState<Record<string, string>>({});

  const [saving, setSaving] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [finalizando, setFinalizando] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!batchId || !roundId) return;
      setLoading(true);
      setError("");
      try {
        const res = await axios.get(
          `${API_INCOMING}/batch/${batchId}/round/${roundId}`,
        );
        const payload = res.data as IncomingRoundReviewResponse;
        setData(payload);

        const nextArrived: Record<string, number> = {};
        const nextNovedad: Record<string, number> = {};
        const nextNotes: Record<string, string> = {};
        payload.items.forEach((it) => {
          nextArrived[it.batch_item_id] = it.arrived_quantity ?? 0;
          nextNovedad[it.batch_item_id] = it.novedad_quantity ?? 0;
          nextNotes[it.batch_item_id] = it.novedad_notes ?? "";
        });
        setArrivedByItem(nextArrived);
        setNovedadByItem(nextNovedad);
        setNotesByItem(nextNotes);
      } catch (e: any) {
        setError(
          e?.response?.data?.message ||
            e?.response?.data?.error ||
            "Error cargando la tanda.",
        );
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [batchId, roundId]);

  const arrivedTotalForPreview = useMemo(() => {
    if (!data) return 0;
    return data.items.reduce(
      (sum, it) => sum + (arrivedByItem[it.batch_item_id] ?? 0),
      0,
    );
  }, [data, arrivedByItem]);

  const shippingPerArrivedCard = useMemo(() => {
    if (!data) return 0;
    if (arrivedTotalForPreview <= 0) return 0;
    return data.shipping_total_cop / arrivedTotalForPreview;
  }, [data, arrivedTotalForPreview]);

  const roundIsFinalized = data?.round_status === "finalized";

  const buildDecisionsPayload = (): any[] => {
    if (!data) return [];
    return data.items.map((it) => {
      const arrived_quantity = arrivedByItem[it.batch_item_id] ?? 0;
      const novedad_quantity = novedadByItem[it.batch_item_id] ?? 0;
      const novedad_notes = notesByItem[it.batch_item_id] ?? "";
      return {
        batch_item_id: it.batch_item_id,
        arrived_quantity,
        novedad_quantity,
        novedad_notes,
      };
    });
  };

  const handleSave = async () => {
    if (!batchId || !roundId || !data) return;
    setMensaje("");

    if (arrivedTotalForPreview <= 0) {
      setMensaje("Debes marcar al menos 1 carta como arribada en esta tanda.");
      return;
    }

    // Validaciones básicas en cliente para evitar rechazos
    for (const it of data.items) {
      const arrived_quantity = arrivedByItem[it.batch_item_id] ?? 0;
      const novedad_quantity = novedadByItem[it.batch_item_id] ?? 0;
      if (arrived_quantity > it.remaining_quantity) {
        setMensaje("arrived_quantity no puede superar remaining_quantity.");
        return;
      }
      if (novedad_quantity > arrived_quantity) {
        setMensaje("novedad_quantity no puede superar arrived_quantity.");
        return;
      }
    }

    try {
      setSaving(true);
      const decisions = buildDecisionsPayload();
      await axios.put(
        `${API_INCOMING}/batch/${batchId}/round/${roundId}/review`,
        { decisions },
      );
      setMensaje("✅ Revisión guardada.");
    } catch (e: any) {
      setMensaje(
        e?.response?.data?.message ||
          e?.response?.data?.error ||
          "No se pudo guardar la revisión.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleFinalize = async () => {
    if (!batchId || !roundId) return;
    if (!data) return;
    if (roundIsFinalized) return;
    setMensaje("");
    try {
      setFinalizando(true);

      // Aseguramos consistencia: al finalizaR la tanda, el backend debe usar
      // las decisiones actuales del estado del UI (no las que quedaron guardadas).
      const decisions = buildDecisionsPayload();
      await axios.put(`${API_INCOMING}/batch/${batchId}/round/${roundId}/review`, {
        decisions,
      });

      const res = await axios.post(
        `${API_INCOMING}/batch/${batchId}/round/${roundId}/finalize`,
      );
      if (res.data?.success) {
        setMensaje("🎉 Tanda finalizada y stock creado.");
        setTimeout(() => navigate(`/incoming/batch/${batchId}`), 1200);
      } else {
        setMensaje("No se pudo finalizar la tanda.");
      }
    } catch (e: any) {
      setMensaje(
        e?.response?.data?.message ||
          e?.response?.data?.error ||
          "Error al finalizar.",
      );
    } finally {
      setFinalizando(false);
    }
  };

  if (loading) return <p className="text-center text-gray-600">Cargando...</p>;
  if (error) return <p className="text-center text-red-600">{error}</p>;
  if (!data) return <p className="text-center text-red-600">Sin datos</p>;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-4 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            Revisión de tanda #{data.round_id}
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Envío COP: {Math.round(data.shipping_total_cop).toLocaleString("es-CO")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate(`/incoming/batch/${batchId}`)}
          className="text-blue-600 hover:underline font-medium"
        >
          ← Volver
        </button>
      </div>

      {/* Preview costos */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex flex-wrap items-start gap-4">
          <div className="min-w-[220px]">
            <p className="text-sm font-semibold text-gray-800">Arribadas (preview)</p>
            <p className="text-lg font-bold text-gray-900">{arrivedTotalForPreview}</p>
          </div>
          <div className="min-w-[220px]">
            <p className="text-sm font-semibold text-gray-800">Envío por carta (COP)</p>
            <p className="text-lg font-bold text-gray-900">
              {arrivedTotalForPreview > 0
                ? Math.round(shippingPerArrivedCard).toLocaleString("es-CO")
                : "—"}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 text-sm font-semibold text-gray-700">
          Cartas por revisar (language + cantidad)
        </div>
        <div className="p-4">
          <div className="space-y-3">
            {data.items.map((it) => {
              const arrived_quantity = arrivedByItem[it.batch_item_id] ?? 0;
              const novedad_quantity = novedadByItem[it.batch_item_id] ?? 0;

              const precioRealArribada = arrived_quantity > 0
                ? it.unit_cost_cop + shippingPerArrivedCard
                : it.unit_cost_cop + shippingPerArrivedCard;
              const precioRealArribadaRounded = Math.round(precioRealArribada);

              return (
                <div
                  key={it.batch_item_id}
                  className="border rounded-lg p-3"
                >
                  <div className="flex items-start gap-4">
                    <img
                      src={it.image_url}
                      alt={it.card_name}
                      className="w-14 h-20 object-contain border rounded bg-gray-50"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 truncate">
                        {it.card_name}
                      </div>
                      <div className="text-xs text-gray-500 break-all">{it.card_id}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        Idioma: {it.language} · Pedido: {it.quantity_ordered} · Pendiente: {it.remaining_quantity}
                      </div>
                      <div className="text-xs text-gray-700 mt-1">
                        COP sin envío (real): {Math.round(it.unit_cost_cop).toLocaleString("es-CO")}
                      </div>
                      <div className="text-xs text-gray-700 mt-1">
                        COP con envío (real):{" "}
                        {arrivedTotalForPreview > 0
                          ? precioRealArribadaRounded.toLocaleString("es-CO")
                          : "—"}
                      </div>
                    </div>
                    <div className="min-w-[280px] space-y-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Arribadas (≤ {it.remaining_quantity})
                        </label>
                        <input
                          type="number"
                          min={0}
                          step={1}
                          disabled={roundIsFinalized}
                          value={arrived_quantity}
                          onChange={(e) => {
                            const next = parseIntOrZero(e.target.value);
                            setArrivedByItem((prev) => ({
                              ...prev,
                              [it.batch_item_id]: next,
                            }));
                            // Si novedad > arrived, la recortamos
                            setNovedadByItem((prev) => {
                              const currentNovedad = prev[it.batch_item_id] ?? 0;
                              if (currentNovedad > next) {
                                return { ...prev, [it.batch_item_id]: next };
                              }
                              return prev;
                            });
                          }}
                          className="w-full px-2 py-1 border rounded-md"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Novedad (≤ arribadas)
                        </label>
                        <input
                          type="number"
                          min={0}
                          step={1}
                          disabled={roundIsFinalized}
                          value={novedad_quantity}
                          onChange={(e) => {
                            const next = parseIntOrZero(e.target.value);
                            setNovedadByItem((prev) => ({
                              ...prev,
                              [it.batch_item_id]: next,
                            }));
                          }}
                          className="w-full px-2 py-1 border rounded-md"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Notas novedad
                        </label>
                        <textarea
                          rows={2}
                          disabled={roundIsFinalized}
                          value={notesByItem[it.batch_item_id] ?? ""}
                          onChange={(e) =>
                            setNotesByItem((prev) => ({
                              ...prev,
                              [it.batch_item_id]: e.target.value,
                            }))
                          }
                          className="w-full px-2 py-1 border rounded-md text-sm"
                          placeholder="Ej: idioma no coincide / condición diferente..."
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {mensaje && (
            <p className="text-sm mt-3" style={{ color: mensaje.includes("✅") ? "#0f766e" : "#b91c1c" }}>
              {mensaje}
            </p>
          )}

          <div className="flex items-center justify-end gap-3 mt-4">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || roundIsFinalized}
              className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-md font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "Guardando..." : "Guardar revisión"}
            </button>
            <button
              type="button"
              onClick={handleFinalize}
              disabled={finalizando || roundIsFinalized || arrivedTotalForPreview <= 0}
              className="bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-md font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {finalizando ? "Finalizando..." : "Finalizar"}
            </button>
          </div>

          {roundIsFinalized && (
            <p className="text-xs text-gray-500 mt-3">
              Esta tanda ya fue finalizada.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

