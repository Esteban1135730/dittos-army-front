import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import CardDetail from "./components/card.detail";
import { ExpansionSearch } from "../../../components/add-stock/expansion-search";
import { CardResultGrid } from "../../../components/add-stock/card-result-grid";
import { StockEntryModal } from "../../../components/add-stock/stock-entry-modal";
import type { CreateStockRequestBody } from "../../../types/stock";
import {
  STOCK_TAG_LABEL,
  STOCK_TAG_VALUES,
  type StockTagId,
} from "../../../constants/stock-tags";
import { API_BASE } from "../../../config/api";

export type Expansion = {
  id: string;
  name: string;
  englishName?: string;
  series: string;
  printedTotal: number;
  total: number;
  ptcgoCode: string;
};

// Nuevo tipo para flujo directo
export type CartaBusquedaDirecta = {
  id: string;
  localId: string;
  name: string;
  image: string;
};

const CATALOG_LOCALES = [
  { value: 'en', label: 'EN (Inglés)' },
  { value: 'ja', label: 'JP (Japonés)' },
  { value: 'ko', label: 'KR (Coreano)' },
  { value: 'zh-cn', label: 'ZH (Chino simplificado)' },
] as const;

export default function Stock() {
  // Estado para seleccionar modo de búsqueda
  const [modoBusqueda, setModoBusqueda] = useState<"expansion" | "directa">(
    "expansion"
  );

  // Estados comunes
  const [cartaSeleccionada, setCartaSeleccionada] =
    useState<CartaBusquedaDirecta | null>(null);
  const [costoCarta, setCostoCarta] = useState<number>(0);
  const [costoEnvio, setCostoEnvio] = useState<number>(0);
  const [cartasEnvio, setCartasEnvio] = useState<number>(1);
  const [copias, setCopias] = useState<number>(1);
  const [cardState, setCardState] = useState<string>("disponible");
  const [catalogLocale, setCatalogLocale] = useState<string>("en");
  const [language, setLanguage] = useState<string>("en");
  /** "" = sin variante (mismo catálogo que incoming / PVP) */
  const [operationalRareza, setOperationalRareza] = useState<string>("");
  const [stockTags, setStockTags] = useState<StockTagId[]>([]);

  // ------------------ MODO EXPANSIÓN ------------------
  const [busqueda, setBusqueda] = useState("");
  const [filtroExpansion, setFiltroExpansion] = useState("");
  const [mostrarLista, setMostrarLista] = useState(false);
  const [expansionSeleccionada, setExpansionSeleccionada] = useState("");
  const [expansion, setExpansion] = useState<Expansion | null>(null);
  const [currency, setCurrency] = useState<"EUR" | "COP">("COP");
  const [modalAbierto, setModalAbierto] = useState(false);

  const { data: expansiones = [], isLoading: cargandoExpansiones } = useQuery({
    queryKey: ["expansiones", catalogLocale],
    queryFn: async () => {
      const res = await axios.get(`${API_BASE}/tcg-dex/set`, {
        params: { locale: catalogLocale },
      });
      return Array.isArray(res.data) ? res.data : [];
    },
    staleTime: Infinity,
    enabled: modoBusqueda === "expansion",
  });

  const {
    data: cartas = [],
    isLoading: cargandoCartas,
    isFetching: buscandoCartas,
  } = useQuery({
    queryKey: ["cartas", expansionSeleccionada, catalogLocale],
    queryFn: async () => {
      if (!expansionSeleccionada) return [];
      const res = await axios.get(
        `${API_BASE}/tcg-dex/set/${expansionSeleccionada}/cards`,
        {
          params: { locale: catalogLocale },
        }
      );
      if (Array.isArray(res.data)) return res.data;
      if (Array.isArray(res.data.cards)) return res.data.cards;
      return [];
    },
    enabled: !!expansionSeleccionada && modoBusqueda === "expansion",
  });

  const cartasFiltradas =
    busqueda.trim() !== ""
      ? cartas.filter(
          (carta: CartaBusquedaDirecta) =>
            carta.name.toLowerCase().includes(busqueda.toLowerCase()) ||
            carta.localId?.toLowerCase().includes(busqueda.toLowerCase())
        )
      : cartas;

  useEffect(() => {
    setOperationalRareza("");
    setStockTags([]);
  }, [cartaSeleccionada?.id]);

  const toggleStockTag = (tag: StockTagId) => {
    setStockTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const expansionesFiltradas = expansiones.filter(
    (exp) =>
      (exp.englishName ?? exp.name)
        .toLowerCase()
        .includes(filtroExpansion.toLowerCase()) ||
      exp.name.toLowerCase().includes(filtroExpansion.toLowerCase()) ||
      exp.ptcgoCode?.toLowerCase().includes(filtroExpansion.toLowerCase())
  );
  const expansionDisplayName = (exp: Expansion): string => {
    return exp.englishName?.trim() || exp.name;
  };


  // ------------------ MODO DIRECTO ------------------
  const [nombreCarta, setNombreCarta] = useState("");
  const [resultadosCarta, setResultadosCarta] = useState<
    CartaBusquedaDirecta[]
  >([]);
  const [buscandoCartaDirecta, setBuscandoCartaDirecta] = useState(false);
  const [errorBusqueda, setErrorBusqueda] = useState("");

  const buscarCartaPorNombre = async () => {
    if (!nombreCarta.trim()) return;

    setBuscandoCartaDirecta(true);
    setErrorBusqueda("");
    try {
      const res = await axios.get<CartaBusquedaDirecta[]>(
        `${API_BASE}/tcg-dex/card/search/${encodeURIComponent(
          nombreCarta
        )}`,
        {
          params: { locale: catalogLocale },
        }
      );

      const data = res.data;
      if (Array.isArray(data) && data.length > 0) {
        setResultadosCarta(data);
      } else {
        setResultadosCarta([]);
        setErrorBusqueda("No se encontraron cartas.");
      }
    } catch {
      setErrorBusqueda("Error al buscar la carta.");
      setResultadosCarta([]);
    } finally {
      setBuscandoCartaDirecta(false);
    }
  };

  // GUARDADO
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");

  const guardarStock = async () => {
    setMensaje("");

    if (!cartaSeleccionada) {
      setMensaje("Selecciona una carta antes de guardar.");
      return;
    }

    if (costoCarta <= 0 ||  cartasEnvio <= 0 || copias <= 0) {
      setMensaje("Todos los campos deben ser mayores a cero.");
      return;
    }

    const body: CreateStockRequestBody = {
      card_id: cartaSeleccionada.id,
      card_name: cartaSeleccionada.name,
      shipment: costoEnvio,
      unity_cost: costoCarta,
      cards_in_shipmet: cartasEnvio,
      image_url: cartaSeleccionada.image || "",
      currency: currency,
      card_state: cardState,
    };

    if (language) {
      body.language = language;
    }
    const rzTrim = operationalRareza.trim();
    if (rzTrim !== "") {
      body.rareza = rzTrim;
    }
    body.holofoil = rzTrim === "holofoil";
    body.league_card = rzTrim === "league card";
    body.tags = STOCK_TAG_VALUES.filter((t) => stockTags.includes(t));

    try {
      setGuardando(true);

      // Ejecutar múltiples peticiones
      const peticiones = Array.from({ length: copias }).map(() =>
        axios.post(`${API_BASE}/stock`, body)
      );

      await Promise.all(peticiones);

      setMensaje(`✅ Se guardaron ${copias} copias exitosamente.`);
      
      // Cerrar modal después de guardar exitosamente
      setTimeout(() => {
        setModalAbierto(false);
        setCartaSeleccionada(null);
        setMensaje("");
      }, 1500);
    } catch {
      setMensaje("❌ Error al guardar una o más copias.");
    } finally {
      setGuardando(false);
    }
  };

  // ------------------ RENDER ------------------
  return (
    <div className="max-w-3xl mx-auto mt-10 bg-white shadow-lg rounded-xl p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">
        Formulario de Cartas
      </h1>

      {/* Selector de modo de búsqueda */}
      <div className="mb-6">
        <label className="block mb-2 font-medium text-gray-700">
          Modo de búsqueda:
        </label>
        <select
          value={modoBusqueda}
          onChange={(e) => {
            const modo = e.target.value as "expansion" | "directa";
            setModoBusqueda(modo);
            setCartaSeleccionada(null);
          }}
          className="px-4 py-2 border border-gray-300 rounded-lg"
        >
          <option value="expansion">Buscar por expansión</option>
          <option value="directa">Buscar por nombre de carta</option>
        </select>
      </div>
      <div className="mb-6">
        <label className="block mb-2 font-medium text-gray-700">
          Idioma del catálogo TCGdex:
        </label>
        <select
          value={catalogLocale}
          onChange={(e) => {
            const next = e.target.value;
            setCatalogLocale(next);
            setLanguage(next);
            setExpansionSeleccionada("");
            setExpansion(null);
            setFiltroExpansion("");
            setBusqueda("");
            setResultadosCarta([]);
            setCartaSeleccionada(null);
          }}
          className="px-4 py-2 border border-gray-300 rounded-lg"
        >
          {CATALOG_LOCALES.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* ------------------ MODO EXPANSIÓN ------------------ */}
      {modoBusqueda === "expansion" && (
        <>
          <ExpansionSearch
            value={filtroExpansion}
            onChange={(value) => {
              setFiltroExpansion(value);
              setMostrarLista(true);
            }}
            open={mostrarLista}
            onOpen={() => setMostrarLista(true)}
            loading={cargandoExpansiones}
            items={expansionesFiltradas.map((exp: Expansion) => {
              const label = expansionDisplayName(exp);
              return {
                id: exp.id,
                label: exp.ptcgoCode ? `${label} (${exp.ptcgoCode})` : label,
              };
            })}
            onPick={(item) => {
              const exp = expansiones.find((row: Expansion) => row.id === item.id);
              if (!exp) return;
              setExpansionSeleccionada(exp.id);
              setExpansion(exp);
              setFiltroExpansion(item.label);
              setMostrarLista(false);
              setCartaSeleccionada(null);
            }}
          />

          {/* Buscador de carta */}
          {expansionSeleccionada && (
            <div className="mb-6">
              <label className="block mb-2 text-sm font-medium text-gray-700">
                Buscar carta
              </label>
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Nombre de la carta..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          <CardResultGrid
            cards={cartasFiltradas.map((carta: CartaBusquedaDirecta) => ({
              id: carta.id,
              name: carta.name,
              image: carta.image,
              subtitle: expansion?.ptcgoCode
                ? `${expansion.ptcgoCode} - ${carta.localId}`
                : carta.localId,
            }))}
            loading={cargandoCartas || buscandoCartas}
            selectedId={cartaSeleccionada?.id}
            resetKey={`${expansionSeleccionada}:${busqueda}`}
            emptyWhenFiltered={Boolean(busqueda)}
            onSelect={(tile) => {
              const carta = cartasFiltradas.find(
                (row: CartaBusquedaDirecta) => row.id === tile.id,
              );
              if (!carta) return;
              setCartaSeleccionada(carta);
              setModalAbierto(true);
            }}
          />
        </>
      )}

      {modoBusqueda === "directa" && (
        <div className="mb-6">
          <label className="block mb-2 text-sm font-medium text-gray-700">
            Nombre de la carta
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={nombreCarta}
              onChange={(e) => setNombreCarta(e.target.value)}
              placeholder="Ej. Pikachu"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            />
            <button
              onClick={buscarCartaPorNombre}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg"
              disabled={buscandoCartaDirecta}
            >
              {buscandoCartaDirecta ? "Buscando..." : "Buscar"}
            </button>
          </div>

          {errorBusqueda && (
            <p className="text-red-500 text-sm mt-2">{errorBusqueda}</p>
          )}

          {resultadosCarta.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-4">
              {resultadosCarta.map((carta) => (
                <div
                  key={carta.id}
                  onClick={() => {
                    setCartaSeleccionada(carta);
                    setModalAbierto(true);
                  }}
                  className={`cursor-pointer border rounded-lg p-2 shadow hover:shadow-lg transition ${
                    cartaSeleccionada?.id === carta.id
                      ? "border-blue-500"
                      : "border-gray-200"
                  }`}
                >
                  <img
                    src={carta.image}
                    alt={carta.name}
                    className="w-full h-40 object-contain mb-2"
                  />
                  <p className="text-sm font-medium text-center">
                    {carta.name}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <StockEntryModal
        open={modalAbierto && Boolean(cartaSeleccionada)}
        saving={guardando}
        message={mensaje}
        currency={currency}
        onCurrency={setCurrency}
        onClose={() => setModalAbierto(false)}
        onSave={guardarStock}
      >
        {cartaSeleccionada ? (
          <>
            <CardDetail
              carta={cartaSeleccionada}
              costoCarta={costoCarta}
              setCostoCarta={setCostoCarta}
              costoEnvio={costoEnvio}
              setCostoEnvio={setCostoEnvio}
              cartasEnvio={cartasEnvio}
              setCartasEnvio={setCartasEnvio}
              copias={copias}
              setCopias={setCopias}
              cardState={cardState}
              setCardState={setCardState}
              language={language}
              setLanguage={setLanguage}
              operationalRareza={operationalRareza}
              setOperationalRareza={setOperationalRareza}
            />
            <div className="mt-6">
              <span className="block text-sm font-medium text-gray-700 mb-2">
                Tags (filtro)
              </span>
              <div className="flex flex-wrap gap-3">
                {STOCK_TAG_VALUES.map((tag) => (
                  <label
                    key={tag}
                    className="inline-flex items-center gap-2 cursor-pointer text-sm text-gray-800"
                  >
                    <input
                      type="checkbox"
                      checked={stockTags.includes(tag)}
                      onChange={() => toggleStockTag(tag)}
                      className="rounded border-gray-300"
                    />
                    {STOCK_TAG_LABEL[tag]}
                  </label>
                ))}
              </div>
            </div>
          </>
        ) : null}
      </StockEntryModal>
    </div>
  );
}
