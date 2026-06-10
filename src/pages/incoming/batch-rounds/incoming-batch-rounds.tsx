import axios from "axios";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { apiUrl } from "../../../config/api";
import { operationalRarezaLabel } from "../../../constants/item-rareza";
import type { Ct0BoxItem } from "../../../utils/cardtrader-ct0-box";
import {
  buildCt0HomologIndex,
  homologateIncomingItems,
  summarizeIncomingHomolog,
} from "../../../utils/incoming-ct0-homolog";
import {
  buildCt0PackageProfile,
  buildIncomingBatchProfile,
  scoreCt0ToIncomingBatchPair,
} from "../../../utils/incoming-ct0-package-match";
import { buildPurchasePackages } from "../../../utils/purchase-package-consolidated";
import {
  inferOperationalRarezaFromCtProperties,
  readCtCondition,
  readCtLanguage,
} from "../../../utils/cardtrader-order-item-map";
import { exportIncomingBatchToPdf } from "../export-incoming-batch-pdf";
import SimulateRealCardPriceDialog from "../simulate-real-card-price-dialog";
import { API_INCOMING } from "../../clientes/cliente-types";

const API_CARDTRADER = apiUrl("/cardtrader");

type IncomingBatchItemRow = {
  batch_item_id: string;
  batch_id: string;
  card_id: string;
  card_name: string;
  image_url: string;
  language: string;
  quantity_ordered: number;
  remaining_quantity: number;
  eur_total_lot: number;
  eur_unit_price: number;
  unit_cost_cop: number;
  rareza?: string | null;
};

type IncomingBatchMeta = {
  batch_id: string;
  status: string;
  purchase_date: string;
  total_eur_cards_cost: number;
  total_cop_cards_cost: number;
  real_euro_rate_cop_per_eur: number;
  created_at: string;
};

