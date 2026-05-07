import { useEffect, useMemo, useState } from "react";
import { useExchangeRates } from "../../utils/tasa";
import {
  loadSimulateInputsCache,
  saveSimulateInputsCache,
  SIMULATE_INPUTS_CACHE_TTL_MS,
} from "./simulate-real-card-price-cache";
import {
  computeSimulatedRealPriceCop,
  IVA_RATE,
  parseNonNegativeNumberLoose,
  parsePositiveIntLoose,
  rateLooksSuspicious,
  resolveUsdCopRate,
  simulationNeedsWarning,
} from "./simulate-real-card-price";

type Props = {
  open: boolean;
  onClose: () => void;
  cardName: string;
  /** unit_cost_cop */
  unitCostCop: number;
};

export default function SimulateRealCardPriceDialog({
  open,
  onClose,
  cardName,
  unitCostCop,
}: Props) {
  const { convert, rates } = useExchangeRates();
  const [nRaw, setNRaw] = useState("");
  const [purchaseUsdRaw, setPurchaseUsdRaw] = useState("");
  const [shipCopRaw, setShipCopRaw] = useState("");
  const [inputsHydrated, setInputsHydrated] = useState(false);

  useEffect(() => {
    if (!open) {
      setInputsHydrated(false);
      return;
    }
    const cached = loadSimulateInputsCache();
    if (cached) {
      setNRaw(cached.n);
      setPurchaseUsdRaw(cached.purchaseUsd);
      setShipCopRaw(cached.shippingCop);
    }
    setInputsHydrated(true);
  }, [open]);

  useEffect(() => {
    if (!open || !inputsHydrated) return;
    const id = window.setTimeout(() => {
      saveSimulateInputsCache({
        n: nRaw,
        purchaseUsd: purchaseUsdRaw,
        shippingCop: shipCopRaw,
      });
    }, 450);
    return () => window.clearTimeout(id);
  }, [open, inputsHydrated, nRaw, purchaseUsdRaw, shipCopRaw]);

  const rateResolution = useMemo(() => {
    const raw = rates.usdToCop;
    if (raw === null || !Number.isFinite(raw) || raw <= 0) return null;
    return resolveUsdCopRate(raw);
  }, [rates.usdToCop]);

  const copPerUsdEffective = rateResolution?.copPerUsd ?? null;
  const rateStillSuspicious =
    copPerUsdEffective !== null && rateLooksSuspicious(copPerUsdEffective);

  const parsed = useMemo(() => {
    const n = parsePositiveIntLoose(nRaw);
    const purchaseUsd = parseNonNegativeNumberLoose(purchaseUsdRaw);
    const shippingCop = parseNonNegativeNumberLoose(shipCopRaw);
    const pCop = Number(unitCostCop);
    const copPerUsd = copPerUsdEffective;
    if (
      n === null ||
      purchaseUsd === null ||
      shippingCop === null ||
      copPerUsd === null ||
      copPerUsd <= 0 ||
      !Number.isFinite(pCop) ||
      pCop <= 0
    ) {
      return null;
    }
    return computeSimulatedRealPriceCop({
      pCop,
      n,
      purchaseUsd,
      copPerUsd,
      shippingCop,
    });
  }, [nRaw, purchaseUsdRaw, shipCopRaw, unitCostCop, copPerUsdEffective]);

  const warning = parsed ? simulationNeedsWarning(parsed) : false;

  const usdRef =
    parsed && rates.usdToCop !== null && rates.usdToCop > 0
      ? convert.toUsdFromCop(parsed.totalCop)
      : null;

  const ratesMissing = rates.usdToCop === null || rates.usdToCop <= 0;

  const purchaseUsdParsed = useMemo(
    () => parseNonNegativeNumberLoose(purchaseUsdRaw),
    [purchaseUsdRaw],
  );
  const purchaseCopPreview =
    !ratesMissing &&
    purchaseUsdParsed !== null &&
    copPerUsdEffective !== null &&
    copPerUsdEffective > 0
      ? purchaseUsdParsed * copPerUsdEffective
      : null;
  const ivaCopPreview =
    purchaseCopPreview !== null ? purchaseCopPreview * IVA_RATE : null;

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="simulate-price-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-gray-200 flex items-start justify-between gap-2">
          <h2 id="simulate-price-title" className="text-lg font-semibold text-gray-900">
            Simular precio real (aprox.)
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 hover:text-gray-800 text-sm font-medium shrink-0"
          >
            Cerrar
          </button>
        </div>
        <div className="p-4 space-y-3 text-sm">
          <p className="text-gray-600">
            <span className="font-medium text-gray-800">{cardName}</span>
          </p>
          <p className="text-xs text-gray-500">
            Valor del pedido en USD (se convierte a COP), envío total en COP y n cartas. El IVA es{" "}
            {(IVA_RATE * 100).toFixed(0)}% sobre ese valor ya en pesos:{" "}
            <span className="font-medium">
              P_COP + envío/n + ((USD×tasa)×{(IVA_RATE * 100).toFixed(0)}%)/n
            </span>
            . Los tres campos editables se guardan en este navegador para todas las simulaciones (unos{" "}
            {Math.round(SIMULATE_INPUTS_CACHE_TTL_MS / (24 * 60 * 60 * 1000))} días).
          </p>

          {!ratesMissing && rateResolution && (
            <div className="text-xs text-gray-700 bg-slate-50 border border-slate-200 rounded px-2 py-1.5 space-y-0.5">
              <div>
                <span className="font-medium">Tasa USD→COP aplicada:</span>{" "}
                {copPerUsdEffective?.toLocaleString("es-CO", { maximumFractionDigits: 2 })} COP por 1
                USD
              </div>
              {rateResolution.wasAdjusted && rates.usdToCop !== null && (
                <div className="text-amber-800">
                  Valor en sesión ({String(rates.usdToCop)}) fuera de rango típico.
                  {rateResolution.kind === "inverted" &&
                    " Se interpretó como USD por COP y se usó el inverso."}
                  {rateResolution.kind === "scaled" &&
                    " Se corrigió la escala (p. ej. ceros de más o de menos). "}
                  Confirma el número en el módulo de tasas.
                </div>
              )}
            </div>
          )}

          {ratesMissing && (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
              Carga la tasa USD → COP en el módulo de tasas del panel para valorar el pedido en COP y
              calcular el IVA.
            </p>
          )}

          {rateStillSuspicious && !ratesMissing && (
            <p className="text-xs text-red-800 bg-red-50 border border-red-200 rounded px-2 py-1.5">
              La tasa sigue fuera del rango esperado (unos 500 a 50 000 COP por USD). Corrige el valor en
              el módulo de tasas: pesos colombianos por un dólar.
            </p>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Precio carta (COP, sin envío) — desde el ítem
            </label>
            <div className="px-3 py-2 bg-gray-50 border rounded-md text-gray-800">
              {Number(unitCostCop).toLocaleString("es-CO", { maximumFractionDigits: 2 })} COP
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Número de cartas en el envío (n)
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={nRaw}
              onChange={(e) => setNRaw(e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
              placeholder="p. ej. 10"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Valor del pedido / cartas (USD, total)
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={purchaseUsdRaw}
              onChange={(e) => setPurchaseUsdRaw(e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
              placeholder="Ej. 738"
            />
            {purchaseCopPreview !== null && (
              <p className="text-xs text-gray-600 mt-0.5">
                ≈ {purchaseCopPreview.toLocaleString("es-CO", { maximumFractionDigits: 0 })} COP valor
                pedido · IVA {(IVA_RATE * 100).toFixed(0)}% ≈{" "}
                {ivaCopPreview !== null
                  ? ivaCopPreview.toLocaleString("es-CO", { maximumFractionDigits: 0 })
                  : "—"}{" "}
                COP total (antes de ÷ n)
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Costo de envío — COP, total
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={shipCopRaw}
              onChange={(e) => setShipCopRaw(e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
              placeholder="0 si no aplica"
            />
            <p className="text-xs text-gray-500 mt-0.5">
              Por carta: total envío COP ÷ n
            </p>
          </div>

          {parsed && (
            <div className="mt-4 pt-3 border-t border-gray-100 space-y-2">
              <div className="text-xs font-semibold text-gray-700">Desglose (COP)</div>
              <ul className="text-xs text-gray-700 space-y-1">
                <li>
                  Base (precio carta):{" "}
                  <span className="font-medium">
                    {parsed.baseCop.toLocaleString("es-CO", { maximumFractionDigits: 2 })}
                  </span>
                </li>
                <li>
                  Envío total:{" "}
                  <span className="font-medium">
                    {parsed.shippingCopTotal.toLocaleString("es-CO", { maximumFractionDigits: 0 })}
                  </span>{" "}
                  · Envío / carta:{" "}
                  <span className="font-medium">
                    {parsed.shippingPerCard.toLocaleString("es-CO", { maximumFractionDigits: 2 })}
                  </span>
                </li>
                <li>
                  Valor pedido (COP):{" "}
                  <span className="font-medium">
                    {parsed.purchaseCopTotal.toLocaleString("es-CO", { maximumFractionDigits: 0 })}
                  </span>
                </li>
                <li>
                  IVA ({(IVA_RATE * 100).toFixed(0)}% sobre valor pedido COP):{" "}
                  <span className="font-medium">
                    {parsed.ivaCopTotal.toLocaleString("es-CO", { maximumFractionDigits: 0 })}
                  </span>{" "}
                  total · IVA / carta:{" "}
                  <span className="font-medium">
                    {parsed.ivaPerCard.toLocaleString("es-CO", { maximumFractionDigits: 2 })}
                  </span>
                </li>
              </ul>
              <div className="text-base font-semibold text-gray-900 pt-1">
                Total aprox. COP:{" "}
                {parsed.totalCop.toLocaleString("es-CO", { maximumFractionDigits: 2 })}
              </div>
              {usdRef !== null && (
                <div className="text-xs text-gray-500">
                  Referencia USD (~): USD {usdRef.toFixed(2)}
                </div>
              )}
              {warning && (
                <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1.5 mt-2">
                  Revisa los valores (total o algún componente no cuadra).
                </p>
              )}
            </div>
          )}

          {!parsed && (nRaw || purchaseUsdRaw || shipCopRaw) && !ratesMissing && (
            <p className="text-xs text-red-600">
              Completa n (≥ 1), valor pedido USD y envío COP (pueden ser 0 donde aplique) para ver el
              resultado.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
