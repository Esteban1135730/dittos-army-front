import axios from "axios";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { DataGrid, type GridColDef } from "@mui/x-data-grid";
import {
  compareIncomingLinesByOldest,
  distributeFifo,
  incomingVariantGroupKey,
  weightedAverageUnitCostCop,
} from "../../../utils/incoming-variant-group";
import { API_INCOMING } from "../../clientes/cliente-types";
import { CardThumb } from "../../../components/card-thumb";

type IncomingShipRoundReviewItem = {
  batch_item_id: string;
  card_id: string;
  card_name: string;
  image_url: string;
  language: string;
  quantity_ordered: number;
  remaining_quantity: number;
  unit_cost_cop: number;
  rareza?: string | null;
  arrived_quantity: number;
  novedad_quantity: number;
  novedad_notes: string;
  batch_purchase_date?: string | null;
  item_created_at?: string | null;
};

type IncomingShipRoundReviewResponse = {
  round_id: string;
  shipping_total_cop: number;
  round_status: string;
  arrived_total_quantity: number;
  items: IncomingShipRoundReviewItem[];
};

/** Una fila de UI por variante (carta + rareza + idioma); costo unitario = promedio ponderado por unidades en camino. */
type GroupedShipRoundRow = {
  id: string;
  lines: IncomingShipRoundReviewItem[];
  ref: IncomingShipRoundReviewItem;
  remaining_total: number;
  quantity_ordered_total: number;
  unit_cost_cop_ref: number;
};

function groupNotesDisplay(
  lines: IncomingShipRoundReviewItem[],
  notesByItem: Record<string, string>,
): string {
  const sorted = [...lines].sort(compareIncomingLinesByOldest);
  for (const l of sorted) {
    const raw = notesByItem[l.batch_item_id] ?? "";
    if (raw.trim()) return raw;
  }
  return "";
}

