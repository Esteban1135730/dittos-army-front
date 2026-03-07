import { useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { DataGrid, type GridColDef } from "@mui/x-data-grid";
import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";

export type ClientItem = {
  _id: string;
  nombre: string;
  tienda_entrega: string;
  celular?: string;
  metodo_contacto: "whatsapp" | "facebook";
};

type ReservaItem = { _id: string; client_id: string; stock_id: string; precio: number; currency: string };

const API_CLIENT = "http://localhost:3000/client";
const API_RESERVA = "http://localhost:3000/reserva";

export default function ClientesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [nombre, setNombre] = useState("");
  const [tiendaEntrega, setTiendaEntrega] = useState("");
  const [celular, setCelular] = useState("");
  const [metodoContacto, setMetodoContacto] = useState<"whatsapp" | "facebook">("whatsapp");
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");

  const { data: clientes = [], isLoading } = useQuery<ClientItem[]>({
    queryKey: ["clientes"],
    queryFn: async () => {
      const res = await axios.get(API_CLIENT);
      return Array.isArray(res.data) ? res.data : [];
    },
  });

  const { data: reservas = [] } = useQuery<ReservaItem[]>({
    queryKey: ["reservas"],
    queryFn: async () => {
      const res = await axios.get(API_RESERVA);
      return Array.isArray(res.data) ? res.data : [];
    },
  });

  const reservasPorCliente = useMemo(() => {
    const map: Record<string, number> = {};
    reservas.forEach((r) => {
      map[r.client_id] = (map[r.client_id] ?? 0) + 1;
    });
    return map;
  }, [reservas]);

  const handleCrearCliente = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim() || !tiendaEntrega.trim()) {
      setMensaje("Nombre y tienda de entrega son obligatorios.");
      return;
    }
    setMensaje("");
    setGuardando(true);
    try {
      await axios.post(API_CLIENT, {
        nombre: nombre.trim(),
        tienda_entrega: tiendaEntrega.trim(),
        celular: celular.trim() || undefined,
        metodo_contacto: metodoContacto,
      });
      setNombre("");
      setTiendaEntrega("");
      setCelular("");
      setMetodoContacto("whatsapp");
      await queryClient.invalidateQueries({ queryKey: ["clientes"] });
      setMensaje("Cliente agregado correctamente.");
    } catch {
      setMensaje("Error al guardar el cliente.");
    } finally {
      setGuardando(false);
    }
  };

  const handleAgregarCartasPedido = (cliente: ClientItem) => {
    navigate(`/clientes/${cliente._id}/reservar`);
  };

  const handleFinalizarVenta = (cliente: ClientItem) => {
    // Sin funcionalidad por ahora
    alert(`"Finalizar venta" para ${cliente.nombre} — en desarrollo.`);
  };

  const columns: GridColDef[] = [
    { field: "nombre", headerName: "Nombre", flex: 1, minWidth: 160 },
    { field: "tienda_entrega", headerName: "Tienda de entrega", flex: 1, minWidth: 160 },
    { field: "celular", headerName: "Celular", flex: 0.8, minWidth: 120 },
    {
      field: "metodo_contacto",
      headerName: "Método de contacto",
      width: 140,
      valueFormatter: (value) => (value === "whatsapp" ? "WhatsApp" : "Facebook"),
    },
    {
      field: "agregar_pedido",
      headerName: "Pedido",
      sortable: false,
      filterable: false,
      width: 180,
      renderCell: (params) => (
        <button
          type="button"
          onClick={() => handleAgregarCartasPedido(params.row)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm"
        >
          Agregar cartas al pedido
        </button>
      ),
    },
    {
      field: "finalizar_venta",
      headerName: "Venta",
      sortable: false,
      filterable: false,
      width: 140,
      renderCell: (params) => {
        const cliente = params.row as ClientItem;
        const tieneReservas = (reservasPorCliente[cliente._id] ?? 0) > 0;
        return (
          <button
            type="button"
            onClick={() => handleFinalizarVenta(cliente)}
            disabled={!tieneReservas}
            title={tieneReservas ? "Finalizar venta" : "El cliente no tiene cartas reservadas"}
            className={
              tieneReservas
                ? "bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm"
                : "bg-gray-300 text-gray-500 cursor-not-allowed px-3 py-1 rounded text-sm"
            }
          >
            Finalizar venta
          </button>
        );
      },
    },
  ];

  if (isLoading) {
    return <p className="text-center text-gray-500 p-6">Cargando clientes...</p>;
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Clientes</h1>

      {/* Formulario nuevo cliente */}
      <form
        onSubmit={handleCrearCliente}
        className="bg-white p-4 rounded-lg shadow border border-gray-200 mb-6"
      >
        <h2 className="text-lg font-semibold text-gray-700 mb-4">Nuevo cliente</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Nombre del cliente"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tienda de entrega *</label>
            <input
              type="text"
              value={tiendaEntrega}
              onChange={(e) => setTiendaEntrega(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Ej: Tienda Norte"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Celular (opcional)</label>
            <input
              type="text"
              value={celular}
              onChange={(e) => setCelular(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Número de celular"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Método de contacto</label>
            <select
              value={metodoContacto}
              onChange={(e) => setMetodoContacto(e.target.value as "whatsapp" | "facebook")}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="whatsapp">WhatsApp</option>
              <option value="facebook">Facebook</option>
            </select>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button
            type="submit"
            disabled={guardando}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {guardando ? "Guardando..." : "Agregar cliente"}
          </button>
          {mensaje && (
            <span className={`text-sm ${mensaje.includes("Error") ? "text-red-600" : "text-green-600"}`}>
              {mensaje}
            </span>
          )}
        </div>
      </form>

      {/* Tabla de clientes */}
      <div className="bg-white rounded-lg shadow border border-gray-200" style={{ minHeight: 400 }}>
        <DataGrid
          rows={clientes}
          columns={columns}
          getRowId={(row) => row._id}
          pageSizeOptions={[10, 25, 50]}
          initialState={{
            pagination: { paginationModel: { pageSize: 25, page: 0 } },
          }}
          disableRowSelectionOnClick
          autoHeight
        />
      </div>
    </div>
  );
}
