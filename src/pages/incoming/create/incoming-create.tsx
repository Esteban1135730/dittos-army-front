import axios from "axios";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

type CartaBusquedaDirecta = {
  id: string;
  localId: string;
  name: string;
  image: string;
};

type LineaEntrada = {
  card_id: string;
  card_name: string;
  image_url: string;
  language: string;
  quantity: number;
  // TOTAL EUR del lote (sin envío) para esa quantity
  eur_total_lot: number;
};

const API_TCG_SEARCH = "http://localhost:3000/tcg-dex/card/search";
const API_INCOMING = "http://localhost:3000/incoming";

const LANGUAGE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "es", label: "Español" },
  { value: "en", label: "Inglés" },
  { value: "fr", label: "Francés" },
  { value: "de", label: "Alemán" },
  { value: "it", label: "Italiano" },
  { value: "pt", label: "Portugués" },
  { value: "ja", label: "Japonés" },
  { value: "ko", label: "Coreano" },
  { value: "zh", label: "Chino" },
  { value: "otro", label: "Otro" },
];

function parseNumberInput(value: string): number {
  const normalized = value.replace(",", ".");
  if (!normalized.trim()) return 0;
  const num = parseFloat(normalized);
  return Number.isFinite(num) ? num : 0;
}

export default function IncomingCreatePage() {
  const navigate = useNavigate();

  const [buscar, setBuscar] = useState("");
  const [resultados, setResultados] = useState<CartaBusquedaDirecta[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [errorBusqueda, setErrorBusqueda] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [seleccion, setSeleccion] = useState<CartaBusquedaDirecta | null>(null);

  const [language, setLanguage] = useState("en");
  const [quantity, setQuantity] = useState(1);
  const [eur_total_lot, setEurTotalLot] = useState<string>("");

  const [lineas, setLineas] = useState<LineaEntrada[]>([]);

  const [total_cop_cards_cost, setTotalCopCardsCost] = useState<string>("");
  const [purchase_date, setPurchaseDate] = useState<string>(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  });
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");

  const totalEurCards = useMemo(
    () => lineas.reduce((sum, l) => sum + l.eur_total_lot, 0),
    [lineas],
  );

  const buscarCarta = async () => {
    const q = buscar.trim();
    if (!q) return;

    setBuscando(true);
    setErrorBusqueda("");
    setResultados([]);
    try {
      const res = await axios.get(`${API_TCG_SEARCH}/${encodeURIComponent(q)}`);
      const data = res.data as any;
      if (Array.isArray(data) && data.length > 0) {
        setResultados(data as CartaBusquedaDirecta[]);
      } else {
        setErrorBusqueda("No se encontraron cartas.");
      }
    } catch {
      setErrorBusqueda("Error al buscar cartas.");
    } finally {
      setBuscando(false);
    }
  };

  const abrirModal = (carta: CartaBusquedaDirecta) => {
    setSeleccion(carta);
    setModalOpen(true);
    setLanguage("en");
    setQuantity(1);
    setEurTotalLot("");
  };

  const agregarLinea = () => {
    if (!seleccion) return;
    const eurTotal = parseNumberInput(eur_total_lot);
    if (!language.trim()) {
      setMensaje("Selecciona un idioma.");
      return;
    }
    if (quantity <= 0) {
      setMensaje("La cantidad debe ser mayor a 0.");
      return;
    }
    if (eurTotal <= 0) {
      setMensaje("El EUR total del lote debe ser mayor a 0.");
      return;
    }

    setLineas((prev) => {
      const idx = prev.findIndex((l) => l.card_id === seleccion.id && l.language === language);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = {
          ...copy[idx],
          quantity: copy[idx].quantity + quantity,
          eur_total_lot: copy[idx].eur_total_lot + eurTotal,
        };
        return copy;
      }

      return [
        ...prev,
        {
          card_id: seleccion.id,
          card_name: seleccion.name,
          image_url: seleccion.image,
          language,
          quantity,
          eur_total_lot: eurTotal,
        },
      ];
    });

    setModalOpen(false);
    setSeleccion(null);
    setMensaje("");
  };

  const guardarBatch = async () => {
    if (lineas.length === 0) {
      setMensaje("Agrega al menos una carta.");
      return;
    }

    const totalCop = parseNumberInput(total_cop_cards_cost);
    if (totalCop <= 0) {
      setMensaje("Ingresa el total COP de costo de cartas (sin envío).");
      return;
    }
    if (!purchase_date) {
      setMensaje("Selecciona la fecha de compra.");
      return;
    }

    try {
      setGuardando(true);
      setMensaje("");
      const body = {
        items: lineas.map((l) => ({
          card_id: l.card_id,
          language: l.language,
          quantity: l.quantity,
          eur_total_lot: l.eur_total_lot,
        })),
        total_cop_cards_cost: totalCop,
        purchase_date,
      };

      const res = await axios.post(`${API_INCOMING}/batch`, body);
      const batchId = res.data?.batch_id as string;
      navigate(`/incoming/batch/${batchId}`);
    } catch (e: any) {
      setMensaje(
        e?.response?.data?.message ||
          e?.response?.data?.error ||
          "Error al crear la compra en camino.",
      );
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-4 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Nueva compra en camino</h1>
          <p className="text-sm text-gray-600 mt-1">
            Carga masiva (EUR por lote) y luego revisión con envío (COP).
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate("/incoming")}
          className="text-blue-600 hover:underline font-medium"
        >
          ← Volver
        </button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={buscar}
            onChange={(e) => setBuscar(e.target.value)}
            placeholder="Buscar carta por nombre..."
            className="flex-1 px-3 py-2 border rounded-md"
          />
          <button
            type="button"
            onClick={buscarCarta}
            disabled={buscando}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {buscando ? "Buscando..." : "Buscar"}
          </button>
        </div>

        {errorBusqueda && (
          <p className="text-red-600 text-sm mt-2">{errorBusqueda}</p>
        )}

        {resultados.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mt-4">
            {resultados.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => abrirModal(c)}
                className="border rounded-lg p-2 hover:shadow-sm transition text-left"
              >
                <img
                  src={c.image}
                  alt={c.name}
                  className="w-full h-28 object-contain mb-2"
                />
                <div className="text-sm font-medium line-clamp-2">{c.name}</div>
                <div className="text-xs text-gray-500">{c.localId}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Líneas */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 text-sm font-semibold text-gray-700">
          Cartas agregadas
        </div>
        <div className="p-4">
          {lineas.length === 0 ? (
            <p className="text-gray-600">Aún no has agregado cartas.</p>
          ) : (
            <div className="space-y-3">
              {lineas.map((l, idx) => (
                <div
                  key={`${l.card_id}-${l.language}-${idx}`}
                  className="flex items-center gap-4 border rounded-lg p-3"
                >
                  <img
                    src={l.image_url}
                    alt={l.card_name}
                    className="w-14 h-20 object-contain border rounded bg-gray-50"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-800 truncate">
                      {l.card_name}
                    </div>
                    <div className="text-xs text-gray-500">{l.card_id}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      Idioma: {l.language} · Cantidad: {l.quantity}
                    </div>
                    <div className="text-xs text-gray-700 mt-1">
                      EUR total lote: {l.eur_total_lot.toFixed(2)}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLineas((prev) => prev.filter((_, i) => i !== idx))}
                    className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-md text-sm"
                  >
                    Quitar
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Fecha de compra del lote
          </label>
          <input
            type="date"
            value={purchase_date}
            onChange={(e) => setPurchaseDate(e.target.value)}
            className="w-full px-3 py-2 border rounded-md mb-3"
          />

          <label className="block text-sm font-medium text-gray-700 mb-1">
            Total COP costo de CARTAS (sin envío)
          </label>
          <input
            type="text"
            inputMode="decimal"
            value={total_cop_cards_cost}
            onChange={(e) => setTotalCopCardsCost(e.target.value)}
            placeholder="Ej: 2500000"
            className="w-full px-3 py-2 border rounded-md"
          />
          <p className="text-xs text-gray-500 mt-1">
            En backend se calcula: valor_real_euro = totalCOP / totalEUR (cartas).
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Total EUR (cartas) = EUR {totalEurCards.toFixed(2)}
          </p>
        </div>
        <button
          type="button"
          onClick={guardarBatch}
          disabled={guardando}
          className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed self-end"
        >
          {guardando ? "Creando..." : "Crear compra"}
        </button>
      </div>

      {/* Modal */}
      {modalOpen && seleccion && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          onClick={(e) => {
            if (e.currentTarget === e.target) setModalOpen(false);
          }}
        >
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h2 className="text-xl font-bold text-gray-800">
                Agregar carta al lote
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-gray-600 hover:underline"
              >
                Cerrar
              </button>
            </div>
            <div className="flex gap-4">
              <img
                src={seleccion.image}
                alt={seleccion.name}
                className="w-28 h-40 object-contain border rounded bg-gray-50"
              />
              <div className="flex-1">
                <p className="font-medium text-gray-800">{seleccion.name}</p>
                <p className="text-xs text-gray-500">{seleccion.localId}</p>

                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Idioma
                    </label>
                    <select
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                      className="w-full px-3 py-2 border rounded-md"
                    >
                      {LANGUAGE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Cantidad
                    </label>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={quantity}
                      onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                      className="w-full px-3 py-2 border rounded-md"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      EUR total del lote (SIN envío)
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={eur_total_lot}
                      onChange={(e) => setEurTotalLot(e.target.value)}
                      placeholder="Ej: 120.50"
                      className="w-full px-3 py-2 border rounded-md"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Backend divide entre cantidad para obtener EUR unitario.
                    </p>
                  </div>
                </div>

                {mensaje && (
                  <p className="text-red-600 text-sm mt-3">{mensaje}</p>
                )}

                <div className="mt-4 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setModalOpen(false);
                      setSeleccion(null);
                      setMensaje("");
                    }}
                    className="px-4 py-2 border rounded-md hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={agregarLinea}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium"
                  >
                    Agregar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

