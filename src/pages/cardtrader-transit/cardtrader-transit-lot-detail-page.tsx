import axios from "axios";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { CardThumb } from "../../components/card-thumb";
import { operationalRarezaLabel } from "../../constants/item-rareza";
import { defaultOwnerForTcg, isOwnerKey, type OwnerKey } from "../../config/owners";
import { getApiTcgHeader } from "../../config/api";
import { collectTcgdexIdsFromLines, useTcgdexCardDetails } from "../../pokemon";
import { resolveTransitCatalogImageSrc } from "./cardtrader-transit-catalog-image";
import {
  API_CARDTRADER_TRANSIT_LOTS,
  type CardtraderTransitLineRow,
  type CardtraderTransitLotMeta,
} from "./cardtrader-transit-types";
import { TransitLotOwnerSelect } from "./transit-lot-owner-select";
import { parseTransitLotOwnerFromSearch } from "./transit-owner-filter";

export default function CardtraderTransitLotDetailPage() {
  const { lotId } = useParams<{ lotId: string }>();
  const [searchParams] = useSearchParams();
  const lotOwnerOverride = parseTransitLotOwnerFromSearch(searchParams.get("owner"));
  const queryClient = useQueryClient();
  const [purchaseDate, setPurchaseDate] = useState("");
  const [totalCopCardsCost, setTotalCopCardsCost] = useState("");
  const [owner, setOwner] = useState<OwnerKey>(() =>
    defaultOwnerForTcg(getApiTcgHeader()),
  );
  const [savingMeta, setSavingMeta] = useState(false);
  const [mensaje, setMensaje] = useState("");

  const { data: lotMeta, isLoading: isLoadingMeta } = useQuery<CardtraderTransitLotMeta>({
    queryKey: ["cardtrader-transit-lot-meta", lotId, lotOwnerOverride],
    enabled: !!lotId,
    queryFn: async () => {
      const res = await axios.get(`${API_CARDTRADER_TRANSIT_LOTS}/${lotId}`, {
        ownerOverride: lotOwnerOverride,
      });
      return res.data as CardtraderTransitLotMeta;
    },
  });

  const { data: lines = [], isLoading: isLoadingLines } = useQuery<CardtraderTransitLineRow[]>({
    queryKey: ["cardtrader-transit-lot-lines", lotId, lotOwnerOverride],
    enabled: !!lotId,
    queryFn: async () => {
      const res = await axios.get(`${API_CARDTRADER_TRANSIT_LOTS}/${lotId}/lines`, {
        ownerOverride: lotOwnerOverride,
      });
      return Array.isArray(res.data) ? (res.data as CardtraderTransitLineRow[]) : [];
    },
  });

  const cardIds = useMemo(() => collectTcgdexIdsFromLines(lines), [lines]);
  const { detailsByCardId, isLoading: tcgImagesLoading } = useTcgdexCardDetails(cardIds);

  useEffect(() => {
    if (!lotMeta) return;
    const d = new Date(lotMeta.purchase_date);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    setPurchaseDate(`${yyyy}-${mm}-${dd}`);
    setTotalCopCardsCost(String(Math.round(lotMeta.total_cop_cards_cost)));
    setOwner(isOwnerKey(lotMeta.owner) ? lotMeta.owner : defaultOwnerForTcg(getApiTcgHeader()));
  }, [lotMeta?.lot_id, lotMeta?.purchase_date, lotMeta?.total_cop_cards_cost, lotMeta?.owner]);

  const saveLotMeta = async () => {
    if (!lotId || !lotMeta) return;
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
      const res = await axios.put(
        `${API_CARDTRADER_TRANSIT_LOTS}/${lotId}`,
        {
          purchase_date: purchaseDate,
          total_cop_cards_cost: totalCop,
          owner,
        },
        { ownerOverride: lotOwnerOverride ?? owner },
      );
      if (!res.data?.success) {
        setMensaje(res.data?.message || "No se pudo actualizar el lote.");
        return;
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["cardtrader-transit-lot-meta", lotId] }),
        queryClient.invalidateQueries({ queryKey: ["cardtrader-transit-lot-lines", lotId] }),
        queryClient.invalidateQueries({ queryKey: ["cardtrader-transit-lots-open"] }),
      ]);
      setMensaje("✅ Lote actualizado.");
    } catch (e: unknown) {
      const err = e as {
        response?: { data?: { message?: string; error?: string }; status?: number };
      };
      setMensaje(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          "No se pudo actualizar el lote.",
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["cardtrader-transit-lot-meta", lotId] }),
        queryClient.invalidateQueries({ queryKey: ["cardtrader-transit-lot-lines", lotId] }),
        queryClient.invalidateQueries({ queryKey: ["cardtrader-transit-lots-open"] }),
      ]);
    } finally {
      setSavingMeta(false);
    }
  };

  if (!lotId) return <p className="text-red-600">Falta lotId</p>;

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-4 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Detalle lote tránsito CardTrader</h1>
          <p className="text-sm text-gray-600 mt-1 break-all">Lote: {lotId}</p>
        </div>
        <Link to="/cardtrader-transit" className="text-blue-600 hover:underline font-medium">
          ← Volver a lotes
        </Link>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Datos del lote</h2>
        {isLoadingMeta ? (
          <p className="text-sm text-gray-600">Cargando…</p>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
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
                <TransitLotOwnerSelect
                  id="lot-detail"
                  value={owner}
                  onChange={setOwner}
                  disabled={lotMeta?.owner_editable === false}
                  helperText={
                    lotMeta?.owner_editable === false
                      ? "No se puede cambiar el dueño porque ya se creó stock o se recibió parte del lote."
                      : undefined
                  }
                />
              </div>
              <div>
                <button
                  type="button"
                  onClick={saveLotMeta}
                  disabled={savingMeta}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-medium disabled:opacity-50"
                >
                  {savingMeta ? "Guardando…" : "Guardar cambios"}
                </button>
              </div>
            </div>
            {lotMeta?.legacy_incoming_batch_id ? (
              <p className="text-xs text-amber-700 mt-3">
                Referencia legacy: {lotMeta.legacy_incoming_batch_id}
                {lotMeta.legacy_incoming_cop_hint
                  ? ` · COP sugerido ${Math.round(lotMeta.legacy_incoming_cop_hint).toLocaleString("es-CO")}`
                  : ""}
                {lotMeta.registered_items_fx_subtotal != null &&
                Math.abs(lotMeta.registered_items_fx_subtotal - lotMeta.total_fx_cards_cost) >
                  0.01 ? (
                  <>
                    {" "}
                    · FX lote {lotMeta.total_fx_cards_cost.toFixed(2)}{" "}
                    {lotMeta.cards_cost_currency} (CT0{" "}
                    {lotMeta.registered_items_fx_subtotal.toFixed(2)})
                  </>
                ) : null}
                {lotMeta.real_fx_rate_cop > 0 ? (
                  <>
                    {" "}
                    · Tasa {Math.round(lotMeta.real_fx_rate_cop).toLocaleString("es-CO")} COP/
                    {lotMeta.cards_cost_currency}
                  </>
                ) : null}
              </p>
            ) : lotMeta ? (
              <p className="text-xs text-gray-600 mt-3">
                {lotMeta.cards_cost_currency} {lotMeta.total_fx_cards_cost.toFixed(2)} · Tasa{" "}
                {Math.round(lotMeta.real_fx_rate_cop).toLocaleString("es-CO")} COP/
                {lotMeta.cards_cost_currency}
              </p>
            ) : null}
          </>
        )}
        {mensaje ? <p className="text-sm mt-2 text-gray-700">{mensaje}</p> : null}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-4">
        <div className="px-4 py-3 bg-gray-50 text-sm font-semibold text-gray-700">
          Cartas del lote ({lines.length})
        </div>
        {isLoadingLines && <div className="p-4 text-gray-600">Cargando cartas…</div>}
        {!isLoadingLines && lines.length === 0 && (
          <div className="p-4 text-gray-600">Este lote no tiene líneas.</div>
        )}
        {!isLoadingLines && lines.length > 0 && (
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {lines.map((line) => {
              const imageSrc = resolveTransitCatalogImageSrc(
                line.card_id,
                line.image_url,
                detailsByCardId,
                line.language,
              );
              return (
              <div
                key={line.line_id}
                className="flex gap-3 border rounded-lg p-3 bg-white border-gray-200 items-start"
              >
                <CardThumb
                  src={imageSrc || undefined}
                  alt={line.card_name}
                  size="md"
                  pending={tcgImagesLoading && !imageSrc}
                />
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-gray-800 truncate">{line.card_name}</div>
                  <div className="text-xs text-gray-500 mt-0.5 break-all">{line.card_id}</div>
                  <div className="text-xs text-gray-600 mt-1">
                    Idioma: {line.language}
                    {line.rareza
                      ? ` · ${operationalRarezaLabel(line.rareza) ?? line.rareza}`
                      : ""}
                  </div>
                  <div className="text-xs text-gray-700 mt-1">
                    Pedido: {line.quantity_ordered} · Pendiente: {line.remaining_quantity}
                    {line.not_arrived_at ? (
                      <span className="ml-2 inline-flex items-center rounded-full bg-orange-100 text-orange-900 px-2 py-0.5 text-[10px] font-semibold">
                        No llegada
                      </span>
                    ) : null}
                  </div>
                  <div className="text-xs text-gray-700 mt-1">
                    {lotMeta?.cards_cost_currency ?? "USD"}{" "}
                    {line.fx_unit_price.toFixed(2)}/ud ·{" "}
                    {Number(line.unit_cost_cop).toLocaleString("es-CO", {
                      maximumFractionDigits: 0,
                    })}{" "}
                    COP/u
                  </div>
                  {line.expansion ? (
                    <div className="text-[10px] text-gray-500 mt-1">
                      {line.expansion}
                      {line.collector_number ? ` · #${line.collector_number}` : ""}
                    </div>
                  ) : null}
                </div>
              </div>
            );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
