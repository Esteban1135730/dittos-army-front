import { useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { DataGrid, type GridColDef } from "@mui/x-data-grid";
import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useExchangeRates } from "../../utils/tasa";
import { formatCOP } from "../../utils/convert";

type StockItem = {
  _id: string;
  card_id: string;
  card_name: string;
  card_state: string;
  image_url: string;
  card_cost: number;
  currency: string;
  pvp?: number;
  pvp_currency?: string;
};

type ClientItem = {
  _id: string;
  nombre: string;
  tienda_entrega: string;
  celular?: string;
  metodo_contacto: string;
};

type ReservaItem = {
  _id: string;
  client_id: string;
  stock_id: string;
  precio: number;
  currency: string;
};

const API_STOCK = "http://localhost:3000/stock";
const API_CLIENT = "http://localhost:3000/client";
const API_RESERVA = "http://localhost:3000/reserva";

export default function ReservarCartasPage() {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { convert } = useExchangeRates();
  const [precios, setPrecios] = useState<Record<string, string>>({});
  const [preciosReservadas, setPreciosReservadas] = useState<Record<string, string>>({});
  const [reservandoId, setReservandoId] = useState<string | null>(null);
  const [quitandoId, setQuitandoId] = useState<string | null>(null);
  const [actualizandoPrecioId, setActualizandoPrecioId] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState("");
  const [busqueda, setBusqueda] = useState("");

  const { data: client, isLoading: loadingClient } = useQuery<ClientItem>({
    queryKey: ["client", clientId],
    queryFn: async () => {
      const res = await axios.get(`${API_CLIENT}/${clientId}`);
      return res.data;
    },
    enabled: !!clientId,
  });

  const { data: stockRaw = [], isLoading: loadingStock } = useQuery<StockItem[]>({
    queryKey: ["stock"],
    queryFn: async () => {
      const res = await axios.get(API_STOCK);
      return Array.isArray(res.data) ? res.data : [];
    },
  });

  const { data: reservasRaw = [], isLoading: loadingReservas } = useQuery<ReservaItem[]>({
    queryKey: ["reservas", clientId],
    queryFn: async () => {
      const res = await axios.get(`${API_RESERVA}/client/${clientId}`);
      return Array.isArray(res.data) ? res.data : [];
    },
    enabled: !!clientId,
  });

  const stockDisponible = useMemo(
    () =>
      stockRaw.filter(
        (s) =>
          s.card_state !== "vendida" &&
          s.card_state !== "propiedad" &&
          s.card_state !== "reserva"
      ),
    [stockRaw]
  );

  const stockDisponibleFiltrado = useMemo(() => {
    if (!busqueda.trim()) return stockDisponible;
    const q = busqueda.toLowerCase().trim();
    return stockDisponible.filter(
      (s) =>
        s.card_name.toLowerCase().includes(q) ||
        (s.card_id && s.card_id.toLowerCase().includes(q))
    );
  }, [stockDisponible, busqueda]);

  const reservasConStock = useMemo(() => {
    return reservasRaw
      .map((r) => {
        const stock = stockRaw.find((s) => s._id === r.stock_id);
        return stock ? { ...r, card_name: stock.card_name, image_url: stock.image_url, card_id: stock.card_id } : null;
      })
      .filter((r): r is ReservaItem & { card_name: string; image_url: string; card_id: string } => r !== null);
  }, [reservasRaw, stockRaw]);

  const getPrecioDefault = (item: StockItem): number => {
    if (item.pvp != null && item.pvp > 0 && item.pvp_currency) {
      if (item.pvp_currency === "COP") return item.pvp;
      if (item.pvp_currency === "EUR") return convert.toCopFromEur(item.pvp) ?? 0;
      if (item.pvp_currency === "USD") return convert.toCopFromUsd(item.pvp) ?? 0;
    }
    return 0;
  };

  const getPrecioReserva = (stockId: string, item: StockItem): number => {
    const v = precios[stockId];
    if (v !== undefined && v !== "") {
      const n = parseFloat(v.replace(",", "."));
      if (!Number.isNaN(n)) return n;
    }
    return getPrecioDefault(item);
  };

  const handleReservar = async (item: StockItem) => {
    if (!clientId || !client) return;
    const precio = getPrecioReserva(item._id, item);
    if (precio <= 0) {
      setMensaje("Ingresa un precio mayor a 0.");
      return;
    }
    setMensaje("");
    setReservandoId(item._id);
    try {
      const res = await axios.post(API_RESERVA, {
        client_id: clientId,
        stock_id: item._id,
        precio: Math.round(precio),
        currency: "COP",
      });
      if (res.data && (res.data as { error?: string }).error) {
        setMensaje((res.data as { error: string }).error);
        return;
      }
      const next = { ...precios };
      delete next[item._id];
      setPrecios(next);
      await queryClient.invalidateQueries({ queryKey: ["stock"] });
      await queryClient.invalidateQueries({ queryKey: ["reservas", clientId] });
      setMensaje(`Carta "${item.card_name}" reservada correctamente.`);
    } catch {
      setMensaje("Error al reservar la carta.");
    } finally {
      setReservandoId(null);
    }
  };

  const handleQuitarReserva = async (stockId: string) => {
    setMensaje("");
    setQuitandoId(stockId);
    try {
      const res = await axios.delete(`${API_RESERVA}/stock/${stockId}`);
      if ((res.data as { success?: boolean }).success !== true) {
        setMensaje((res.data as { error?: string }).error ?? "Error al quitar reserva.");
        return;
      }
      const next = { ...preciosReservadas };
      delete next[stockId];
      setPreciosReservadas(next);
      await queryClient.invalidateQueries({ queryKey: ["stock"] });
      await queryClient.invalidateQueries({ queryKey: ["reservas", clientId] });
      setMensaje("Carta quitada de la reserva.");
    } catch {
      setMensaje("Error al quitar la reserva.");
    } finally {
      setQuitandoId(null);
    }
  };

  const handleActualizarPrecioReserva = async (stockId: string, precioStr: string) => {
    const n = parseFloat(precioStr.replace(",", "."));
    if (Number.isNaN(n) || n < 0) return;
    setActualizandoPrecioId(stockId);
    setMensaje("");
    try {
      const res = await axios.put(`${API_RESERVA}/stock/${stockId}`, {
        precio: Math.round(n),
        currency: "COP",
      });
      if (res.data && (res.data as { error?: string }).error) {
        setMensaje((res.data as { error: string }).error);
        return;
      }
      setPreciosReservadas((prev) => {
        const next = { ...prev };
        delete next[stockId];
        return next;
      });
      await queryClient.invalidateQueries({ queryKey: ["reservas", clientId] });
    } catch {
      setMensaje("Error al actualizar el precio.");
    } finally {
      setActualizandoPrecioId(null);
    }
  };

  const getPrecioReservaInput = (stockId: string, precioActual: number): string => {
    if (preciosReservadas[stockId] !== undefined) return preciosReservadas[stockId];
    return precioActual > 0 ? String(precioActual) : "";
  };

  const columns: GridColDef[] = [
    {
      field: "image_url",
      headerName: "Imagen",
      width: 80,
      renderCell: (params) => (
        <img
          src={params.value}
          alt="carta"
          className="object-contain w-12 h-16"
        />
      ),
      sortable: false,
    },
    { field: "card_name", headerName: "Nombre", flex: 1, minWidth: 200 },
    { field: "card_id", headerName: "Carta ID", width: 120 },
    {
      field: "pvp",
      headerName: "PVP",
      width: 140,
      renderCell: (params) => {
        const pvp = params.row.pvp;
        const cur = params.row.pvp_currency;
        if (pvp == null || pvp <= 0)
          return <span className="text-gray-400">—</span>;
        let cop = 0;
        if (cur === "COP") cop = pvp;
        else if (cur === "EUR") cop = convert.toCopFromEur(pvp) ?? 0;
        else if (cur === "USD") cop = convert.toCopFromUsd(pvp) ?? 0;
        return <span>COP {formatCOP(cop.toFixed(0))}</span>;
      },
    },
    {
      field: "precio_reserva",
      headerName: "Precio reserva (COP)",
      width: 180,
      renderCell: (params) => {
        const item = params.row as StockItem;
        const defaultVal = getPrecioDefault(item);
        const value = precios[item._id] ?? (defaultVal > 0 ? String(defaultVal) : "");
        return (
          <input
            type="text"
            inputMode="decimal"
            value={value}
            onChange={(e) =>
              setPrecios((prev) => ({ ...prev, [item._id]: e.target.value }))
            }
            placeholder={defaultVal > 0 ? String(defaultVal) : "0"}
            className="w-full max-w-[140px] px-2 py-1 border border-gray-300 rounded text-sm"
          />
        );
      },
      sortable: false,
    },
    {
      field: "reservar",
      headerName: "Reservar",
      width: 120,
      sortable: false,
      renderCell: (params) => {
        const item = params.row as StockItem;
        const loading = reservandoId === item._id;
        return (
          <button
            type="button"
            onClick={() => handleReservar(item)}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "..." : "Reservar"}
          </button>
        );
      },
    },
  ];

  if (!clientId) {
    return (
      <div className="p-6">
        <p className="text-red-500">Falta el cliente. Ve desde Clientes → Agregar cartas al pedido.</p>
        <button
          type="button"
          onClick={() => navigate("/clientes")}
          className="mt-4 text-blue-600 hover:underline"
        >
          Ir a Clientes
        </button>
      </div>
    );
  }

  if (loadingClient || !client) {
    return <p className="text-center text-gray-500 p-6">Cargando cliente...</p>;
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex items-center gap-4 mb-6">
        <button
          type="button"
          onClick={() => navigate("/clientes")}
          className="text-gray-600 hover:text-gray-800"
        >
          ← Clientes
        </button>
        <h1 className="text-2xl font-bold text-gray-800">
          Reservar cartas para {client.nombre}
        </h1>
      </div>
      <p className="text-sm text-gray-600 mb-4">
        Tienda de entrega: {client.tienda_entrega}
        {client.celular && ` · Cel: ${client.celular}`}
      </p>

      {mensaje && (
        <p
          className={`mb-4 text-sm ${
            mensaje.includes("Error") || mensaje.includes("ya") ? "text-red-600" : "text-green-600"
          }`}
        >
          {mensaje}
        </p>
      )}

      {/* Cartas reservadas: siempre visible */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Cartas reservadas</h2>
        {loadingReservas ? (
          <p className="text-gray-500 text-sm">Cargando reservas...</p>
        ) : reservasConStock.length === 0 ? (
          <p className="text-gray-500 text-sm">No hay cartas reservadas para este cliente.</p>
        ) : (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <ul className="space-y-3">
              {reservasConStock.map((r) => (
                <li
                  key={r._id}
                  className="flex flex-wrap items-center gap-4 py-2 border-b border-amber-100 last:border-0"
                >
                  <img
                    src={r.image_url}
                    alt={r.card_name}
                    className="object-contain w-12 h-16 flex-shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-800 truncate">{r.card_name}</p>
                    <p className="text-xs text-gray-500">{r.card_id}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-600">Precio (COP):</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={getPrecioReservaInput(r.stock_id, r.precio)}
                      onChange={(e) =>
                        setPreciosReservadas((prev) => ({ ...prev, [r.stock_id]: e.target.value }))
                      }
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v === "" || Number.isNaN(parseFloat(v.replace(",", ".")))) return;
                        const n = parseFloat(v.replace(",", "."));
                        if (n !== r.precio) handleActualizarPrecioReserva(r.stock_id, v);
                      }}
                      className="w-24 px-2 py-1 border border-gray-300 rounded text-sm"
                    />
                    {actualizandoPrecioId === r.stock_id && (
                      <span className="text-xs text-gray-500">Guardando...</span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleQuitarReserva(r.stock_id)}
                    disabled={quitandoId === r.stock_id}
                    className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {quitandoId === r.stock_id ? "..." : "Quitar de reserva"}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Buscador y tabla de cartas disponibles */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Cartas disponibles para reservar</h2>
        <div className="mb-4">
          <input
            type="text"
            placeholder="Buscar por nombre o ID de carta..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {loadingStock ? (
          <p className="text-gray-500">Cargando stock...</p>
        ) : stockDisponibleFiltrado.length === 0 ? (
          <p className="text-gray-500">
            {busqueda.trim()
              ? "No hay cartas que coincidan con la búsqueda."
              : "No hay cartas disponibles para reservar."}
          </p>
        ) : (
          <div className="bg-white rounded-lg shadow border border-gray-200" style={{ minHeight: 400 }}>
            <DataGrid
              rows={stockDisponibleFiltrado}
              columns={columns}
              getRowId={(row) => row._id}
              pageSizeOptions={[10, 25, 50]}
              initialState={{ pagination: { paginationModel: { pageSize: 25, page: 0 } } }}
              disableRowSelectionOnClick
              autoHeight
            />
          </div>
        )}
      </section>
    </div>
  );
}
