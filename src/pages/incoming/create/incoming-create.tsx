import axios from "axios";
import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import { apiUrl } from "../../../config/api";
import { API_INCOMING } from "../../clientes/cliente-types";

const API_TCG_SEARCH = apiUrl("/tcg-dex/card/search");
const API_TCG_FIND = apiUrl("/tcg-dex/card/find");

type CartaBusquedaDirecta = {
  id: string;
  localId: string;
  name: string;
  image: string;
};

type CartaRareza =
  | "hollow"
  | "foil"
  | "pokeball"
  | "masterball"
  | "first edition"
  | null;

type LineaEntrada = {
  card_id: string;
  card_name: string;
  image_url: string;
  language: string;
  quantity: number;
  // TOTAL EUR del lote (sin envío) para esa quantity
  eur_total_lot: number;
  rareza: CartaRareza;
};

type CardTraderJsonRow = {
  order_item_id?: number;
  card_name?: string;
  expansion?: string;
  quantity?: number;
  price_eur?: number;
  language_code?: string;
  first_edition?: boolean;
  poke_ball_reverse_holo?: boolean;
  reverse_holo?: boolean;
  expansion_subvariant?: string;
  tcgdex_card_id?: string | null;
  tcgdex_error?: string | null;
};

function mergeLineIntoList(prev: LineaEntrada[], line: LineaEntrada): LineaEntrada[] {
  const idx = prev.findIndex(
    (l) =>
      l.card_id === line.card_id &&
      l.language === line.language &&
      (l.rareza ?? null) === (line.rareza ?? null),
  );
  if (idx >= 0) {
    const copy = [...prev];
    copy[idx] = {
      ...copy[idx],
      quantity: copy[idx].quantity + line.quantity,
      eur_total_lot: copy[idx].eur_total_lot + line.eur_total_lot,
    };
    return copy;
  }
  return [...prev, line];
}

function mapCardTraderLang(code: string | undefined): string {
  const c = String(code || "")
    .toLowerCase()
    .trim();
  const alias: Record<string, string> = { jp: "ja", jpn: "ja" };
  const mapped = alias[c] || c;
  if (LANGUAGE_OPTIONS.some((o) => o.value === mapped)) return mapped;
  return "otro";
}

function inferRarezaFromCardTrader(row: CardTraderJsonRow): CartaRareza {
  const sub = String(row.expansion_subvariant || "").toLowerCase();
  if (row.first_edition) return "first edition";
  if (/master\s*ball/i.test(sub)) return "masterball";
  if (row.poke_ball_reverse_holo) return "pokeball";
  if (row.reverse_holo) return "foil";
  return null;
}

async function fetchTcgDexCard(
  cardId: string,
): Promise<{ id: string; name: string; image: string } | null> {
  try {
    const res = await axios.get(`${API_TCG_FIND}/${encodeURIComponent(cardId)}`);
    const d = res.data as Record<string, unknown> | null | undefined;
    if (!d || typeof d !== "object") return null;
    const id = d.id as string | undefined;
    if (!id) return null;
    const images = d.images as { small?: string; large?: string } | undefined;
    const image =
      (typeof d.image === "string" && d.image) ||
      (images?.small as string) ||
      (images?.large as string) ||
      "";
    return { id, name: typeof d.name === "string" ? d.name : "", image };
  } catch {
    return null;
  }
}

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

