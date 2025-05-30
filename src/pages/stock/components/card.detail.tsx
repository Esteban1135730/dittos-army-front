import type { Carta } from "../stock";
import { useEuroRate } from "../../../utils/tasa";
import { useEffect, useState } from "react";

interface Props {
  carta: Carta;
  costoCarta: number;
  costoEnvio: number;
  cartasEnvio: number;
  copias: number;
  gananciaEsperada: number;
  setCostoCarta: (n: number) => void;
  setCostoEnvio: (n: number) => void;
  setCartasEnvio: (n: number) => void;
  setCopias: (n: number) => void;
  setGananciaEsperada: (n: number) => void;
}

export default function CardDetail({
  carta,
  costoCarta,
  costoEnvio,
  cartasEnvio,
  copias,
  gananciaEsperada,
  setCostoCarta,
  setCostoEnvio,
  setCartasEnvio,
  setCopias,
  setGananciaEsperada,
}: Props) {
  const { convertToCOP, convertToEUR } = useEuroRate();
  const [ventaEsperadaCOP, setVentaEsperadaCOP] = useState<number | null>(null);

  const costoRealCarta = costoCarta + costoEnvio / cartasEnvio;

  const valorConGanancia = costoRealCarta * (1 + gananciaEsperada / 100);
  const precioSugerido = costoRealCarta * 1.3;
  const gananciaNeta = valorConGanancia - costoRealCarta;

  useEffect(() => {
    if (ventaEsperadaCOP !== null && convertToEUR) {
      const valorEUR = convertToEUR(ventaEsperadaCOP);
      if (valorEUR !== null) {
        const ganancia = ((valorEUR - costoRealCarta) / costoRealCarta) * 100;
        setGananciaEsperada(parseFloat(ganancia.toFixed(2)));
      }
    }
  }, [ventaEsperadaCOP]);

  useEffect(() => {
    /*
    if (convertToCOP) {
      const ventaCOP = convertToCOP(valorConGanancia);
      if (ventaCOP !== null) {
        setVentaEsperadaCOP(parseFloat(ventaCOP.toFixed(2)));
      }
    }
      */
  }, [gananciaEsperada, costoRealCarta]);

  return (
    <div className="mt-10 bg-gray-50 p-6 rounded-lg border border-gray-300 shadow">
      <div className="flex flex-col items-center">
        <img
          src={carta.images.large}
          alt={carta.name}
          className="w-52 h-auto object-contain mb-4"
        />
        <h2 className="text-xl font-bold text-gray-800 mb-2">{carta.name}</h2>
        <p className="text-gray-700 mb-1">
          <strong>Número:</strong> {carta.number}
        </p>
        <p className="text-gray-700 mb-1">
          <strong>Rareza:</strong> {carta.rarity || "Desconocida"}
        </p>
        <p className="text-gray-700 mb-1">
          <strong>Supertipo:</strong> {carta.supertype}
        </p>
        <p className="text-gray-700 mb-1">
          <strong>Regulación:</strong> {carta.regulationMark}
        </p>
        <p className="mt-2 font-semibold text-gray-700">Legalidades:</p>
        <ul className="list-disc list-inside text-sm">
          <li>Unlimited: {carta.legalities.unlimited}</li>
          <li>Standard: {carta.legalities.standard}</li>
          <li>Expanded: {carta.legalities.expanded}</li>
        </ul>
      </div>

      <div className="mt-6 grid sm:grid-cols-2 gap-4 text-sm text-gray-800">
        {carta.cardmarket && (
          <div className="bg-white border rounded-lg p-4">
            <h4 className="text-green-700 font-semibold mb-2">Cardmarket</h4>
            <p>
              Precio medio: €
              {carta.cardmarket.prices.averageSellPrice.toFixed(2)}
            </p>
            <a
              href={carta.cardmarket.url}
              target="_blank"
              className="text-green-500 underline text-xs"
            >
              Ver en Cardmarket
            </a>
          </div>
        )}
        {carta.tcgplayer?.prices.normal && (
          <div className="bg-white border rounded-lg p-4">
            <h4 className="text-blue-700 font-semibold mb-2">TCGPlayer</h4>
            <p>
              Precio medio: €{carta.tcgplayer.prices.normal.market.toFixed(2)}
            </p>
            <a
              href={carta.tcgplayer.url}
              target="_blank"
              className="text-blue-500 underline text-xs"
            >
              Ver en TCGPlayer
            </a>
          </div>
        )}
      </div>

      {/* Cálculos */}
      <div className="mt-6 grid grid-cols-2 gap-4 max-w-lg mx-auto">
        <div>
          <label className="block text-sm font-medium mb-1">
            Costo carta (€)
          </label>
          <input
            type="number"
            min={0}
            step="0.01"
            value={costoCarta}
            onChange={(e) => setCostoCarta(parseFloat(e.target.value))}
            className="w-full px-3 py-2 border rounded-md"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">
            Costo envío (€)
          </label>
          <input
            type="number"
            min={0}
            step="0.01"
            value={costoEnvio}
            onChange={(e) => setCostoEnvio(parseFloat(e.target.value))}
            className="w-full px-3 py-2 border rounded-md"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">
            Cartas por envío
          </label>
          <input
            type="number"
            min={1}
            step="1"
            value={cartasEnvio}
            onChange={(e) => setCartasEnvio(parseInt(e.target.value) || 1)}
            className="w-full px-3 py-2 border rounded-md"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Copias</label>
          <input
            type="number"
            min={1}
            step="1"
            value={copias}
            onChange={(e) => setCopias(parseInt(e.target.value) || 1)}
            className="w-full px-3 py-2 border rounded-md"
          />
        </div>
      </div>

      <div className="mt-4 text-center space-y-2">
        <p className="font-semibold">
          Costo real: €{costoRealCarta.toFixed(2)} /{" "}
          {convertToCOP &&
            convertToCOP(costoRealCarta)?.toLocaleString("es-CO", {
              style: "currency",
              currency: "COP",
            })}
        </p>
        <p className="font-semibold">
          Valor con 30% ganancia: €{precioSugerido.toFixed(2)}
        </p>
        {carta.tcgplayer?.prices.normal?.market && (
          <p className="text-sm">
            Diferencia vs TCGPlayer:{" "}
            <span className="font-semibold">
              {(
                ((carta.tcgplayer.prices.normal.market - costoRealCarta) /
                  costoRealCarta) *
                100
              ).toFixed(1)}
              %
            </span>
          </p>
        )}

        <div className="mt-4 grid grid-cols-2 gap-4 justify-center items-end">
          <div>
            <label className="block text-sm font-medium mb-1">
              Ganancia esperada (%)
            </label>
            <input
              type="number"
              min={0}
              step="0.1"
              value={gananciaEsperada}
              onChange={(e) =>
                setGananciaEsperada(parseFloat(e.target.value) || 0)
              }
              className="w-full text-center px-2 py-1 border rounded-md"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Valor de venta esperado (COP)
            </label>
            <input
              type="number"
              min={0}
              value={ventaEsperadaCOP ?? ""}
              onChange={(e) =>
                setVentaEsperadaCOP(parseFloat(e.target.value) || 0)
              }
              className="w-full text-center px-2 py-1 border rounded-md"
            />
          </div>
        </div>

        <p className="mt-2 font-semibold text-green-700">
          Valor con ganancia esperada: €{valorConGanancia.toFixed(2)} /{" "}
          {convertToCOP &&
            convertToCOP(valorConGanancia)?.toLocaleString("es-CO", {
              style: "currency",
              currency: "COP",
            })}
        </p>

        <p className="font-semibold text-green-800">
          Precio sugerido: €{precioSugerido.toFixed(2)} /{" "}
          {convertToCOP &&
            convertToCOP(precioSugerido)?.toLocaleString("es-CO", {
              style: "currency",
              currency: "COP",
            })}
        </p>

        <p className="font-semibold text-purple-700">
          Ganancia neta: €{gananciaNeta.toFixed(2)} /{" "}
          {convertToCOP &&
            convertToCOP(gananciaNeta)?.toLocaleString("es-CO", {
              style: "currency",
              currency: "COP",
            })}
        </p>
      </div>
    </div>
  );
}
