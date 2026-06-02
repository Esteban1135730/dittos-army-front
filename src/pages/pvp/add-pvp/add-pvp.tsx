import { useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useExchangeRates } from "../../../utils/tasa";
import { formatCOP } from "../../../utils/convert";
import { operationalRarezaLabel } from "../../../constants/item-rareza";
import { API_BASE, apiUrl } from "../../../config/api";

/** Respuesta estándar de carta desde TCGdex (mapeada en backend) */
type CardDetail = {
  id?: string;
  localId?: string;
  name: string;
  image?: string;
  images?: {
    small: string;
    large: string;
  };
  tcgplayer?: {
    unit?: string;
    updated?: string;
    prices?: Record<
      string,
      {
        low?: number;
        mid?: number;
        high?: number;
        market?: number;
        directLow?: number;
      }
    >;
  };
  cardmarket?: {
    unit?: string;
    updated?: string;
    avg?: number;
    low?: number;
    trend?: number;
    avg1?: number;
    avg7?: number;
    avg30?: number;
    avgHolo?: number;
    lowHolo?: number;
    trendHolo?: number;
  };
};

type StockGroupResponse = {
  quantity: number;
  card_value_EUR: number;
  card_value_COP: number | null;
  primary_currency?: string;
};

/** Filas `GET /pvp/:card_id` — variante operativa (stock / PVP). */
type PvpCardRow = {
  card_id: string;
  rareza: string | null;
  pvp: number | null;
  currency: string | null;
  has_stock: boolean;
};