/** Enteros >= 0 (permite 0 explícito). */
function parseNonNegativeInt(v: string): number {
  const n = parseInt(v, 10);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

function axiosErrorMessage(e: unknown, fallback: string): string {
  const err = e as {
    response?: { data?: { message?: string; error?: string } };
    message?: string;
  };
  return (
    err?.response?.data?.message ||
    err?.response?.data?.error ||
    err?.message ||
    fallback
  );
}

export default function IncomingShipRoundReviewPage() {
  const { roundId } = useParams<{ roundId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [data, setData] = useState<IncomingShipRoundReviewResponse | null>(null);

  const [arrivedByItem, setArrivedByItem] = useState<Record<string, number>>({});
  const [novedadByItem, setNovedadByItem] = useState<Record<string, number>>({});
  const [notesByItem, setNotesByItem] = useState<Record<string, string>>({});

  const [busqueda, setBusqueda] = useState("");

  const [saving, setSaving] = useState(false);
  const [finalizando, setFinalizando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  /** Ediciones locales respecto al último GET /review (arribadas, novedad, notas). */
  const [formDirty, setFormDirty] = useState(false);
  const [syncingMissing, setSyncingMissing] = useState(false);

  const reloadRound = useCallback(async (): Promise<IncomingShipRoundReviewResponse | null> => {
    if (!roundId) return null;
    const res = await axios.get(`${API_INCOMING}/ship-round/${roundId}`);
    const payload = res.data as IncomingShipRoundReviewResponse;
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
    setFormDirty(false);
    return payload;
  }, [roundId]);

  useEffect(() => {
    const load = async () => {
      if (!roundId) return;
      setLoading(true);
      setError("");
      try {
        await reloadRound();
      } catch (e: unknown) {
        setError(
          axiosErrorMessage(e, "Error cargando la tanda global."),
        );
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [roundId, reloadRound]);

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

  const groupedShipRoundRows = useMemo((): GroupedShipRoundRow[] => {
    if (!data?.items?.length) return [];
    const map = new Map<string, IncomingShipRoundReviewItem[]>();
    for (const it of data.items) {
      const k = incomingVariantGroupKey(it.card_id, it.rareza, it.language);
      const arr = map.get(k) ?? [];
      arr.push(it);
      map.set(k, arr);
    }
    const out: GroupedShipRoundRow[] = [];
    for (const [id, lines] of map) {
      const sorted = [...lines].sort(compareIncomingLinesByOldest);
      const ref = sorted[0];
      out.push({
        id,
        lines: sorted,
        ref,
        remaining_total: sorted.reduce((s, x) => s + x.remaining_quantity, 0),
        quantity_ordered_total: sorted.reduce((s, x) => s + x.quantity_ordered, 0),
        unit_cost_cop_ref: weightedAverageUnitCostCop(sorted),
      });
    }
    return out;
  }, [data]);

  const groupedFiltrados = useMemo(() => {
    const t = busqueda.trim().toLowerCase();
    if (!t) return groupedShipRoundRows;
    return groupedShipRoundRows.filter((g) =>
      g.lines.some((it) => {
        const name = (it.card_name ?? "").toLowerCase();
        const cid = (it.card_id ?? "").toLowerCase();
        const lang = (it.language ?? "").toLowerCase();
        const rz = (it.rareza ?? "").toString().toLowerCase();
        return (
          name.includes(t) ||
          cid.includes(t) ||
          lang.includes(t) ||
          rz.includes(t)
        );
      }),
    );
  }, [groupedShipRoundRows, busqueda]);

  const sumArrivedGroup = useCallback(
    (lines: IncomingShipRoundReviewItem[]) =>
      lines.reduce((s, l) => s + (arrivedByItem[l.batch_item_id] ?? 0), 0),
    [arrivedByItem],
  );

  const sumNovedadGroup = useCallback(
    (lines: IncomingShipRoundReviewItem[]) =>
      lines.reduce((s, l) => s + (novedadByItem[l.batch_item_id] ?? 0), 0),
    [novedadByItem],
  );

  const applyGroupArrived = useCallback(
    (lines: IncomingShipRoundReviewItem[], total: number) => {
      setFormDirty(true);
      const sorted = [...lines].sort(compareIncomingLinesByOldest);
      const caps = sorted.map((l) => l.remaining_quantity);
      const parts = distributeFifo(caps, total);
      setArrivedByItem((prev) => {
        const next = { ...prev };
        sorted.forEach((l, i) => {
          next[l.batch_item_id] = parts[i];
        });
        return next;
      });
      setNovedadByItem((prev) => {
        const next = { ...prev };
        sorted.forEach((l, i) => {
          const nv = prev[l.batch_item_id] ?? 0;
          next[l.batch_item_id] = Math.min(nv, parts[i]);
        });
        return next;
      });
    },
    [],
  );

  const applyGroupNovedad = useCallback(
    (lines: IncomingShipRoundReviewItem[], totalNovedad: number) => {
      setFormDirty(true);
      const sorted = [...lines].sort(compareIncomingLinesByOldest);
      setNovedadByItem((prev) => {
        const arrivedCaps = sorted.map((l) => arrivedByItem[l.batch_item_id] ?? 0);
        const parts = distributeFifo(arrivedCaps, totalNovedad);
        const next = { ...prev };
        sorted.forEach((l, i) => {
          next[l.batch_item_id] = parts[i];
        });
        return next;
      });
    },
    [arrivedByItem],
  );

  const applyGroupNotes = useCallback((lines: IncomingShipRoundReviewItem[], note: string) => {
    setFormDirty(true);
    setNotesByItem((prev) => {
      const next = { ...prev };
      for (const l of lines) {
        next[l.batch_item_id] = note;
      }
      return next;
    });
  }, []);

  const buildDecisionsPayload = (): Array<{
    batch_item_id: string;
    arrived_quantity: number;
    novedad_quantity: number;
    novedad_notes: string;
  }> => {
    if (!data) return [];
    return data.items.map((it) => ({
      batch_item_id: it.batch_item_id,
      arrived_quantity: arrivedByItem[it.batch_item_id] ?? 0,
      novedad_quantity: novedadByItem[it.batch_item_id] ?? 0,
      novedad_notes: notesByItem[it.batch_item_id] ?? "",
    }));
  };

  const persistReview = async (): Promise<boolean> => {
    if (!roundId || !data) return false;
    await axios.put(`${API_INCOMING}/ship-round/${roundId}/review`, {
      decisions: buildDecisionsPayload(),
    });
    await reloadRound();
    return true;
  };

  const handleSave = async () => {
    if (!roundId || !data) return;
    setMensaje("");
    if (arrivedTotalForPreview <= 0) {
      setMensaje("Debes marcar al menos 1 carta como arribada.");
      return;
    }

    try {
      setSaving(true);
      await persistReview();
      setMensaje("✅ Revisión guardada.");
    } catch (e: unknown) {
      setMensaje(axiosErrorMessage(e, "No se pudo guardar la revisión."));
    } finally {
      setSaving(false);
    }
  };

  /** Persiste en servidor las cantidades/notas actuales aunque no haya arribadas (p. ej. antes de salir de la pantalla). */
  const handleSaveCurrentState = async () => {
    if (!roundId || !data) return;
    setMensaje("");
    try {
      setSaving(true);
      await persistReview();
      setMensaje("✅ Estado actual guardado.");
    } catch (e: unknown) {
      setMensaje(axiosErrorMessage(e, "No se pudo guardar el estado actual."));
    } finally {
      setSaving(false);
    }
  };

  const handleSyncMissingItems = useCallback(async () => {
    if (!roundId || !data) return;
    if (formDirty) {
      const ok = window.confirm(
        "Tienes cambios sin guardar en esta pantalla. Si continúas se descartarán al recargar la tanda. ¿Deseas incorporar líneas nuevas en camino de todas formas?",
      );
      if (!ok) return;
    }
    setMensaje("");
    try {
      setSyncingMissing(true);
      const res = await axios.post(
        `${API_INCOMING}/ship-round/${roundId}/sync-missing-items`,
      );
      const added = Number(res.data?.added ?? 0);
      await reloadRound();
      setMensaje(
        added > 0
          ? `✅ Se incorporaron ${added} línea(s) nueva(s) en camino.`
          : "✅ No había líneas nuevas en camino por incorporar.",
      );
    } catch (e: unknown) {
      setMensaje(axiosErrorMessage(e, "No se pudieron incorporar líneas nuevas."));
    } finally {
      setSyncingMissing(false);
    }
  }, [roundId, data, formDirty, reloadRound]);

  const handleFinalize = async () => {
    if (!roundId || !data) return;
    setMensaje("");
    if (arrivedTotalForPreview <= 0) {
      setMensaje("Debes marcar al menos 1 carta como arribada.");
      return;
    }

    try {
      setFinalizando(true);
      await axios.put(`${API_INCOMING}/ship-round/${roundId}/review`, {
        decisions: buildDecisionsPayload(),
      });
      await reloadRound();

      const res = await axios.post(
        `${API_INCOMING}/ship-round/${roundId}/finalize`,
      );
      if (res.data?.success) {
        setMensaje("🎉 Tanda finalizada. Convirtiendo stock...");
        setTimeout(() => navigate("/incoming-v2"), 1000);
      } else {
        setMensaje("No se pudo finalizar.");
      }
    } catch (e: unknown) {
      setMensaje(axiosErrorMessage(e, "Error al finalizar."));
    } finally {
      setFinalizando(false);
    }
  };

  const columns: GridColDef<GroupedShipRoundRow>[] = useMemo(
    () => [
      {
        field: "image_url",
        headerName: "",
        width: 100,
        sortable: false,
        filterable: false,
        renderCell: (p) => (
          <CardThumb
            src={p.row.ref.image_url}
            alt={p.row.ref.card_name}
            size="md"
            enlargeOnHover
          />
        ),
      },
      {
        field: "card_name",
        headerName: "Carta",
        flex: 1,
        minWidth: 160,
        renderCell: (p) => (
          <div className="py-1 min-w-0">
            <div className="font-medium text-gray-900 truncate">{p.row.ref.card_name}</div>
            <div className="text-xs text-gray-500 truncate">{p.row.ref.card_id}</div>
            {p.row.lines.length > 1 ? (
              <div className="text-[11px] text-gray-400 mt-0.5">
                {p.row.lines.length} líneas de lote · pedido total {p.row.quantity_ordered_total}
              </div>
            ) : null}
          </div>
        ),
      },
      {
        field: "language",
        headerName: "Idioma",
        width: 96,
        sortable: false,
        filterable: false,
        renderCell: (p) => (
          <span className="text-sm text-gray-700">
            {p.row.ref.language?.trim() || "—"}
          </span>
        ),
      },
      {
        field: "rareza",
        headerName: "Rareza",
        width: 104,
        sortable: false,
        filterable: false,
        renderCell: (p) => (
          <span className="text-sm text-gray-600">{p.row.ref.rareza?.trim() || "—"}</span>
        ),
      },
      {
        field: "remaining_total",
        headerName: "En camino",
        width: 100,
        type: "number",
        align: "right",
        headerAlign: "right",
      },
      {
        field: "unit_cost_cop_ref",
        headerName: "Costo COP (prom.)",
        width: 130,
        align: "right",
        headerAlign: "right",
        valueFormatter: (v) =>
          typeof v === "number" ? Math.round(v).toLocaleString("es-CO") : "",
      },
      {
        field: "arrived_quantity",
        headerName: "Arribadas",
        width: 120,
        sortable: false,
        filterable: false,
        renderCell: (p) => {
          const g = p.row;
          const max = g.remaining_total;
          const val = sumArrivedGroup(g.lines);
          return (
            <input
              type="number"
              min={0}
              step={1}
              disabled={roundIsFinalized}
              value={val}
              onChange={(e) => {
                const next = Math.min(max, parseNonNegativeInt(e.target.value));
                applyGroupArrived(g.lines, next);
              }}
              className="w-full max-w-[104px] px-2 py-1 border rounded-md text-sm"
              title={`Máximo ${max} (todas las líneas de la variante)`}
            />
          );
        },
      },
      {
        field: "novedad_quantity",
        headerName: "Novedad",
        width: 110,
        sortable: false,
        filterable: false,
        renderCell: (p) => {
          const g = p.row;
          const cap = sumArrivedGroup(g.lines);
          const val = sumNovedadGroup(g.lines);
          return (
            <input
              type="number"
              min={0}
              step={1}
              disabled={roundIsFinalized}
              value={val}
              onChange={(e) => {
                const next = Math.min(cap, parseNonNegativeInt(e.target.value));
                applyGroupNovedad(g.lines, next);
              }}
              className="w-full max-w-[96px] px-2 py-1 border rounded-md text-sm"
            />
          );
        },
      },
      {
        field: "novedad_notes",
        headerName: "Notas novedad",
        flex: 1,
        minWidth: 180,
        sortable: false,
        renderCell: (p) => {
          const g = p.row;
          return (
            <textarea
              rows={2}
              disabled={roundIsFinalized}
              value={groupNotesDisplay(g.lines, notesByItem)}
              onChange={(e) => applyGroupNotes(g.lines, e.target.value)}
              className="w-full min-w-[160px] px-2 py-1 border rounded-md text-xs resize-y"
              placeholder="Ej: idioma / condición..."
              onClick={(e) => e.stopPropagation()}
            />
          );
        },
      },
    ],
    [
      sumArrivedGroup,
      sumNovedadGroup,
      applyGroupArrived,
      applyGroupNovedad,
      applyGroupNotes,
      notesByItem,
      roundIsFinalized,
    ],
  );

  if (loading) return <p className="text-center text-gray-600">Cargando...</p>;
  if (error) return <p className="text-center text-red-600">{error}</p>;
  if (!data) return <p className="text-center text-red-600">Sin datos</p>;

  return (
    <div className="max-w-[1400px] mx-auto px-2">
      <div className="flex items-center justify-between gap-4 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            Revisión tanda global #{data.round_id}
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Envío total COP:{" "}
            {Math.round(data.shipping_total_cop).toLocaleString("es-CO")}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Usa &quot;Guardar estado actual&quot; para volcar en el servidor lo que llevas
            registrado (incluso sin arribadas) antes de salir. Al finalizar se guardan
            primero las cantidades y luego se crean las líneas de stock.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate("/incoming-v2")}
          className="text-blue-600 hover:underline font-medium shrink-0"
        >
          ← Volver
        </button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex flex-wrap items-start gap-6">
          <div className="min-w-[180px]">
            <p className="text-sm font-semibold text-gray-800">
              Arribadas (vista previa)
            </p>
            <p className="text-lg font-bold text-gray-900">{arrivedTotalForPreview}</p>
          </div>
          <div className="min-w-[180px]">
            <p className="text-sm font-semibold text-gray-800">
              Envío por carta (COP)
            </p>
            <p className="text-lg font-bold text-gray-900">
              {arrivedTotalForPreview > 0
                ? Math.round(shippingPerArrivedCard).toLocaleString("es-CO")
                : "—"}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-4">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex flex-wrap items-end justify-between gap-3">
          <div className="flex-1 min-w-[200px] max-w-xl">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Buscar (nombre, ID carta, idioma, rareza)
            </label>
            <input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-md text-sm"
              placeholder="Filtrar filas de la tabla..."
            />
            {busqueda.trim() !== "" && (
              <p className="text-xs text-gray-600 mt-2">
                Mostrando {groupedFiltrados.length} de {groupedShipRoundRows.length} variantes (
                {data.items.length} líneas de lote)
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => void handleSyncMissingItems()}
            disabled={
              roundIsFinalized || saving || finalizando || syncingMissing
            }
            className="shrink-0 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            title="Añade al listado las líneas de lote en camino creadas después de abrir esta tanda"
          >
            {syncingMissing ? "Cargando…" : "Cargar objetos no existentes"}
          </button>
        </div>

        <div className="p-2">
          {data.items.length === 0 ? (
            <p className="text-gray-600 p-4">
              No hay cartas en camino para revisar.
            </p>
          ) : (
            <DataGrid
              rows={groupedFiltrados}
              columns={columns}
              getRowId={(row) => row.id}
              rowHeight={104}
              getRowClassName={(params) => {
                const g = params.row as GroupedShipRoundRow;
                const arrived = sumArrivedGroup(g.lines);
                if (arrived !== g.remaining_total) return "ship-round-row-mismatch";
                return "";
              }}
              pageSizeOptions={[20, 30, 50]}
              initialState={{
                pagination: {
                  paginationModel: { pageSize: 20, page: 0 },
                },
              }}
              pagination
              disableRowSelectionOnClick
              autoHeight
              sx={{
                border: "none",
                "& .MuiDataGrid-cell": { alignItems: "flex-start", py: 1 },
                "& .MuiDataGrid-row.ship-round-row-mismatch": {
                  backgroundColor: "rgba(251, 146, 60, 0.16)",
                },
                "& .MuiDataGrid-row.ship-round-row-mismatch:hover": {
                  backgroundColor: "rgba(251, 146, 60, 0.24)",
                },
              }}
            />
          )}
        </div>

        {mensaje && (
          <p
            className="text-sm px-4 pb-4"
            style={{
              color: mensaje.includes("✅") || mensaje.includes("🎉") ? "#0f766e" : "#b91c1c",
            }}
          >
            {mensaje}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-end gap-3 px-4 pb-4">
          <button
            type="button"
            onClick={() => void handleSaveCurrentState()}
            disabled={saving || finalizando || roundIsFinalized}
            className="bg-slate-600 hover:bg-slate-700 text-white px-4 py-2 rounded-md font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Guardando..." : "Guardar estado actual"}
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || finalizando || roundIsFinalized}
            className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-md font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Guardando..." : "Guardar revisión"}
          </button>
          <button
            type="button"
            onClick={() => void handleFinalize()}
            disabled={
              finalizando ||
              saving ||
              roundIsFinalized ||
              arrivedTotalForPreview <= 0
            }
            className="bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-md font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {finalizando ? "Finalizando..." : "Finalizar tanda"}
          </button>
        </div>

        {roundIsFinalized && (
          <p className="text-xs text-gray-500 px-4 pb-4">
            Esta tanda ya fue finalizada.
          </p>
        )}
      </div>
    </div>
  );
}
