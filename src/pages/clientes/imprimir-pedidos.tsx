import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { useMemo, useRef, useState, useEffect } from "react";
import { formatCOP } from "../../utils/convert";

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

type StockItem = {
  _id: string;
  card_name: string;
};

type PedidoCard = {
  client: ClientItem;
  items: { nombre: string; precio: number }[];
  total: number;
};

const API_CLIENT = "http://localhost:3000/client";
const API_RESERVA = "http://localhost:3000/reserva";
const API_STOCK = "http://localhost:3000/stock";

const CARD_WIDTH_MM = 63;
const CARD_HEIGHT_MM = 88;

export default function ImprimirPedidosPage() {
  const printRef = useRef<HTMLDivElement>(null);
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());

  const { data: clientes = [] } = useQuery<ClientItem[]>({
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

  const { data: stockRaw = [] } = useQuery<StockItem[]>({
    queryKey: ["stock"],
    queryFn: async () => {
      const res = await axios.get(API_STOCK);
      return Array.isArray(res.data) ? res.data : [];
    },
  });

  const stockMap = useMemo(() => {
    const map: Record<string, string> = {};
    stockRaw.forEach((s) => {
      map[s._id] = s.card_name ?? "Carta";
    });
    return map;
  }, [stockRaw]);

  const clientesMap = useMemo(() => {
    const map: Record<string, ClientItem> = {};
    clientes.forEach((c) => {
      map[c._id] = c;
    });
    return map;
  }, [clientes]);

  const pedidos: PedidoCard[] = useMemo(() => {
    const byClient: Record<string, ReservaItem[]> = {};
    reservas.forEach((r) => {
      if (!byClient[r.client_id]) byClient[r.client_id] = [];
      byClient[r.client_id].push(r);
    });
    return Object.entries(byClient)
      .map(([clientId, items]) => {
        const client = clientesMap[clientId];
        if (!client) return null;
        const rows = items.map((r) => ({
          nombre: stockMap[r.stock_id] ?? `Stock ${r.stock_id.slice(-4)}`,
          precio: r.precio,
        }));
        const total = rows.reduce((sum, i) => sum + i.precio, 0);
        return { client, items: rows, total };
      })
      .filter((p): p is PedidoCard => p !== null);
  }, [reservas, clientesMap, stockMap]);

  // Por defecto marcar todos los pedidos al cargar (y al añadir nuevos clientes con reservas)
  useEffect(() => {
    if (pedidos.length > 0) {
      setSeleccionados((prev) => {
        const next = new Set(prev);
        let changed = false;
        pedidos.forEach((p) => {
          if (!next.has(p.client._id)) {
            next.add(p.client._id);
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }
  }, [pedidos]);

  const toggleCliente = (clientId: string) => {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(clientId)) next.delete(clientId);
      else next.add(clientId);
      return next;
    });
  };

  const seleccionarTodos = () => setSeleccionados(new Set(pedidos.map((p) => p.client._id)));
  const deseleccionarTodos = () => setSeleccionados(new Set());

  const pedidosAImprimir = useMemo(
    () => pedidos.filter((p) => seleccionados.has(p.client._id)),
    [pedidos, seleccionados]
  );

  const handleImprimir = () => {
    window.print();
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-4">Imprimir tarjetas de pedido</h1>
      <p className="text-gray-600 mb-6">
        Tarjetas en tamaño carta TCG (63 × 88 mm) con nombre, celular, tienda, productos y total.
      </p>

      {pedidos.length === 0 ? (
        <p className="text-gray-500">No hay clientes con reservas. Agrega cartas a un pedido desde Clientes.</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2 mb-4 no-print">
            <button
              type="button"
              onClick={seleccionarTodos}
              className="text-sm text-blue-600 hover:underline"
            >
              Seleccionar todos
            </button>
            <span className="text-gray-400">|</span>
            <button
              type="button"
              onClick={deseleccionarTodos}
              className="text-sm text-blue-600 hover:underline"
            >
              Deseleccionar todos
            </button>
          </div>
          <ul className="space-y-2 mb-6">
            {pedidos.map((p) => (
              <li
                key={p.client._id}
                className="flex items-center gap-3 bg-white border border-gray-200 rounded px-4 py-2"
              >
                <label className="flex items-center gap-2 cursor-pointer flex-1">
                  <input
                    type="checkbox"
                    checked={seleccionados.has(p.client._id)}
                    onChange={() => toggleCliente(p.client._id)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="font-medium">{p.client.nombre}</span>
                </label>
                <span className="text-gray-500 text-sm">
                  {p.items.length} carta(s) — {formatCOP(p.total)}
                </span>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={handleImprimir}
            disabled={pedidosAImprimir.length === 0}
            className="no-print bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded"
          >
            {pedidosAImprimir.length === 0
              ? "Selecciona al menos un pedido"
              : `Imprimir ${pedidosAImprimir.length} tarjeta${pedidosAImprimir.length !== 1 ? "s" : ""}`}
          </button>
        </>
      )}

      {/* Zona de impresión: solo visible al imprimir */}
      <div
        ref={printRef}
        className="print-only hidden print:block"
        style={{ padding: 0 }}
      >
        {pedidosAImprimir.map((pedido) => (
          <div
            key={pedido.client._id}
            className="pedido-card"
            style={{
              width: `${CARD_WIDTH_MM}mm`,
              height: `${CARD_HEIGHT_MM}mm`,
              minHeight: `${CARD_HEIGHT_MM}mm`,
              boxSizing: "border-box",
              padding: "4mm",
              border: "1px solid #ccc",
              breakInside: "avoid",
              pageBreakInside: "avoid",
              fontSize: "8px",
              lineHeight: 1.2,
              display: "inline-block",
              verticalAlign: "top",
              margin: "2mm",
            }}
          >
            <div className="font-bold text-[10px] mb-1" style={{ borderBottom: "1px solid #333", paddingBottom: "1mm" }}>
              {pedido.client.nombre}
            </div>
            {pedido.client.celular ? (
              <div className="mb-1">Cel: {pedido.client.celular}</div>
            ) : null}
            <div className="mb-2">Tienda: {pedido.client.tienda_entrega}</div>
            <table style={{ width: "100%", fontSize: "7px", borderCollapse: "collapse", display: "table" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #999" }}>
                  <th style={{ textAlign: "left", padding: "0.5mm 1mm 0.5mm 0" }}>Carta</th>
                  <th style={{ textAlign: "right", padding: "0.5mm 0 0.5mm 1mm" }}>Precio</th>
                </tr>
              </thead>
              <tbody>
                {pedido.items.map((row, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #ddd" }}>
                    <td style={{ padding: "0.5mm 1mm 0.5mm 0", wordBreak: "break-word", maxWidth: "35mm" }}>
                      {row.nombre.length > 22 ? `${row.nombre.slice(0, 21)}…` : row.nombre}
                    </td>
                    <td style={{ textAlign: "right", padding: "0.5mm 0 0.5mm 1mm", whiteSpace: "nowrap" }}>
                      {formatCOP(row.precio)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div
              className="font-bold mt-1"
              style={{ borderTop: "1px solid #333", paddingTop: "1mm", marginTop: "1mm", fontSize: "9px" }}
            >
              Total: {formatCOP(pedido.total)}
            </div>
          </div>
        ))}
      </div>

      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-only, .print-only * { visibility: visible; }
          .print-only {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 0;
            margin: 0;
            display: block !important;
            background: white;
          }
          .no-print { display: none !important; }
          .pedido-card {
            break-inside: avoid;
            page-break-inside: avoid;
          }
          /* 6 tarjetas por hoja A4 aprox: 2 columnas x 3 filas */
          @page { size: A4; margin: 10mm; }
        }
        @media screen {
          .print-only { display: none !important; }
        }
      `}</style>
    </div>
  );
}