export default function AsignarPVP() {
  const { id } = useParams(); // card_id
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [currency, setCurrency] = useState<"EUR" | "COP">("COP");
  const [pvp, setPvp] = useState<number | "">("");
  const [mensaje, setMensaje] = useState("");
  const [alerta, setAlerta] = useState<string | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null);
  /** null = PVP base; string = rareza operativa; undefined = aún no elegida (varias con stock) */
  const [selectedOpRareza, setSelectedOpRareza] = useState<string | null | undefined>(undefined);
  const { convert } = useExchangeRates();

  const { data: stockData } =
    useQuery<StockGroupResponse>({
      queryKey: ["group", id],
      queryFn: async () => {
        const res = await axios.get(`${API_BASE}/stock/group/${id}`);
        return res.data;
      },
      enabled: !!id,
    });

  const { data: cardData, isLoading: loadingCard, isError: cardError, error: cardQueryError } = useQuery<CardDetail>({
    queryKey: ["cardDetail", id],
    queryFn: async () => {
      const url = `${API_BASE}/card/${id}`;
      try {
        const res = await axios.get<CardDetail | null>(url);
        if (res.data === null || res.data === undefined) {
          console.error("[add-pvp] Carta no encontrada (respuesta null/undefined)", { cardId: id, url });
          throw new Error("Carta no encontrada");
        }
        return res.data as CardDetail;
      } catch (err) {
        if (axios.isAxiosError(err)) {
          console.error("[add-pvp] Error al cargar carta (axios)", {
            cardId: id,
            url,
            status: err.response?.status,
            data: err.response?.data,
            message: err.message,
          });
        } else {
          console.error("[add-pvp] Error al cargar carta", { cardId: id, url, error: err });
        }
        throw err;
      }
    },
    enabled: !!id,
  });

  const { data: pvpRows } = useQuery<PvpCardRow[]>({
    queryKey: ["pvp-rows", id],
    queryFn: async () => {
      const res = await axios.get<PvpCardRow[]>(`${API_BASE}/pvp/${id}`);
      return Array.isArray(res.data) ? res.data : [];
    },
    enabled: !!id,
  });

  const rowsWithStock = useMemo(
    () => (pvpRows ?? []).filter((r) => r.has_stock),
    [pvpRows],
  );

  useEffect(() => {
    if (!pvpRows?.length || selectedOpRareza !== undefined) return;
    if (rowsWithStock.length === 0) {
      setSelectedOpRareza(null);
      return;
    }
    if (rowsWithStock.length === 1) {
      setSelectedOpRareza(rowsWithStock[0].rareza);
    }
  }, [pvpRows, rowsWithStock, selectedOpRareza]);

  const activePvpRow = useMemo(() => {
    if (selectedOpRareza === undefined || !pvpRows?.length) return null;
    return (
      pvpRows.find(
        (r) =>
          (r.rareza ?? null) === (selectedOpRareza === null ? null : selectedOpRareza),
      ) ?? null
    );
  }, [pvpRows, selectedOpRareza]);

  useEffect(() => {
    if (selectedOpRareza === undefined) return;
    if (activePvpRow?.pvp != null && activePvpRow.currency) {
      setPvp(activePvpRow.pvp);
      setCurrency(activePvpRow.currency as "EUR" | "COP");
    } else if (activePvpRow) {
      setPvp("");
    }
  }, [selectedOpRareza, activePvpRow?.pvp, activePvpRow?.currency]);

  // Traza de error al cargar la carta
  useEffect(() => {
    if (cardError && cardQueryError) {
      console.error("[add-pvp] useQuery cardDetail en estado de error", {
        cardId: id,
        error: cardQueryError,
        message: cardQueryError instanceof Error ? cardQueryError.message : String(cardQueryError),
      });
    }
  }, [cardError, cardQueryError, id]);

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
  const precios = variant && cardData?.tcgplayer?.prices
    ? (cardData.tcgplayer.prices as any)[variant]
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
    if (!id) {
      setMensaje("❌ No se encontró el ID de la carta.");
      return;
    }
    
    if (typeof pvp !== "number" || pvp <= 0) {
      setMensaje("❌ El PVP debe ser un número mayor a cero.");
      return;
    }
    
    if (!currency) {
      setMensaje("❌ Debes seleccionar una moneda.");
      return;
    }
    
    if (rowsWithStock.length > 1 && selectedOpRareza === undefined) {
      setMensaje("❌ Debes elegir para qué variante de stock es este PVP.");
      return;
    }

    try {
      setMensaje(""); // Limpiar mensaje anterior
      const rz =
        rowsWithStock.length === 0
          ? null
          : selectedOpRareza === undefined
            ? rowsWithStock[0]?.rareza ?? null
            : selectedOpRareza;
      await axios.post(apiUrl("/pvp"), {
        card_id: id,
        pvp: Number(pvp),
        currency,
        rareza: rz,
      });
      setMensaje("✅ PVP guardado correctamente");
      setAlerta(null);
      await queryClient.invalidateQueries({ queryKey: ["pvp-rows", id] });
      
      // Redirigir al menú de stock después de 1 segundo
      setTimeout(() => {
        navigate("/stock");
      }, 1000);
    } catch (err: any) {
      console.error("Error al guardar PVP:", err);
      const errorMessage = err.response?.data?.message || 
                          err.response?.data?.error || 
                          err.message || 
                          "❌ Error al guardar el PVP";
      setMensaje(errorMessage);
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

          {!loadingCard && (cardError || !cardData) && (
            <p className="text-red-500">
              {cardError
                ? "Error al cargar la carta. Comprueba la conexión o que el ID sea correcto."
                : "No se pudo cargar la información de la carta."}
            </p>
          )}

          {cardData && (
            <>
              <img
                src={cardData.image ?? cardData.images?.large ?? ""}
                alt={cardData.name}
                className="w-auto h-500 mx-auto rounded shadow"
              />
              <h3 className="text-lg font-semibold mt-4">{cardData.name}</h3>

              {/* Precios TCGplayer (USD) */}
              {cardData?.tcgplayer?.prices ? (
                <div className="text-sm mt-3 text-gray-700 space-y-3 text-left max-h-[300px] overflow-y-auto">
                  <p className="font-semibold text-gray-900">TCGplayer (USD)</p>
                  {Object.entries(cardData.tcgplayer.prices).map(
                    ([variantName, variantPrices]) => (
                      <div key={variantName}>
                        <p className="font-medium capitalize text-gray-800 mb-1">
                          {variantName.replace(/([A-Z])/g, " $1")}
                        </p>
                        <ul className="space-y-1 ml-2">
                          {"market" in variantPrices && variantPrices.market != null && (
                            <li>
                              💸 <strong>Market:</strong> $
                              {variantPrices.market.toFixed(2)} |{" "}
                              {formatCOP(
                                convert
                                  .toCopFromUsd(variantPrices.market)
                                  ?.toFixed(0) || "0"
                              )}
                            </li>
                          )}
                          {"low" in variantPrices && variantPrices.low != null && (
                            <li>
                              📉 <strong>Low:</strong> $
                              {variantPrices.low.toFixed(2)} |{" "}
                              {formatCOP(
                                convert
                                  .toCopFromUsd(variantPrices.low)
                                  ?.toFixed(0) || "0"
                              )}
                            </li>
                          )}
                          {"high" in variantPrices && variantPrices.high != null && (
                            <li>
                              📈 <strong>High:</strong> $
                              {variantPrices.high.toFixed(2)} |{" "}
                              {formatCOP(
                                convert
                                  .toCopFromUsd(variantPrices.high)
                                  ?.toFixed(0) || "0"
                              )}
                            </li>
                          )}
                          {"mid" in variantPrices && variantPrices.mid != null && (
                            <li>
                              📊 <strong>Mid:</strong> $
                              {variantPrices.mid.toFixed(2)} |{" "}
                              {formatCOP(
                                convert
                                  .toCopFromUsd(variantPrices.mid)
                                  ?.toFixed(0) || "0"
                              )}
                            </li>
                          )}
                          {"directLow" in variantPrices && variantPrices.directLow != null && (
                            <li>
                              🏷 <strong>Direct Low:</strong> $
                              {variantPrices.directLow.toFixed(2)} |{" "}
                              {formatCOP(
                                convert
                                  .toCopFromUsd(variantPrices.directLow)
                                  ?.toFixed(0) || "0"
                              )}
                            </li>
                          )}
                        </ul>
                      </div>
                    )
                  )}
                </div>
              ) : null}

              {/* Precios Cardmarket (EUR) */}
              {cardData?.cardmarket && (cardData.cardmarket.trend != null || cardData.cardmarket.avg != null || cardData.cardmarket.low != null) ? (
                <div className="text-sm mt-3 text-gray-700 space-y-1 text-left border-t pt-3">
                  <p className="font-semibold text-gray-900">Cardmarket (EUR)</p>
                  <ul className="space-y-1 ml-2">
                    {cardData.cardmarket.trend != null && (
                      <li>
                        💸 <strong>Trend:</strong> €{cardData.cardmarket.trend.toFixed(2)} |{" "}
                        {formatCOP(
                          convert
                            .toCopFromEur(cardData.cardmarket.trend)
                            ?.toFixed(0) || "0"
                        )}
                      </li>
                    )}
                    {cardData.cardmarket.avg != null && (
                      <li>
                        📊 <strong>Avg:</strong> €{cardData.cardmarket.avg.toFixed(2)} |{" "}
                        {formatCOP(
                          convert
                            .toCopFromEur(cardData.cardmarket.avg)
                            ?.toFixed(0) || "0"
                        )}
                      </li>
                    )}
                    {cardData.cardmarket.low != null && (
                      <li>
                        📉 <strong>Low:</strong> €{cardData.cardmarket.low.toFixed(2)} |{" "}
                        {formatCOP(
                          convert
                            .toCopFromEur(cardData.cardmarket.low)
                            ?.toFixed(0) || "0"
                        )}
                      </li>
                    )}
                    {cardData.cardmarket.avg30 != null && (
                      <li>
                        📈 <strong>Avg 30d:</strong> €{cardData.cardmarket.avg30.toFixed(2)}
                      </li>
                    )}
                  </ul>
                </div>
              ) : null}

              {!cardData?.tcgplayer?.prices && !(cardData?.cardmarket && (cardData.cardmarket.trend != null || cardData.cardmarket.avg != null || cardData.cardmarket.low != null)) && (
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
              <strong>Precio:</strong>{" "}
              {(() => {
                const monedaCompra = stockData?.primary_currency || "EUR";
                let precioCOP = 0;
                let precioEUR = 0;
                let precioUSD = 0;
                
                if (stockData?.card_value_COP && stockData.card_value_COP > 0) {
                  precioCOP = stockData.card_value_COP;
                  precioEUR = convert.toEurFromCop(precioCOP) ?? 0;
                  precioUSD = convert.toUsdFromCop(precioCOP) ?? 0;
                } else if (stockData?.card_value_EUR && stockData.card_value_EUR > 0) {
                  precioEUR = stockData.card_value_EUR;
                  precioCOP = convert.toCopFromEur(precioEUR) ?? 0;
                  precioUSD = convert.toUsdFromCop(precioCOP) ?? 0;
                }
                
                if (precioCOP === 0 && precioEUR === 0) {
                  return "No disponible";
                }
                
                return (
                  <span className="flex gap-2 flex-wrap">
                    <span className={monedaCompra === "COP" ? "font-bold text-blue-600" : ""}>
                      COP {formatCOP(precioCOP.toFixed(0))}
                    </span>
                    <span>/</span>
                    <span className={monedaCompra === "EUR" ? "font-bold text-blue-600" : ""}>
                      EUR {precioEUR.toFixed(2)}
                    </span>
                    <span>/</span>
                    <span className={monedaCompra === "USD" ? "font-bold text-blue-600" : ""}>
                      USD {precioUSD.toFixed(2)}
                    </span>
                  </span>
                );
              })()}
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
            {rowsWithStock.length > 0 && (
              <div className="mb-4">
                <label className="block mb-1 text-sm font-medium text-gray-700">
                  Variante de stock (PVP operativo)
                </label>
                <p className="text-xs text-gray-500 mb-2">
                  Solo aparecen variantes con unidades en inventario. Es independiente de las
                  variantes TCGplayer (referencia de mercado).
                </p>
                <select
                  value={
                    selectedOpRareza === undefined
                      ? ""
                      : selectedOpRareza === null
                        ? "__base__"
                        : selectedOpRareza
                  }
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "") setSelectedOpRareza(undefined);
                    else if (v === "__base__") setSelectedOpRareza(null);
                    else setSelectedOpRareza(v);
                  }}
                  className="w-full border px-3 py-2 rounded-md"
                >
                  {rowsWithStock.length > 1 && (
                    <option value="" disabled>
                      — Elige variante —
                    </option>
                  )}
                  {rowsWithStock.map((r) => (
                    <option
                      key={r.rareza === null ? "__base__" : r.rareza}
                      value={r.rareza === null ? "__base__" : (r.rareza as string)}
                    >
                      {operationalRarezaLabel(r.rareza)}
                      {r.pvp != null ? ` — ${r.pvp} ${r.currency ?? ""}` : " — sin PVP"}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {pvpRows && pvpRows.length > 1 && (
              <div className="text-xs text-gray-600 border rounded p-2 bg-gray-50">
                <p className="font-medium text-gray-700 mb-1">Resumen PVP por variante</p>
                <ul className="list-disc pl-4 space-y-0.5">
                  {pvpRows.map((r) => (
                    <li key={r.rareza === null ? "base" : r.rareza}>
                      {operationalRarezaLabel(r.rareza)}:{" "}
                      {r.pvp != null ? `${r.pvp} ${r.currency ?? ""}` : "—"}{" "}
                      {r.has_stock ? "(con stock)" : "(sin stock)"}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <label className="block mb-1 text-sm font-medium text-gray-700">
                Precio de venta (PVP)
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={pvp === "" ? "" : typeof pvp === "number" ? pvp.toString().replace(".", ",") : pvp}
                onChange={(e) => {
                  const value = e.target.value;
                  // Permitir vacío, números, punto y coma
                  if (value === "" || /^[0-9]*[.,]?[0-9]*$/.test(value)) {
                    // Convertir coma a punto para el parseFloat
                    const normalizedValue = value.replace(",", ".");
                    if (normalizedValue === "" || normalizedValue === ".") {
                      setPvp("");
                    } else {
                      const num = parseFloat(normalizedValue);
                      setPvp(isNaN(num) ? "" : num);
                    }
                  }
                }}
                onBlur={(e) => {
                  // Al perder el foco, asegurar que el valor esté formateado correctamente
                  const value = e.target.value.replace(",", ".");
                  if (value === "" || value === ".") {
                    setPvp("");
                  } else {
                    const num = parseFloat(value);
                    setPvp(isNaN(num) ? "" : num);
                  }
                }}
                className="w-full border px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Introduce el precio de venta (0,00 o 0.00)"
              />
              {typeof pvp === "number" && pvp > 0 && costoCOP > 0 && (
                <div className="mt-2">
                  {(() => {
                    // Convertir PVP a COP para comparar
                    const pvpEnCOP = currency === "EUR" 
                      ? (convert.toCopFromEur(pvp) ?? 0)
                      : pvp;
                    
                    const diferencia = pvpEnCOP - costoCOP;
                    const porcentaje = (diferencia / costoCOP) * 100;
                    const esGanancia = diferencia > 0;
                    const esPerdida = diferencia < 0;
                    
                    return (
                      <div className={`text-sm p-2 rounded ${
                        esGanancia 
                          ? "bg-green-100 text-green-800 border border-green-300" 
                          : esPerdida
                          ? "bg-red-100 text-red-800 border border-red-300"
                          : "bg-gray-100 text-gray-800 border border-gray-300"
                      }`}>
                        {esGanancia && (
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">✅ Ganancia:</span>
                            <span className="font-bold">
                              {formatCOP(diferencia.toFixed(0))} ({porcentaje.toFixed(1)}%)
                            </span>
                          </div>
                        )}
                        {esPerdida && (
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">❌ Pérdida:</span>
                            <span className="font-bold">
                              {formatCOP(Math.abs(diferencia).toFixed(0))} ({Math.abs(porcentaje).toFixed(1)}%)
                            </span>
                          </div>
                        )}
                        {!esGanancia && !esPerdida && (
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">⚖️ Sin ganancia ni pérdida</span>
                          </div>
                        )}
                        <div className="text-xs mt-1 text-gray-600">
                          Costo: {formatCOP(costoCOP.toFixed(0))} | 
                          PVP: {formatCOP(pvpEnCOP.toFixed(0))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
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
                pvp === "" ||
                (typeof pvp === "number" && pvp <= 0) ||
                (rowsWithStock.length > 1 && selectedOpRareza === undefined)
              }
              className={`w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition ${
                pvp === "" ||
                (typeof pvp === "number" && pvp <= 0) ||
                (rowsWithStock.length > 1 && selectedOpRareza === undefined)
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