const RAREZA_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "Sin rareza (opcional)" },
  { value: "hollow", label: "Hollow" },
  { value: "foil", label: "Foil" },
  { value: "pokeball", label: "Pokeball" },
  { value: "masterball", label: "Masterball" },
  { value: "first edition", label: "First edition" },
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
  const [rareza, setRareza] = useState<string>("");
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

  const jsonInputRef = useRef<HTMLInputElement>(null);
  const [importandoJson, setImportandoJson] = useState(false);
  const [importJsonProgreso, setImportJsonProgreso] = useState("");
  const [tcgDexNoEncontradas, setTcgDexNoEncontradas] = useState<string[]>([]);
  const [importJsonError, setImportJsonError] = useState("");

  const totalEurCards = useMemo(
    () => lineas.reduce((sum, l) => sum + l.eur_total_lot, 0),
    [lineas],
  );

  const onArchivoJsonSeleccionado = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setImportJsonError("");
    setImportandoJson(true);
    setImportJsonProgreso("Leyendo archivo…");

    let rows: CardTraderJsonRow[];
    try {
      const text = await file.text();
      const parsed: unknown = JSON.parse(text);
      if (!Array.isArray(parsed)) {
        setImportJsonError("El JSON debe ser un array de ítems (p. ej. cardtrader_order_with_tcgdex.json).");
        setImportandoJson(false);
        setImportJsonProgreso("");
        return;
      }
      rows = parsed as CardTraderJsonRow[];
    } catch {
      setImportJsonError("No se pudo leer o parsear el archivo JSON.");
      setImportandoJson(false);
      setImportJsonProgreso("");
      return;
    }

    const total = rows.length;
    const notFound: string[] = [];
    const results: (LineaEntrada | null)[] = new Array(total).fill(null);
    let done = 0;
    let nextIndex = 0;
    const concurrency = Math.min(8, Math.max(1, total));

    const processOne = async (i: number) => {
      const row = rows[i];
      const qtyRaw = Math.floor(Number(row.quantity));
      const eurTotal = Number(row.price_eur);

      if (!Number.isFinite(qtyRaw) || qtyRaw <= 0 || !Number.isFinite(eurTotal) || eurTotal <= 0) {
        notFound.push(
          `Fila ${i + 1}: "${String(row.card_name || "").trim() || "sin nombre"}" — cantidad o price_eur inválido`,
        );
        done++;
        setImportJsonProgreso(`Procesando ${done}/${total}…`);
        return;
      }

      const language = mapCardTraderLang(row.language_code);
      const rareza = inferRarezaFromCardTrader(row);
      const baseName = String(row.card_name || "").trim() || "Sin nombre";

      const dexId =
        row.tcgdex_card_id != null && String(row.tcgdex_card_id).trim() !== ""
          ? String(row.tcgdex_card_id).trim()
          : "";

      let card_id: string;
      let card_name = baseName;
      let image_url = "";

      if (dexId) {
        const card = await fetchTcgDexCard(dexId);
        if (card) {
          card_id = card.id;
          if (card.name) card_name = card.name;
          image_url = card.image || "";
        } else {
          card_id = dexId;
          notFound.push(
            `${baseName}${row.expansion ? ` — ${row.expansion}` : ""} · ID TCGdex «${dexId}» sin respuesta en la API${row.order_item_id != null ? ` · order_item_id ${row.order_item_id}` : ""}`,
          );
        }
      } else {
        card_id =
          row.order_item_id != null ? `import-${row.order_item_id}` : `import-fila-${i + 1}`;
        const errHint = row.tcgdex_error ? String(row.tcgdex_error) : "sin tcgdex_card_id";
        notFound.push(
          `${baseName}${row.expansion ? ` — ${row.expansion}` : ""} · No hay carta en TCGdex (${errHint})${row.order_item_id != null ? ` · order_item_id ${row.order_item_id}` : ""}`,
        );
      }

      results[i] = {
        card_id,
        card_name,
        image_url,
        language,
        quantity: qtyRaw,
        eur_total_lot: eurTotal,
        rareza,
      };

      done++;
      setImportJsonProgreso(`Procesando ${done}/${total}…`);
    };

    const worker = async () => {
      while (true) {
        const i = nextIndex++;
        if (i >= total) break;
        await processOne(i);
      }
    };

    await Promise.all(Array.from({ length: concurrency }, () => worker()));

    setLineas((prev) => {
      let next = prev;
      for (const line of results) {
        if (line) next = mergeLineIntoList(next, line);
      }
      return next;
    });

    setTcgDexNoEncontradas(notFound);
    setImportandoJson(false);
    setImportJsonProgreso("");
  };

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
    setRareza("");
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

    const rarezaNorm: CartaRareza = rareza.trim() === "" ? null : (rareza as CartaRareza);

    const nuevaLinea: LineaEntrada = {
      card_id: seleccion.id,
      card_name: seleccion.name,
      image_url: seleccion.image,
      language,
      quantity,
      eur_total_lot: eurTotal,
      rareza: rarezaNorm,
    };
    setLineas((prev) => mergeLineIntoList(prev, nuevaLinea));

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
          rareza: l.rareza ?? null,
          card_name: l.card_name,
          image_url: l.image_url || undefined,
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
        <div className="flex flex-wrap items-center gap-2 justify-end">
          <input
            ref={jsonInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={onArchivoJsonSeleccionado}
          />
          <button
            type="button"
            onClick={() => jsonInputRef.current?.click()}
            disabled={importandoJson}
            className="bg-slate-700 hover:bg-slate-800 text-white px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {importandoJson ? importJsonProgreso || "Importando…" : "Importar desde JSON"}
          </button>
          <button
            type="button"
            onClick={() => navigate("/incoming")}
            className="text-blue-600 hover:underline font-medium"
          >
            ← Volver
          </button>
        </div>
      </div>

      {importJsonError ? (
        <div
          className="mb-4 border border-red-300 bg-red-50 rounded-lg p-4 text-sm text-red-900"
          role="alert"
        >
          <div className="flex justify-between items-start gap-2">
            <p>{importJsonError}</p>
            <button
              type="button"
              className="text-red-800 underline shrink-0"
              onClick={() => setImportJsonError("")}
            >
              Cerrar
            </button>
          </div>
        </div>
      ) : null}

      {tcgDexNoEncontradas.length > 0 ? (
        <div
          className="mb-4 border border-amber-400 bg-amber-50 rounded-lg p-4 text-sm text-amber-950"
          role="status"
        >
          <div className="flex justify-between items-start gap-2 mb-2">
            <h2 className="font-semibold">
              Cartas sin datos en TCGdex ({tcgDexNoEncontradas.length})
            </h2>
            <button
              type="button"
              className="text-amber-900 underline shrink-0"
              onClick={() => setTcgDexNoEncontradas([])}
            >
              Cerrar aviso
            </button>
          </div>
          <p className="text-xs text-amber-900/90 mb-2">
            Se importaron igualmente al listado (nombre del JSON, sin imagen TCGdex si aplica). Este aviso no se
            oculta solo: revisa estas filas antes de crear la compra.
          </p>
          <ul className="list-disc pl-5 max-h-64 overflow-y-auto space-y-1">
            {tcgDexNoEncontradas.map((t, i) => (
              <li key={`${i}-${t.slice(0, 24)}`}>{t}</li>
            ))}
          </ul>
        </div>
      ) : null}

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
                  {l.image_url ? (
                    <img
                      src={l.image_url}
                      alt={l.card_name}
                      className="w-14 h-20 object-contain border rounded bg-gray-50"
                    />
                  ) : (
                    <div className="w-14 h-20 border rounded bg-gray-100 flex items-center justify-center text-[10px] text-gray-500 text-center px-1">
                      Sin imagen
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-800 truncate">
                      {l.card_name}
                    </div>
                    <div className="text-xs text-gray-500">{l.card_id}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      Idioma: {l.language} · Cantidad: {l.quantity}
                      {l.rareza ? ` · Rareza: ${l.rareza}` : ""}
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

                <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                      Rareza
                    </label>
                    <select
                      value={rareza}
                      onChange={(e) => setRareza(e.target.value)}
                      className="w-full px-3 py-2 border rounded-md"
                    >
                      {RAREZA_OPTIONS.map((o) => (
                        <option key={o.value || "none"} value={o.value}>
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

                  <div className="sm:col-span-3">
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

