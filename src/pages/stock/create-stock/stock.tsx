import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import CardDetail from "./components/card.detail";
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
  const [cardState, setCardState] = useState<string>("near_mint");
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
  const [currency, setCurrency] = useState<"EUR" | "COP">("EUR");
  const [paginaActual, setPaginaActual] = useState(1);
  const cartasPorPagina = 12;
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
            carta.localId?.includes(busqueda.toLowerCase())
        )
      : cartas;

  // Resetear página cuando cambia la búsqueda o la expansión
  useEffect(() => {
    setPaginaActual(1);
  }, [busqueda, expansionSeleccionada]);

  useEffect(() => {
    setOperationalRareza("");
    setStockTags([]);
  }, [cartaSeleccionada?.id]);

  const toggleStockTag = (tag: StockTagId) => {
    setStockTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const totalPaginas = Math.ceil(cartasFiltradas.length / cartasPorPagina);
  const indiceInicio = (paginaActual - 1) * cartasPorPagina;
  const indiceFin = indiceInicio + cartasPorPagina;
  const cartasPagina = cartasFiltradas.slice(indiceInicio, indiceFin);

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
          {/* Buscador de expansión */}
          <div className="mb-6 relative">
            <label className="block mb-2 text-sm font-medium text-gray-700">
              Buscar expansión
            </label>
            <input
              type="text"
              value={filtroExpansion}
              onChange={(e) => {
                setFiltroExpansion(e.target.value);
                setMostrarLista(true);
              }}
              onFocus={() => setMostrarLista(true)}
              placeholder="Nombre o código de la expansión..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {mostrarLista && (
              <ul className="absolute z-10 bg-white w-full border border-gray-200 max-h-60 overflow-y-auto rounded-lg shadow mt-1">
                {expansionesFiltradas.length > 0 ? (
                  expansionesFiltradas.map((exp: Expansion) => (
                    <li
                      key={exp.id}
                      onClick={() => {
                        setExpansionSeleccionada(exp.id);
                        setExpansion(exp);
                        const label = expansionDisplayName(exp);
                        setFiltroExpansion(
                          exp.ptcgoCode ? `${label} (${exp.ptcgoCode})` : label
                        );
                        setMostrarLista(false);
                        setCartaSeleccionada(null);
                      }}
                      className="px-4 py-2 cursor-pointer hover:bg-blue-100"
                    >
                      {expansionDisplayName(exp)}
                      {exp.ptcgoCode ? ` (${exp.ptcgoCode})` : ""}
                    </li>
                  ))
                ) : (
                  <li className="px-4 py-2 text-gray-500">
                    No se encontraron expansiones.
                  </li>
                )}
              </ul>
            )}
            {cargandoExpansiones && (
              <p className="text-sm text-gray-500 mt-2">
                Cargando expansiones...
              </p>
            )}
          </div>

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

          {/* Listado de cartas */}
          {cargandoCartas || buscandoCartas ? (
            <p className="text-gray-500 text-center">Cargando cartas...</p>
          ) : cartasFiltradas.length > 0 ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {cartasPagina.map((carta: CartaBusquedaDirecta) => (
                  <div
                    key={carta.id}
                    onClick={() => {
                      setCartaSeleccionada(carta);
                      setModalAbierto(true);
                    }}
                    className={`bg-white rounded-lg shadow p-4 border flex flex-col cursor-pointer transition-all hover:shadow-lg ${
                      cartaSeleccionada?.id === carta.id
                        ? "border-4 border-blue-500 shadow-lg"
                        : "border-gray-200"
                    }`}
                  >
                    <img
                      src={carta.image}
                      alt={carta.name}
                      className="w-full h-40 object-contain mb-2"
                    />
                    <h3 className="text-lg font-semibold text-gray-800">
                      {carta.name}{expansion?.ptcgoCode ? ` - ${expansion.ptcgoCode}` : ''} - {carta.localId}
                    </h3>
                  </div>
                ))}
              </div>
              
              {/* Controles de paginación */}
              {totalPaginas > 1 && (
                <div className="mt-6 flex items-center justify-center gap-2">
                  <button
                    onClick={() => setPaginaActual((prev) => Math.max(1, prev - 1))}
                    disabled={paginaActual === 1}
                    className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Anterior
                  </button>
                  
                  <div className="flex gap-1">
                    {Array.from({ length: totalPaginas }, (_, i) => i + 1).map((num) => {
                      // Mostrar solo algunas páginas alrededor de la actual
                      if (
                        num === 1 ||
                        num === totalPaginas ||
                        (num >= paginaActual - 1 && num <= paginaActual + 1)
                      ) {
                        return (
                          <button
                            key={num}
                            onClick={() => setPaginaActual(num)}
                            className={`px-3 py-2 border rounded-md ${
                              paginaActual === num
                                ? "bg-blue-600 text-white border-blue-600"
                                : "border-gray-300 hover:bg-gray-50"
                            }`}
                          >
                            {num}
                          </button>
                        );
                      } else if (num === paginaActual - 2 || num === paginaActual + 2) {
                        return <span key={num} className="px-2">...</span>;
                      }
                      return null;
                    })}
                  </div>
                  
                  <button
                    onClick={() => setPaginaActual((prev) => Math.min(totalPaginas, prev + 1))}
                    disabled={paginaActual === totalPaginas}
                    className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Siguiente
                  </button>
                </div>
              )}
              
              <p className="text-sm text-gray-500 text-center mt-2">
                Mostrando {indiceInicio + 1}-{Math.min(indiceFin, cartasFiltradas.length)} de {cartasFiltradas.length} cartas
              </p>
            </>
          ) : (
            busqueda && (
              <p className="text-gray-500">
                No se encontraron cartas con ese nombre.
              </p>
            )
          )}
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

      {/* Modal de detalles de la carta seleccionada */}
      {modalAbierto && cartaSeleccionada && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setModalAbierto(false);
            }
          }}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header del modal */}
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 rounded-t-xl flex justify-between items-center z-10">
              <h2 className="text-xl font-bold">Detalles de la carta</h2>
              <button
                onClick={() => setModalAbierto(false)}
                className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition-colors"
                aria-label="Cerrar"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Contenido del modal */}
            <div className="p-6">
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

              <div className="mt-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Moneda
                </label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as "EUR" | "COP")}
                  className="w-full px-3 py-2 border rounded-lg border-gray-300 focus:ring-blue-500 focus:outline-none focus:border-blue-500"
                >
                  <option value="EUR">EUR</option>
                  <option value="COP">COP</option>
                </select>
              </div>
              
              <div className="mt-6 flex gap-3">
                <button
                  onClick={guardarStock}
                  disabled={guardando}
                  className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors shadow-md hover:shadow-lg"
                >
                  {guardando ? "Guardando..." : "Guardar stock"}
                </button>
                <button
                  onClick={() => setModalAbierto(false)}
                  className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium transition-colors"
                >
                  Cancelar
                </button>
              </div>
              
              {mensaje && (
                <div className={`mt-4 p-3 rounded-lg text-sm text-center ${
                  mensaje.includes("✅") 
                    ? "bg-green-50 text-green-800 border border-green-200" 
                    : "bg-red-50 text-red-800 border border-red-200"
                }`}>
                  {mensaje}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
