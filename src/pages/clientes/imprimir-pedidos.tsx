import { useQuery, useQueries } from "@tanstack/react-query";
import axios from "axios";
import { useMemo, useRef, useState, useEffect } from "react";
import { formatCOP } from "../../utils/convert";
import type { StockListItem } from "../../types/stock";
import { paginatePedidoLineItems } from "./pedido-print-sheets";
import { mergePedidoSelection } from "./pedido-print-selection";
import { API_CLIENT, API_RESERVA, API_STOCK, type ClientItem, type ReservaItem } from "./cliente-types";
import { API_PEDIDO, type PedidoItem } from "./pedido-types";
import { abrirWhatsAppConTexto, buildWhatsAppPedidoText } from "./mensaje-reserva-pedido";
import { descripcionEntrega, formatFechaTentativa } from "./pedido-entrega-label";
import { reservaLineQuantity } from "./clientes-resumen-pedidos";

type StockItem = Pick<StockListItem, "_id" | "card_name">;

type PedidoCard = {
  key: string;
  client: ClientItem;
  entregaLabel: string;
  fechaTentativa: string;
  items: { nombre: string; precio: number }[];
  total: number;
};

const CARD_WIDTH_MM = 63;
const CARD_HEIGHT_MM = 88;

export default function ImprimirPedidosPage() {
  const printRef = useRef<HTMLDivElement>(null);
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const seenPedidoIdsRef = useRef<Set<string> | null>(null);

  useEffect(() => {
    const clear = () => {
      document.body.classList.remove("print-pedidos-mode");
    };
    window.addEventListener("afterprint", clear);
    return () => window.removeEventListener("afterprint", clear);
  }, []);

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

  const reservaGroups = useMemo(() => {
    const map = new Map<string, { clientId: string; pedidoId?: string; items: ReservaItem[] }>();
    reservas.forEach((r) => {
      const pedidoId = r.pedido_id?.trim();
      const key = pedidoId || `legacy-${r.client_id}`;
      const existing = map.get(key);
      if (existing) {
        existing.items.push(r);
      } else {
        map.set(key, { clientId: r.client_id, pedidoId, items: [r] });
      }
    });
    return [...map.entries()];
  }, [reservas]);

  const pedidoIds = useMemo(
    () =>
      reservaGroups
        .map(([, g]) => g.pedidoId)
        .filter((id): id is string => Boolean(id)),
    [reservaGroups],
  );

  const pedidoQueries = useQueries({
    queries: pedidoIds.map((id) => ({
      queryKey: ["pedido", id],
      queryFn: async () => {
        const res = await axios.get<PedidoItem>(`${API_PEDIDO}/${id}`);
        return res.data;
      },
    })),
  });

  const pedidoById = useMemo(() => {
    const map: Record<string, PedidoItem> = {};
    pedidoQueries.forEach((q, i) => {
      if (q.data) map[pedidoIds[i]] = q.data;
    });
    return map;
  }, [pedidoQueries, pedidoIds]);

  const pedidos: PedidoCard[] = useMemo(() => {
    return reservaGroups
      .map(([key, group]) => {
        const client = clientesMap[group.clientId];
        if (!client) return null;
        const pedido = group.pedidoId ? pedidoById[group.pedidoId] : undefined;
        const rows = group.items.map((r) => {
          const units = reservaLineQuantity(r.quantity);
          return {
            nombre: stockMap[r.stock_id] ?? `Stock ${r.stock_id.slice(-4)}`,
            precio: r.precio * units,
          };
        });
        const total = rows.reduce((sum, i) => sum + i.precio, 0);
        return {
          key,
          client,
          entregaLabel: pedido
            ? descripcionEntrega(pedido)
            : "Sin datos de entrega (pedido no migrado)",
          fechaTentativa: pedido
            ? formatFechaTentativa(pedido.fecha_tentativa_entrega)
            : "—",
          items: rows,
          total,
        };
      })
      .filter((p): p is PedidoCard => p !== null);
  }, [reservaGroups, clientesMap, stockMap, pedidoById]);

  // Primera carga: marcar todos. Luego solo auto-marcar clientes nuevos con reservas.
  useEffect(() => {
    const ids = pedidos.map((p) => p.key);
    if (ids.length === 0) return;
    const previouslySeen = seenPedidoIdsRef.current;
    setSeleccionados((prev) => {
      const { selected } = mergePedidoSelection(prev, ids, previouslySeen);
      if (selected.size === prev.size && [...selected].every((id) => prev.has(id))) {
        return prev;
      }
      return selected;
    });
    seenPedidoIdsRef.current = new Set(ids);
  }, [pedidos]);

  const toggleCliente = (key: string) => {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const seleccionarTodos = () => setSeleccionados(new Set(pedidos.map((p) => p.key)));
  const deseleccionarTodos = () => setSeleccionados(new Set());

  const pedidosAImprimir = useMemo(
    () => pedidos.filter((p) => seleccionados.has(p.key)),
    [pedidos, seleccionados]
  );

  const tarjetasPedidoAImprimir = useMemo(
    () =>
      pedidosAImprimir.flatMap((pedido) =>
        paginatePedidoLineItems(pedido.items).map((sheet) => ({
          key: `${pedido.key}-${sheet.sheetIndex}`,
          pedido,
          sheet,
        })),
      ),
    [pedidosAImprimir],
  );

  const handleImprimir = () => {
    document.body.classList.add("print-pedidos-mode");
    window.print();
  };

  const mensajePedidoWhatsApp = async (pedido: PedidoCard): Promise<string> =>
    buildWhatsAppPedidoText({
      clientName: pedido.client.nombre,
      descripcionEntrega: pedido.entregaLabel,
      lines: pedido.items.map((i) => ({
        card_id: "",
        card_name: i.nombre,
        precio: i.precio,
      })),
    });

  const enviarPedidoPorWhatsApp = (pedido: PedidoCard) => {
    void mensajePedidoWhatsApp(pedido).then((texto) =>
      abrirWhatsAppConTexto(pedido.client.celular, texto),
    );
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
                key={p.key}
                className="flex items-center gap-3 bg-white border border-gray-200 rounded px-4 py-2"
              >
                <label className="flex items-center gap-2 cursor-pointer flex-1">
                  <input
                    type="checkbox"
                    checked={seleccionados.has(p.key)}
                    onChange={() => toggleCliente(p.key)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="font-medium">{p.client.nombre}</span>
                </label>
                <span className="text-gray-500 text-sm">
                  {p.items.length} carta(s) — {formatCOP(p.total)}
                </span>
                <button
                  type="button"
                  onClick={() => enviarPedidoPorWhatsApp(p)}
                  className="no-print flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded text-sm"
                  title={p.client.celular ? "Abrir WhatsApp con el mensaje del pedido" : "Abrir WhatsApp con el mensaje (sin número ni @nick; elige el chat manualmente)"}
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                  Enviar por WhatsApp
                </button>
              </li>
            ))}
          </ul>
          <div className="no-print flex flex-wrap gap-2 mb-6">
            <button
              type="button"
              onClick={handleImprimir}
              disabled={tarjetasPedidoAImprimir.length === 0}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded"
            >
              {tarjetasPedidoAImprimir.length === 0
                ? "Selecciona al menos un pedido"
                : `Imprimir ${tarjetasPedidoAImprimir.length} tarjeta${tarjetasPedidoAImprimir.length !== 1 ? "s" : ""}`}
            </button>
          </div>
        </>
      )}

      {/* Zona de impresión: solo visible al imprimir */}
      <div
        ref={printRef}
        className="print-only-pedidos"
        style={{ padding: 0 }}
      >
        {tarjetasPedidoAImprimir.map(({ key, pedido, sheet }) => (
          <div
            key={key}
            className="pedido-card"
            style={{
              width: `${CARD_WIDTH_MM}mm`,
              height: `${CARD_HEIGHT_MM}mm`,
              minHeight: `${CARD_HEIGHT_MM}mm`,
              maxHeight: `${CARD_HEIGHT_MM}mm`,
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
              overflow: "hidden",
            }}
          >
            <div className="font-bold text-[10px] mb-1" style={{ borderBottom: "1px solid #333", paddingBottom: "1mm" }}>
              {pedido.client.nombre}
            </div>
            {pedido.client.celular ? (
              <div className="mb-1">Cel: {pedido.client.celular}</div>
            ) : null}
            <div className="mb-1">Entrega: {pedido.entregaLabel}</div>
            <div className="mb-2">Fecha tentativa: {pedido.fechaTentativa}</div>
            {sheet.sheetCount > 1 ? (
              <div className="mb-1 font-semibold" style={{ fontSize: "7px" }}>
                Tarjeta {sheet.sheetIndex} de {sheet.sheetCount}
              </div>
            ) : null}
            <table style={{ width: "100%", fontSize: "7px", borderCollapse: "collapse", display: "table" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #999" }}>
                  <th style={{ textAlign: "left", padding: "0.5mm 1mm 0.5mm 0" }}>Carta</th>
                  <th style={{ textAlign: "right", padding: "0.5mm 0 0.5mm 1mm" }}>Precio</th>
                </tr>
              </thead>
              <tbody>
                {sheet.items.map((row, i) => (
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
            {sheet.showTotal ? (
              <div
                className="font-bold mt-1"
                style={{ borderTop: "1px solid #333", paddingTop: "1mm", marginTop: "1mm", fontSize: "9px" }}
              >
                Total: {formatCOP(pedido.total)}
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <style>{`
        @media print {
          body * { visibility: hidden; }
          body.print-pedidos-mode .print-only-pedidos,
          body.print-pedidos-mode .print-only-pedidos * { visibility: visible; }
          body.print-pedidos-mode .print-only-pedidos {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 0;
            margin: 0;
            display: block !important;
            background: white;
          }
          body:not(.print-pedidos-mode) .print-only-pedidos {
            display: none !important;
          }
          .no-print { display: none !important; }
          .pedido-card {
            break-inside: avoid;
            page-break-inside: avoid;
          }
          @page { size: A4; margin: 10mm; }
        }
        @media screen {
          .print-only-pedidos { display: none !important; }
        }
      `}</style>
    </div>
  );
}
