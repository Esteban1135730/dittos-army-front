import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import ConvertirEurosAPesos from "../../utils/tasa";
import CardDetail from "./components/card.detail";

export type Expansion = {
  id: string;
  name: string;
  series: string;
  printedTotal: number;
  total: number;
  ptcgoCode: string;
};

export type Carta = {
  id: string;
  name: string;
  supertype: string;
  number: string;
  rarity: string;
  legalities: {
    unlimited: string;
    standard: string;
    expanded: string;
  };
  regulationMark: string;
  images: {
    small: string;
    large: string;
  };
  tcgplayer: {
    url: string;
    updatedAt: string;
    prices: {
      reverseHolofoil?: { market: number };
      normal?: { market: number };
    };
  };
  cardmarket: {
    url: string;
    updatedAt: string;
    prices: {
      averageSellPrice: number;
    };
  };
};

export default function Stock() {
  // -----------------------------
  // Estados de búsqueda y selección
  // -----------------------------
  const [busqueda, setBusqueda] = useState("");
  const [filtroExpansion, setFiltroExpansion] = useState("");
  const [mostrarLista, setMostrarLista] = useState(false);
  const [expansionSeleccionada, setExpansionSeleccionada] = useState("");
  const [expansion, setExpansion] = useState<Expansion | null>(null);
  const [cartaSeleccionada, setCartaSeleccionada] = useState<Carta | null>(
    null
  );

  // -----------------------------
  // Estados financieros
  // -----------------------------
  const [gananciaEsperada, setGananciaEsperada] = useState<number>(30);
  const [costoCarta, setCostoCarta] = useState<number>(0);
  const [costoEnvio, setCostoEnvio] = useState<number>(0);
  const [cartasEnvio, setCartasEnvio] = useState<number>(1);
  const [copias, setCopias] = useState<number>(1);

  const costoRealCarta = costoCarta + costoEnvio / cartasEnvio;

  // -----------------------------
  // Fetch de datos (expansiones y cartas)
  // -----------------------------
  const { data: expansiones = [], isLoading: cargandoExpansiones } = useQuery({
    queryKey: ["expansiones"],
    queryFn: async () => {
      const res = await axios.get("http://localhost:3000/set");
      return Array.isArray(res.data) ? res.data : [];
    },
    staleTime: Infinity,
  });

  const {
    data: cartas = [],
    isLoading: cargandoCartas,
    isFetching: buscandoCartas,
  } = useQuery({
    queryKey: ["cartas", expansionSeleccionada],
    queryFn: async () => {
      if (!expansionSeleccionada) return [];
      const res = await axios.get(
        `http://localhost:3000/set/${expansionSeleccionada}/cards`
      );
      if (Array.isArray(res.data)) return res.data;
      if (Array.isArray(res.data.cards)) return res.data.cards;
      return [];
    },
    enabled: !!expansionSeleccionada,
  });

  const cartasFiltradas =
    busqueda.trim() !== ""
      ? cartas.filter(
          (carta: Carta) =>
            carta.name.toLowerCase().includes(busqueda.toLowerCase()) ||
            carta.number.includes(busqueda.toLowerCase())
        )
      : cartas.slice(0, 3);

  const expansionesFiltradas = expansiones.filter(
    (exp) =>
      exp.name.toLowerCase().includes(filtroExpansion.toLowerCase()) ||
      exp.ptcgoCode?.toLowerCase().includes(filtroExpansion.toLowerCase())
  );

  // -----------------------------
  // Render JSX
  // -----------------------------
  return (
    <div className="max-w-3xl mx-auto mt-10 bg-white shadow-lg rounded-xl p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">
        Formulario de Cartas
      </h1>

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
                    setFiltroExpansion(`${exp.name} (${exp.ptcgoCode})`);
                    setMostrarLista(false);
                    setCartaSeleccionada(null);
                  }}
                  className="px-4 py-2 cursor-pointer hover:bg-blue-100"
                >
                  {exp.name} ({exp.ptcgoCode})
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
          <p className="text-sm text-gray-500 mt-2">Cargando expansiones...</p>
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
      ) : busqueda && cartasFiltradas.length > 0 ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cartasFiltradas.map((carta: Carta) => (
              <div
                key={carta.id}
                onClick={() => setCartaSeleccionada(carta)}
                className={`bg-white rounded-lg shadow p-4 border flex flex-col cursor-pointer ${
                  cartaSeleccionada?.id === carta.id
                    ? "border-4 border-blue-500 shadow-lg"
                    : "border-gray-200"
                }`}
              >
                <img
                  src={carta.images.small}
                  alt={carta.name}
                  className="w-full h-40 object-contain mb-2"
                />
                <h3 className="text-lg font-semibold text-gray-800">
                  {carta.name} - {expansion?.ptcgoCode} - {carta.number}
                </h3>
                <p className="text-sm text-gray-600 mb-1">
                  Rareza: {carta.rarity || "Desconocida"}
                </p>
              </div>
            ))}
          </div>

          {/* Detalles de la carta seleccionada */}
          {cartaSeleccionada && (
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
              gananciaEsperada={gananciaEsperada}
              setGananciaEsperada={setGananciaEsperada}
            />
          )}
        </>
      ) : (
        busqueda && (
          <p className="text-gray-500">
            No se encontraron cartas con ese nombre.
          </p>
        )
      )}
    </div>
  );
}
