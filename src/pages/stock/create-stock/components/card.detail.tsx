import type { CartaBusquedaDirecta } from "../stock";

interface Props {
  carta: CartaBusquedaDirecta;
  costoCarta: number;
  costoEnvio: number;
  cartasEnvio: number;
  copias: number;
  cardState: string;
  setCostoCarta: (n: number) => void;
  setCostoEnvio: (n: number) => void;
  setCartasEnvio: (n: number) => void;
  setCopias: (n: number) => void;
  setCardState: (n: string) => void;
}

export default function CardDetail({
  carta,
  costoCarta,
  costoEnvio,
  cartasEnvio,
  copias,
  cardState,
  setCostoCarta,
  setCostoEnvio,
  setCartasEnvio,
  setCopias,
  setCardState,
}: Props) {
  return (
    <div className="mt-10 bg-gray-50 p-6 rounded-lg border border-gray-300 shadow">
      <div className="flex flex-col items-center">
        <img
          src={carta.image}
          alt={carta.name}
          className="w-52 h-auto object-contain mb-4"
        />
        <h2 className="text-xl font-bold text-gray-800 mb-2">{carta.name}</h2>
        <p className="text-gray-700 mb-1">
          <strong>Número:</strong> {carta.localId}
        </p>
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
        <div>
          <label className="block text-sm font-medium text-gray-700 mt-4">
            Estado de la carta
          </label>
          <select
            value={cardState}
            onChange={(e) => setCardState(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg border-gray-300 focus:ring-blue-500 focus:outline-none"
          >
            <option value="">Selecciona un estado</option>
            <option value="en_envio_cardmarket">En envío (CardMarket)</option>
            <option value="en_stock_espana">En stock (España)</option>
            <option value="en_envio_colombia">En envío (Colombia)</option>
            <option value="en_stock_colombia">En stock (Colombia)</option>
            <option value="vendida">Vendida</option>
            <option value="otro">Otro</option>
          </select>
        </div>
      </div>
    </div>
  );
}
