import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useExchangeRates } from "../../../utils/tasa";
import { formatCOP } from "../../../utils/convert";

type CardDetail = {
  name: string;
  images: {
    small: string;
    large: string;
  };
  tcgplayer?: {
    prices?: {
      holofoil?: {
        low?: number;
        mid?: number;
        high?: number;
        market?: number;
        directLow?: number;
      };
      reverseHolofoil?: {
        low?: number;
        mid?: number;
        high?: number;
        market?: number;
        directLow?: number;
      };
      normal?: {
        low?: number;
        mid?: number;
        high?: number;
        market?: number;
        directLow?: number;
      };
    };
  };
};

type StockGroupResponse = {
  quantity: number;
  card_value_EUR: number;
  card_value_COP: number | null;
};

export default function AsignarPVP() {
  const { id } = useParams(); // card_id
  const [currency, setCurrency] = useState<"EUR" | "COP">("COP");
  const [pvp, setPvp] = useState<number | "">("");
  const [mensaje, setMensaje] = useState("");
  const [alerta, setAlerta] = useState<string | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null);
  const { convert } = useExchangeRates();

  const { data: stockData, isLoading: loadingStock } =
    useQuery<StockGroupResponse>({
      queryKey: ["group", id],
      queryFn: async () => {
        const res = await axios.get(`http://localhost:3000/stock/group/${id}`);
        return res.data;
      },
      enabled: !!id,
    });

  const { data: cardData, isLoading: loadingCard } = useQuery<CardDetail>({
    queryKey: ["cardDetail", id],
    queryFn: async () => {
      const res = await axios.get(
        `http://localhost:3000/tcg-sdk/card/alter/${id}`
      );
      return res.data;
    },
    enabled: !!id,
  });

  const priceVariants = cardData?.tcgplayer?.prices
    ? Object.keys(cardData.tcgplayer.prices)
    : [];
  const multipleVariants = priceVariants.length > 1;

  // Costo en COP (si no hay, convertimos EUR a COP)
  let costoCOP = 0;
  if (stockData) {
    if (stockData.card_value_COP && stockData.card_value_COP > 0) {
      costoCOP = stockData.card_value_COP;
    } else if (stockData.card_value_EUR) {
      costoCOP = convert.toCopFromEur(stockData.card_value_EUR) ?? 0;
    }
  }

  // Precio estimado en COP con margen 20%
  const pvpEstimadoCOP = costoCOP > 0 ? costoCOP * 1.2 : null;

  const variant = multipleVariants ? selectedVariant : priceVariants[0];
  const precios = variant
    ? (cardData?.tcgplayer?.prices?.[variant] as any)
    : null;

  let marketPriceCOP = 0;
  if (precios?.market) {
    marketPriceCOP = convert.toCopFromUsd(precios.market) ?? 0;
  }

  // Precio de mercado ajustado (95%)
  const marketPriceAjustadoCOP =
    marketPriceCOP > 0 ? marketPriceCOP * 0.95 : null;

  // Función para formatear valores monetarios
  const formatMoneda = (valor: number, moneda: string) =>
    moneda === "COP"
      ? `${formatCOP(valor.toFixed(0))}`
      : moneda === "EUR"
      ? `€${valor.toFixed(2)}`
      : `$${valor.toFixed(2)}`;

  // Validamos alerta comparando el input usuario convertido a COP
  useEffect(() => {
    if (typeof pvp !== "number" || !pvp) {
      setAlerta(null);
      return;
    }

    let pvpEnCOP = pvp;
    if (currency === "EUR") {
      pvpEnCOP = convert.toCopFromEur(pvp) ?? 0;
    }

    if (pvpEnCOP > marketPriceCOP && marketPriceCOP > 0) {
      setAlerta(
        `⚠️ El precio de venta que pusiste (${currency} ${pvp.toFixed(
          2
        )}) es mayor que el precio de mercado (COP ${marketPriceCOP.toFixed(
          0
        )}).`
      );
    } else {
      setAlerta(null);
    }
  }, [pvp, currency, marketPriceCOP, convert]);

  const handleGuardar = async () => {
    if (!id || !pvp || !currency) return;
    if (multipleVariants && !selectedVariant) {
      setMensaje("❌ Debes seleccionar una variante de rareza para guardar.");
      return;
    }

    try {
      await axios.post("http://localhost:3000/stock", {
        card_id: id,
        pvp,
        currency,
      });
      setMensaje("✅ PVP guardado correctamente");
      setAlerta(null);
    } catch (err) {
      setMensaje("❌ Error al guardar el PVP");
    }
  };

  return (
    <div className="mx-auto mt-10 px-8 max-w-6xl">
      <h2 className="text-3xl font-bold mb-6 text-gray-800">
        Asignar PVP a la carta
      </h2>

      <div className="grid grid-cols-[325px_1fr] gap-8 items-start">
        {/* Lado izquierdo: Imagen y nombre */}
        <div className="bg-white p-4 rounded-lg shadow text-center min-h-[540px] flex flex-col justify-center items-center">
          {loadingCard && (
            <p className="text-gray-500">Cargando información de la carta...</p>
          )}

          {!loadingCard && !cardData && (
            <p className="text-red-500">
              No se pudo cargar la información de la carta.
            </p>
          )}

          {cardData && (
            <>
              <img
                src={cardData.images.large}
                alt={cardData.name}
                className="w-auto h-500 mx-auto rounded shadow"
              />
              <h3 className="text-lg font-semibold mt-4">{cardData.name}</h3>

              {cardData?.tcgplayer?.prices ? (
                <div className="text-sm mt-3 text-gray-700 space-y-3 text-left max-h-[300px] overflow-y-auto">
                  {Object.entries(cardData.tcgplayer.prices).map(
                    ([variantName, variantPrices]) => (
                      <div key={variantName}>
                        <p className="font-semibold capitalize text-gray-900 mb-1">
                          {variantName.replace(/([A-Z])/g, " $1")}
                        </p>
                        <ul className="space-y-1 ml-2">
                          {"market" in variantPrices && (
                            <li>
                              💸 <strong>Market:</strong> $
                              {variantPrices.market?.toFixed(2)} |{" "}
                              {formatCOP(
                                convert
                                  .toCopFromUsd(variantPrices.market)
                                  ?.toFixed(0)
                              )}
                            </li>
                          )}
                          {"low" in variantPrices && (
                            <li>
                              📉 <strong>Low:</strong> $
                              {variantPrices.low?.toFixed(2)} |{" "}
                              {formatCOP(
                                convert
                                  .toCopFromUsd(variantPrices.low)
                                  ?.toFixed(0)
                              )}
                            </li>
                          )}
                          {"high" in variantPrices && (
                            <li>
                              📈 <strong>High:</strong> $
                              {variantPrices.high?.toFixed(2)} |{" "}
                              {formatCOP(
                                convert
                                  .toCopFromUsd(variantPrices.high)
                                  ?.toFixed(0)
                              )}
                            </li>
                          )}
                          {"mid" in variantPrices && (
                            <li>
                              📊 <strong>Mid:</strong> $
                              {variantPrices.mid?.toFixed(2)} |{" "}
                              {formatCOP(
                                convert
                                  .toCopFromUsd(variantPrices.mid)
                                  ?.toFixed(0)
                              )}
                            </li>
                          )}
                          {"directLow" in variantPrices && (
                            <li>
                              🏷 <strong>Direct Low:</strong> $
                              {variantPrices.directLow?.toFixed(2)} |{" "}
                              {formatCOP(
                                convert
                                  .toCopFromUsd(variantPrices.directLow)
                                  ?.toFixed(0)
                              )}
                            </li>
                          )}
                        </ul>
                      </div>
                    )
                  )}
                </div>
              ) : (
                <p className="text-gray-500 mt-4">
                  No hay precios disponibles para esta carta.
                </p>
              )}
            </>
          )}
        </div>

        {/* Lado derecho: Datos, referencias y formulario */}
        <div className="space-y-6">
          {/* Detalles de la carta */}
          <div className="bg-white p-4 rounded-md border border-gray-200 space-y-2 text-sm text-gray-700">
            <h4 className="font-semibold text-gray-800 text-base">
              Detalles de stock
            </h4>
            <p>
              <strong>ID:</strong> {id}
            </p>
            <p>
              <strong>En stock:</strong>{" "}
              {stockData?.quantity ?? "No disponible"}
            </p>
            <p>
              <strong>Precio en EUR:</strong>{" "}
              {stockData?.card_value_EUR != null ? (
                <>
                  €{stockData.card_value_EUR.toFixed(2)}{" "}
                  <span className="text-gray-500">
                    (~
                    {formatCOP(
                      convert.toCopFromEur(stockData.card_value_EUR)?.toFixed(0)
                    )}
                    )
                  </span>
                </>
              ) : (
                "No disponible"
              )}
            </p>
            <p>
              <strong>Precio en COP:</strong>{" "}
              {stockData?.card_value_COP != null
                ? formatCOP(stockData.card_value_COP.toFixed(0))
                : "No disponible"}
            </p>
          </div>

          {/* Referencias de precios */}
          <div className="bg-gray-50 p-4 rounded-md border border-gray-200 space-y-2 text-sm">
            <h4 className="font-semibold text-gray-800 text-base">
              Precios de referencia
            </h4>

            <div>
              <strong>➕ Estimado (20% margen): </strong>
              {pvpEstimadoCOP ? (
                <>
                  <span>{formatMoneda(pvpEstimadoCOP, "COP")}</span> |{" "}
                  <span>
                    {formatMoneda(
                      convert.toEurFromCop(pvpEstimadoCOP) ?? 0,
                      "EUR"
                    )}
                  </span>{" "}
                  |{" "}
                  <span>
                    {formatMoneda(
                      convert.toUsdFromCop(pvpEstimadoCOP) ?? 0,
                      "USD"
                    )}
                  </span>
                </>
              ) : (
                "No disponible"
              )}
            </div>

            {!loadingCard && multipleVariants && !selectedVariant && (
              <div className="bg-red-100 border border-red-400 text-red-800 px-4 py-3 rounded text-sm mb-6">
                ⚠️ Esta carta tiene múltiples variantes de rareza (ej. holofoil,
                reverse, normal). Por favor selecciona una para continuar.
              </div>
            )}

            {!loadingCard && multipleVariants && (
              <div className="mb-6">
                <label className="block mb-1 text-sm font-medium text-gray-700">
                  Selecciona la rareza para calcular precios
                </label>
                <select
                  value={selectedVariant ?? ""}
                  onChange={(e) => setSelectedVariant(e.target.value)}
                  className="w-full border px-3 py-2 rounded-md"
                >
                  <option value="" disabled>
                    -- Elige una opción --
                  </option>
                  {priceVariants.map((variant) => (
                    <option key={variant} value={variant}>
                      {variant.replace(/([A-Z])/g, " $1")}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <strong>💹 Mercado ajustado (95%): </strong>
              {marketPriceAjustadoCOP ? (
                <div
                  className={`inline-block px-2 py-1 rounded w-full ${
                    marketPriceAjustadoCOP < costoCOP
                      ? "bg-red-100 text-red-800 font-semibold"
                      : marketPriceAjustadoCOP >= (pvpEstimadoCOP ?? 0)
                      ? "bg-green-100 text-green-800 font-semibold"
                      : "bg-yellow-100 text-yellow-800 font-medium"
                  }`}
                >
                  <span>{formatMoneda(marketPriceAjustadoCOP, "COP")}</span> |{" "}
                  <span>
                    {formatMoneda(
                      convert.toEurFromCop(marketPriceAjustadoCOP) ?? 0,
                      "EUR"
                    )}
                  </span>{" "}
                  |{" "}
                  <span>
                    {formatMoneda(
                      convert.toUsdFromCop(marketPriceAjustadoCOP) ?? 0,
                      "USD"
                    )}
                  </span>
                  <div className="mt-1 text-sm">
                    {marketPriceAjustadoCOP < costoCOP && (
                      <>
                        <p>
                          ⚠️ El mercado ajustado es menor al precio de compra.
                        </p>
                        <p>
                          Diferencia:{" "}
                          <span className="font-bold">
                            {formatCOP(
                              (costoCOP - marketPriceAjustadoCOP).toFixed(0)
                            )}
                          </span>
                        </p>
                      </>
                    )}
                    {marketPriceAjustadoCOP >= (pvpEstimadoCOP ?? 0) && (
                      <p>
                        ✅ Buen margen: el mercado soporta incluso más del 20%.
                      </p>
                    )}
                    {marketPriceAjustadoCOP >= costoCOP &&
                      marketPriceAjustadoCOP < (pvpEstimadoCOP ?? 0) && (
                        <p>
                          ⚠️ Riesgo bajo: la carta se puede vender con poco
                          margen.
                        </p>
                      )}
                  </div>
                </div>
              ) : (
                "No disponible"
              )}
            </div>
          </div>

          {/* Formulario para ingresar PVP */}
          <div className="bg-white p-4 rounded-md border border-gray-200 space-y-4">
            <div>
              <label className="block mb-1 text-sm font-medium text-gray-700">
                Precio de venta (PVP)
              </label>
              <input
                type="number"
                step="0.01"
                value={pvp}
                onChange={(e) =>
                  setPvp(
                    e.target.value === "" ? "" : parseFloat(e.target.value)
                  )
                }
                className="w-full border px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Introduce el precio de venta"
              />
            </div>

            <div>
              <label className="block mb-1 text-sm font-medium text-gray-700">
                Moneda
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as "EUR" | "COP")}
                className="w-full border px-3 py-2 rounded-md"
              >
                <option value="COP">COP</option>
                <option value="EUR">EUR</option>
              </select>
            </div>

            {alerta && (
              <div className="text-red-600 font-semibold text-sm border border-red-200 bg-red-50 px-4 py-2 rounded">
                {alerta}
              </div>
            )}

            <button
              onClick={handleGuardar}
              disabled={
                pvp === "" || pvp <= 0 || (multipleVariants && !selectedVariant)
              }
              className={`w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition ${
                pvp === "" || pvp <= 0 || (multipleVariants && !selectedVariant)
                  ? "opacity-50 cursor-not-allowed"
                  : ""
              }`}
            >
              Guardar PVP
            </button>

            {mensaje && (
              <p className="text-center text-sm text-gray-800 mt-2">
                {mensaje}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
