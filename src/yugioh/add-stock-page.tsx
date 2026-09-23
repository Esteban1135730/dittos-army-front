import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { getApiOrigin } from "../config/api";
import CardDetail from "../pages/stock/create-stock/components/card.detail";
import type { CartaBusquedaDirecta } from "../pages/stock/create-stock/stock";
import { ExpansionSearch } from "../components/add-stock/expansion-search";
import { CardResultGrid } from "../components/add-stock/card-result-grid";
import { StockEntryModal } from "../components/add-stock/stock-entry-modal";

type YugiohSet = {
  code: string;
  name: string;
  cardCount: number;
};

type YugiohCard = {
  id: string;
  name: string;
  number: string;
  rarity: string;
  setName: string;
  image: string;
};

function yugiohUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${getApiOrigin()}/yugioh${normalized}`;
}

function asDetalle(card: YugiohCard): CartaBusquedaDirecta {
  return {
    id: card.id,
    localId: card.number,
    name: card.name,
    image: card.image,
  };
}

export default function YugiohAddStockPage() {
  const [modoBusqueda, setModoBusqueda] = useState<"expansion" | "directa">("expansion");
  const [filtroExpansion, setFiltroExpansion] = useState("");
  const [mostrarLista, setMostrarLista] = useState(false);
  const [setName, setSetName] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [carta, setCarta] = useState<YugiohCard | null>(null);
  const [nombreCarta, setNombreCarta] = useState("");
  const [resultadosCarta, setResultadosCarta] = useState<YugiohCard[]>([]);
  const [buscandoCartaDirecta, setBuscandoCartaDirecta] = useState(false);
  const [errorBusqueda, setErrorBusqueda] = useState("");
  const [costoCarta, setCostoCarta] = useState(0);
  const [costoEnvio, setCostoEnvio] = useState(0);
  const [cartasEnvio, setCartasEnvio] = useState(1);
  const [copias, setCopias] = useState(1);
  const [cardState, setCardState] = useState("disponible");
  const [language, setLanguage] = useState("en");
  const [currency, setCurrency] = useState<"EUR" | "COP">("COP");
  const [modalAbierto, setModalAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");

  const setsQuery = useQuery({
    queryKey: ["yugioh-sets"],
    queryFn: async () => {
      const res = await axios.get<YugiohSet[]>(yugiohUrl("/sets"));
      return Array.isArray(res.data) ? res.data : [];
    },
    staleTime: 60 * 60 * 1000,
    enabled: modoBusqueda === "expansion",
  });

  const expansiones = setsQuery.data ?? [];
  const expansionesFiltradas = useMemo(() => {
    const q = filtroExpansion.trim().toLowerCase();
    const matched = q
      ? expansiones.filter(
          (set) => set.name.toLowerCase().includes(q) || set.code.toLowerCase().includes(q),
        )
      : expansiones;
    return matched.slice(0, 40);
  }, [expansiones, filtroExpansion]);

  const selectedSet = expansiones.find((set) => set.name === setName) ?? null;

  const cardsQuery = useQuery({
    queryKey: ["yugioh-cards", setName],
    enabled: Boolean(setName) && modoBusqueda === "expansion",
    queryFn: async () => {
      const res = await axios.get<{ set: YugiohSet; cards: YugiohCard[] }>(
        yugiohUrl(`/sets/${encodeURIComponent(setName)}/cards`),
      );
      return res.data.cards ?? [];
    },
  });

  const cartas = cardsQuery.data ?? [];
  const cartasFiltradas =
    busqueda.trim() !== ""
      ? cartas.filter(
          (row) =>
            row.name.toLowerCase().includes(busqueda.toLowerCase()) ||
            row.number.toLowerCase().includes(busqueda.toLowerCase()),
        )
      : cartas;

  const detalle = carta ? asDetalle(carta) : null;

  const buscarCartaPorNombre = async () => {
    if (!nombreCarta.trim()) return;
    setBuscandoCartaDirecta(true);
    setErrorBusqueda("");
    try {
      const res = await axios.get<YugiohCard[]>(yugiohUrl("/cards"), {
        params: { q: nombreCarta.trim() },
      });
      const data = Array.isArray(res.data) ? res.data : [];
      setResultadosCarta(data);
      if (data.length === 0) setErrorBusqueda("No se encontraron cartas.");
    } catch {
      setErrorBusqueda("Error al buscar la carta.");
      setResultadosCarta([]);
    } finally {
      setBuscandoCartaDirecta(false);
    }
  };

  const abrir = (row: YugiohCard) => {
    setCarta(row);
    setModalAbierto(true);
    setMensaje("");
  };

  const guardarStock = async () => {
    setMensaje("");
    if (!carta) {
      setMensaje("Selecciona una carta antes de guardar.");
      return;
    }
    if (costoCarta <= 0 || cartasEnvio <= 0 || copias <= 0) {
      setMensaje("Todos los campos deben ser mayores a cero.");
      return;
    }
    try {
      setGuardando(true);
      await axios.post(yugiohUrl("/stock"), {
        card_id: carta.id,
        card_name: carta.name,
        set_name: selectedSet?.name || carta.setName,
        set_code: selectedSet?.code || "",
        card_number: carta.number,
        rarity: carta.rarity,
        image_url: carta.image,
        unity_cost: costoCarta,
        shipment: costoEnvio,
        cards_in_shipmet: cartasEnvio,
        copies: copias,
        currency,
        card_state: cardState,
        language,
      });
      setMensaje(`✅ Se guardaron ${copias} copias exitosamente.`);
      setTimeout(() => {
        setModalAbierto(false);
        setCarta(null);
        setMensaje("");
      }, 1500);
    } catch {
      setMensaje("❌ Error al guardar una o más copias.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto mt-10 bg-white shadow-lg rounded-xl p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Formulario de Cartas</h1>

      <div className="mb-6">
        <label className="block mb-2 font-medium text-gray-700">Modo de búsqueda:</label>
        <select
          value={modoBusqueda}
          onChange={(e) => {
            setModoBusqueda(e.target.value as "expansion" | "directa");
            setCarta(null);
          }}
          className="px-4 py-2 border border-gray-300 rounded-lg"
        >
          <option value="expansion">Buscar por expansión</option>
          <option value="directa">Buscar por nombre de carta</option>
        </select>
      </div>

      {modoBusqueda === "expansion" ? (
        <>
          <ExpansionSearch
            value={filtroExpansion}
            onChange={(value) => {
              setFiltroExpansion(value);
              setMostrarLista(true);
            }}
            open={mostrarLista}
            onOpen={() => setMostrarLista(true)}
            loading={setsQuery.isLoading}
            items={expansionesFiltradas.map((set) => ({
              id: set.name,
              label: `${set.name} (${set.code})`,
            }))}
            onPick={(item) => {
              setSetName(item.id);
              setFiltroExpansion(item.label);
              setMostrarLista(false);
              setCarta(null);
              setBusqueda("");
            }}
          />

          {setName ? (
            <div className="mb-6">
              <label className="block mb-2 text-sm font-medium text-gray-700">Buscar carta</label>
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Nombre de la carta..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          ) : null}

          <CardResultGrid
            cards={cartasFiltradas.map((row) => ({
              id: row.id,
              name: row.name,
              image: row.image,
              subtitle: selectedSet?.code
                ? `${selectedSet.code} - ${row.number}`
                : row.number,
            }))}
            loading={Boolean(setName) && cardsQuery.isLoading}
            selectedId={carta?.id}
            resetKey={`${setName}:${busqueda}`}
            emptyWhenFiltered={Boolean(busqueda)}
            onSelect={(tile) => {
              const row = cartasFiltradas.find((item) => item.id === tile.id);
              if (row) abrir(row);
            }}
          />
        </>
      ) : (
        <div className="mb-6">
          <label className="block mb-2 text-sm font-medium text-gray-700">Nombre de la carta</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={nombreCarta}
              onChange={(e) => setNombreCarta(e.target.value)}
              placeholder="Ej. Dark Magician"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            />
            <button
              type="button"
              onClick={buscarCartaPorNombre}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg"
              disabled={buscandoCartaDirecta}
            >
              {buscandoCartaDirecta ? "Buscando..." : "Buscar"}
            </button>
          </div>
          {errorBusqueda ? <p className="text-red-500 text-sm mt-2">{errorBusqueda}</p> : null}
          {resultadosCarta.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-4">
              {resultadosCarta.map((row) => (
                <div
                  key={`${row.id}-${row.number}`}
                  onClick={() => abrir(row)}
                  className={`cursor-pointer border rounded-lg p-2 shadow hover:shadow-lg transition ${
                    carta?.id === row.id ? "border-blue-500" : "border-gray-200"
                  }`}
                >
                  <img src={row.image} alt={row.name} className="w-full h-40 object-contain mb-2" />
                  <p className="text-sm font-medium text-center">
                    {row.name}
                    {row.number ? ` - ${row.number}` : ""}
                  </p>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      )}

      <StockEntryModal
        open={modalAbierto && Boolean(detalle)}
        saving={guardando}
        message={mensaje}
        currency={currency}
        onCurrency={setCurrency}
        onClose={() => setModalAbierto(false)}
        onSave={guardarStock}
      >
        {detalle ? (
          <CardDetail
            carta={detalle}
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
          />
        ) : null}
      </StockEntryModal>
    </div>
  );
}
