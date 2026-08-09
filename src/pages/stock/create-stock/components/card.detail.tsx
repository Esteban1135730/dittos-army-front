import type { CartaBusquedaDirecta } from "../stock";
import {
  OPERATIONAL_RAREZA_VALUES,
  operationalRarezaLabel,
} from "../../../../constants/item-rareza";

interface Props {
  carta: CartaBusquedaDirecta;
  costoCarta: number;
  costoEnvio: number;
  cartasEnvio: number;
  copias: number;
  cardState: string;
  language: string;
  /** "" = sin variante */
  operationalRareza: string;
  setOperationalRareza: (s: string) => void;
  setCostoCarta: (n: number) => void;
  setCostoEnvio: (n: number) => void;
  setCartasEnvio: (n: number) => void;
  setCopias: (n: number) => void;
  setCardState: (n: string) => void;
  setLanguage: (s: string) => void;
}

export default function CardDetail({
  carta,
  costoCarta,
  costoEnvio,
  cartasEnvio,
  copias,
  cardState,
  language,
  operationalRareza,
  setOperationalRareza,
  setCostoCarta,
  setCostoEnvio,
  setCartasEnvio,
  setCopias,
  setCardState,
  setLanguage,
}: Props) {
  return (
    <div className="bg-white">
      <div className="flex flex-col items-center mb-6 pb-6 border-b border-gray-200">
        <img
          src={carta.image}
          alt={carta.name}
          className="w-64 h-auto object-contain mb-4 shadow-lg rounded-lg"
        />
        <h2 className="text-2xl font-bold text-gray-800 mb-2">{carta.name}</h2>
        <p className="text-gray-600 text-sm">
          <span className="font-semibold">Número:</span> {carta.localId}
        </p>
      </div>

      {/* Formulario */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Costo carta (€)
          </label>
          <input
            type="text"
            inputMode="decimal"
            value={costoCarta === 0 ? "" : costoCarta.toString().replace(".", ",")}
            onChange={(e) => {
              const value = e.target.value;
              // Permitir vacío, números, punto y coma
              if (value === "" || /^[0-9]*[.,]?[0-9]*$/.test(value)) {
                // Convertir coma a punto para el parseFloat
                const normalizedValue = value.replace(",", ".");
                if (normalizedValue === "" || normalizedValue === ".") {
                  setCostoCarta(0);
                } else {
                  const num = parseFloat(normalizedValue);
                  setCostoCarta(isNaN(num) ? 0 : num);
                }
              }
            }}
            onBlur={(e) => {
              // Al perder el foco, asegurar que el valor esté formateado correctamente
              const value = e.target.value.replace(",", ".");
              const num = parseFloat(value);
              setCostoCarta(isNaN(num) || num < 0 ? 0 : num);
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
            placeholder="0,00 o 0.00"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Costo envío (€)
          </label>
          <input
            type="text"
            inputMode="decimal"
            value={costoEnvio === 0 ? "" : costoEnvio.toString().replace(".", ",")}
            onChange={(e) => {
              const value = e.target.value;
              // Permitir vacío, números, punto y coma
              if (value === "" || /^[0-9]*[.,]?[0-9]*$/.test(value)) {
                // Convertir coma a punto para el parseFloat
                const normalizedValue = value.replace(",", ".");
                if (normalizedValue === "" || normalizedValue === ".") {
                  setCostoEnvio(0);
                } else {
                  const num = parseFloat(normalizedValue);
                  setCostoEnvio(isNaN(num) ? 0 : num);
                }
              }
            }}
            onBlur={(e) => {
              // Al perder el foco, asegurar que el valor esté formateado correctamente
              const value = e.target.value.replace(",", ".");
              const num = parseFloat(value);
              setCostoEnvio(isNaN(num) || num < 0 ? 0 : num);
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
            placeholder="0,00 o 0.00"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Cartas por envío
          </label>
          <input
            type="number"
            min={1}
            step="1"
            value={cartasEnvio}
            onChange={(e) => setCartasEnvio(parseInt(e.target.value) || 1)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
            placeholder="1"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Copias</label>
          <input
            type="number"
            min={1}
            step="1"
            value={copias}
            onChange={(e) => setCopias(parseInt(e.target.value) || 1)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
            placeholder="1"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Estado en inventario
          </label>
          <select
            value={cardState}
            onChange={(e) => setCardState(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
          >
            <option value="disponible">Disponible</option>
            <option value="en_stock_colombia">En stock Colombia</option>
            <option value="reserva">Reserva</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Idioma
          </label>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
          >
            <option value="">Selecciona un idioma</option>
            <option value="es">Español</option>
            <option value="en">Inglés</option>
            <option value="fr">Francés</option>
            <option value="de">Alemán</option>
            <option value="it">Italiano</option>
            <option value="pt">Portugués</option>
            <option value="ja">Japonés</option>
            <option value="ko">Coreano</option>
            <option value="zh-cn">Chino (simplificado)</option>
            <option value="otro">Otro</option>
          </select>
        </div>
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Variante (rareza)
          </label>
          <select
            value={operationalRareza}
            onChange={(e) => setOperationalRareza(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
          >
            <option value="">Sin variante</option>
            {OPERATIONAL_RAREZA_VALUES.map((v) => (
              <option key={v} value={v}>
                {operationalRarezaLabel(v)}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