export default function IncomingBatchRoundsPage() {
  const { batchId } = useParams<{ batchId: string }>();
  const queryClient = useQueryClient();
  const [savingMeta, setSavingMeta] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [simulateItemId, setSimulateItemId] = useState<string | null>(null);

  const { data: batchItems = [], isLoading: isLoadingItems } = useQuery<IncomingBatchItemRow[]>({
    queryKey: ["incoming-batch-items", batchId],
    enabled: !!batchId,
    queryFn: async () => {
      const res = await axios.get(`${API_INCOMING}/batch/${batchId}/items`);
      return Array.isArray(res.data) ? (res.data as IncomingBatchItemRow[]) : [];
    },
  });

  const { data: batchMeta, isLoading: isLoadingMeta } = useQuery<IncomingBatchMeta>({
    queryKey: ["incoming-batch-meta", batchId],
    enabled: !!batchId,
    queryFn: async () => {
      const res = await axios.get(`${API_INCOMING}/batch/${batchId}`);
      return res.data as IncomingBatchMeta;
    },
  });

  const ct0Query = useQuery<Ct0BoxItem[]>({
    queryKey: ["cardtrader", "ct0-box-items-homolog"],
    queryFn: async () => {
      const res = await axios.get(`${API_CARDTRADER}/ct0-box-items`);
      return Array.isArray(res.data) ? (res.data as Ct0BoxItem[]) : [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const ct0HomologIndex = useMemo(
    () =>
      buildCt0HomologIndex({
        ct0Items: ct0Query.data ?? [],
        readLanguage: readCtLanguage,
        readRareza: (props) => inferOperationalRarezaFromCtProperties(props),
      }),
    [ct0Query.data],
  );

  const homologByItemId = useMemo(() => {
    return homologateIncomingItems(batchItems, ct0HomologIndex);
  }, [batchItems, ct0HomologIndex]);

  const homologSummary = useMemo(
    () => summarizeIncomingHomolog(homologByItemId.values(), ct0HomologIndex.ct0UnitsTotal),
    [homologByItemId, ct0HomologIndex.ct0UnitsTotal],
  );

  const [showOnlyMissingInCt0, setShowOnlyMissingInCt0] = useState(false);

  const visibleBatchItems = useMemo(() => {
    if (!showOnlyMissingInCt0) return batchItems;
    return batchItems.filter(
      (it) => homologByItemId.get(it.batch_item_id)?.onlyInIncoming === true,
    );
  }, [batchItems, homologByItemId, showOnlyMissingInCt0]);

  const batchProfile = useMemo(() => {
    if (!batchId || !batchMeta) return null;
    return buildIncomingBatchProfile(batchId, batchMeta.purchase_date, batchItems);
  }, [batchId, batchMeta, batchItems]);

  const matchedCtCheckouts = useMemo(() => {
    if (!batchProfile || !ct0Query.data?.length) return [];
    const { packages } = buildPurchasePackages({
      ct0Items: ct0Query.data,
      copByPackageKey: {},
      parseCop: () => null,
      readCondition: readCtCondition,
      readLanguage: readCtLanguage,
      variantLabel: (props) =>
        operationalRarezaLabel(inferOperationalRarezaFromCtProperties(props)),
    });
    return packages
      .map((pkg) => {
        const scored = scoreCt0ToIncomingBatchPair(
          buildCt0PackageProfile(pkg),
          batchProfile,
        );
        return scored ? { ...scored, isSamePackage: true as const } : null;
      })
      .filter((m): m is NonNullable<typeof m> => m != null)
      .sort((a, b) => Date.parse(b.ct0PaidAt) - Date.parse(a.ct0PaidAt));
  }, [batchProfile, ct0Query.data]);

  const [purchaseDate, setPurchaseDate] = useState<string>("");
  const [totalCopCardsCost, setTotalCopCardsCost] = useState<string>("");

  useEffect(() => {
    if (!batchMeta) return;
    const d = new Date(batchMeta.purchase_date);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    setPurchaseDate(`${yyyy}-${mm}-${dd}`);
    setTotalCopCardsCost(String(Math.round(batchMeta.total_cop_cards_cost)));
  }, [batchMeta?.batch_id, batchMeta?.purchase_date, batchMeta?.total_cop_cards_cost]);

  const saveBatchMeta = async () => {
    if (!batchId || !batchMeta) return;
    const totalCop = Number(totalCopCardsCost.replace(",", "."));
    if (!purchaseDate) {
      setMensaje("Selecciona una fecha de compra.");
      return;
    }
    if (!Number.isFinite(totalCop) || totalCop <= 0) {
      setMensaje("El total COP de cartas debe ser mayor a 0.");
      return;
    }

    try {
      setSavingMeta(true);
      setMensaje("");
      const res = await axios.put(`${API_INCOMING}/batch/${batchId}`, {
        purchase_date: purchaseDate,
        total_cop_cards_cost: totalCop,
      });
      if (!res.data?.success) {
        setMensaje(res.data?.message || "No se pudo actualizar el batch.");
        return;
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["incoming-batch-meta", batchId] }),
        queryClient.invalidateQueries({ queryKey: ["incoming-batch-items", batchId] }),
        queryClient.invalidateQueries({ queryKey: ["incoming-batch-open"] }),
      ]);
      setMensaje("✅ Batch actualizado.");
    } catch (e: any) {
      setMensaje(
        e?.response?.data?.message ||
          e?.response?.data?.error ||
          "No se pudo actualizar el batch.",
      );
    } finally {
      setSavingMeta(false);
    }
  };

  if (!batchId) return <p className="text-red-600">Falta batchId</p>;

  const simulateItem =
    simulateItemId === null
      ? null
      : batchItems.find((it) => it.batch_item_id === simulateItemId) ?? null;

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-4 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            Detalle de compra en camino
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Batch: <span className="font-semibold break-all">{batchId}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 justify-end">
          <button
            type="button"
            onClick={() => {
              if (!batchMeta) return;
              exportIncomingBatchToPdf(batchMeta, batchItems);
            }}
            disabled={!batchMeta || isLoadingItems}
            className="bg-slate-700 hover:bg-slate-800 text-white px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Exportar PDF
          </button>
          <Link to="/incoming" className="text-blue-600 hover:underline font-medium">
            ← Volver a Compras
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Datos del lote</h2>
        {isLoadingMeta ? (
          <p className="text-sm text-gray-600">Cargando datos del batch...</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fecha de compra
              </label>
              <input
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Total COP cartas (sin envío)
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={totalCopCardsCost}
                onChange={(e) => setTotalCopCardsCost(e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>
            <div>
              <button
                type="button"
                onClick={saveBatchMeta}
                disabled={savingMeta}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingMeta ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>
          </div>
        )}
        {mensaje && <p className="text-sm mt-2 text-gray-700">{mensaje}</p>}
      </div>

      {matchedCtCheckouts.length > 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-4">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <div className="text-sm font-semibold text-gray-700">
              Checkouts CT Zero emparejados ({matchedCtCheckouts.length})
            </div>
            <p className="text-xs text-gray-600 mt-0.5">
              Mismo paquete si ≥60% de cartas CT coinciden por nombre y la fecha está a ±14 días del
              lote.
            </p>
          </div>
          <ul className="divide-y divide-gray-100">
            {matchedCtCheckouts.map((m) => (
              <li
                key={m.ct0PackageKey}
                className="px-4 py-2.5 text-sm flex flex-wrap gap-x-4 gap-y-1 items-center"
              >
                <span className="font-medium text-gray-800">
                  {new Date(m.ct0PaidAt).toLocaleString("es-CO", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </span>
                <span className="text-gray-600">
                  {Math.round(m.nameOverlapRatio * 100)}% nombres · {m.matchedUnits}/{m.ctUnits} uds
                  · {m.dateDiffDays === 0 ? "misma fecha" : `±${m.dateDiffDays} días`}
                </span>
                <Link
                  to="/test-cardtrader"
                  className="text-blue-700 hover:underline text-xs font-medium"
                >
                  Ver en consolidado CT
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-4">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-sm font-semibold text-gray-700">Homologación CT Zero</div>
            <p className="text-xs text-gray-600 mt-0.5">
              Etiqueta = sin cobertura en CT Zero. Las cartas amarillas con precio están en
              Consolidado tránsito.
            </p>
          </div>
          {ct0Query.isLoading ? (
            <span className="text-xs text-gray-500">Comparando con CT Zero…</span>
          ) : ct0Query.isError ? (
            <span className="text-xs text-amber-700">No se pudo cargar CT Zero para comparar.</span>
          ) : (
            <div className="text-xs text-gray-700">
              {homologSummary.onlyIncomingLines} líneas · {homologSummary.onlyIncomingUnits} uds
              solo panel · {homologSummary.matchedUnits}/{homologSummary.ct0UnitsTotal} uds CT
              emparejadas
            </div>
          )}
        </div>
        <div className="px-4 py-2 flex flex-wrap items-center gap-3 border-b border-gray-100">
          <label className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={showOnlyMissingInCt0}
              onChange={(e) => setShowOnlyMissingInCt0(e.target.checked)}
            />
            Solo cartas sin match en CT Zero
          </label>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-4">
        <div className="px-4 py-3 bg-gray-50 text-sm font-semibold text-gray-700">Cartas del pedido</div>
        {isLoadingItems && <div className="p-4 text-gray-600">Cargando cartas...</div>}
        {!isLoadingItems && batchItems.length === 0 && (
          <div className="p-4 text-gray-600">Este batch no tiene cartas cargadas.</div>
        )}
        {!isLoadingItems && batchItems.length > 0 && visibleBatchItems.length === 0 && (
          <div className="p-4 text-gray-600">Todas las cartas pendientes tienen match en CT Zero.</div>
        )}
        {!isLoadingItems && visibleBatchItems.length > 0 && (
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {visibleBatchItems.map((it) => {
              const homolog = homologByItemId.get(it.batch_item_id);
              const onlyIncoming = homolog?.onlyInIncoming === true;
              return (
              <div
                key={it.batch_item_id}
                className="flex gap-3 border rounded-lg p-3 bg-white border-gray-200 items-start"
              >
                <div className="w-14 h-18 flex-shrink-0 bg-gray-50 border rounded flex items-center justify-center overflow-hidden">
                  {it.image_url ? (
                    <img
                      src={it.image_url}
                      alt={it.card_name}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <span className="text-gray-400 text-xs">—</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="font-medium text-gray-800 truncate">{it.card_name}</div>
                    {onlyIncoming ? (
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded">
                        Sin CT Zero
                        {homolog && homolog.missingFromCt0Qty > 0
                          ? ` · ${homolog.missingFromCt0Qty} uds`
                          : ""}
                      </span>
                    ) : homolog && homolog.ct0MatchedQty > 0 ? (
                      <span className="text-[10px] font-medium text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded">
                        CT0 · {homolog.ct0MatchedQty}/{homolog.incomingRemainingQty}
                      </span>
                    ) : null}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5 break-all">{it.card_id}</div>
                  <div className="text-xs text-gray-600 mt-1">
                    Idioma: {it.language}
                    {it.rareza ? ` · Rareza: ${it.rareza}` : ""}
                  </div>
                  <div className="text-xs text-gray-700 mt-1">
                    Pedido: {it.quantity_ordered} · Pendiente: {it.remaining_quantity}
                  </div>
                  <div className="text-xs text-gray-700 mt-1">
                    Costo real:{" "}
                    {Number(it.unit_cost_cop).toLocaleString("es-CO", {
                      maximumFractionDigits: 2,
                    })}{" "}
                    COP/u
                  </div>
                  <div className="text-xs text-gray-700 mt-1">
                    Total carta:{" "}
                    {(
                      Number(it.unit_cost_cop) * Number(it.quantity_ordered)
                    ).toLocaleString("es-CO", { maximumFractionDigits: 0 })}{" "}
                    COP
                  </div>
                  <button
                    type="button"
                    onClick={() => setSimulateItemId(it.batch_item_id)}
                    className="mt-2 text-xs font-medium text-blue-700 hover:text-blue-900 underline"
                  >
                    Simular precio real
                  </button>
                </div>
              </div>
            );
            })}
          </div>
        )}
      </div>

      {simulateItem && (
        <SimulateRealCardPriceDialog
          key={simulateItem.batch_item_id}
          open
          onClose={() => setSimulateItemId(null)}
          cardName={simulateItem.card_name}
          unitCostCop={simulateItem.unit_cost_cop}
        />
      )}
    </div>
  );
}

