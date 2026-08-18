import type { VentaClienteRow } from "./cliente-types";
import type { PedidoItem, PedidoLine } from "./pedido-types";
import { pedidoId } from "./pedido-types";

export type PedidoHistoricoSource = "pedido" | "ventas";

export type PedidoHistoricoView = PedidoItem & {
  historicoSource: PedidoHistoricoSource;
  /** Ventas usadas para reconstruir líneas (solo source ventas o enriquecido). */
  ventasIds?: string[];
};

function ventaToLine(v: VentaClienteRow): PedidoLine {
  return {
    stock_id: v.stock_id,
    card_id: v.card_id,
    card_name: v.card_name,
    precio: v.amount_cop,
    currency: "COP",
    image_url: v.image_url,
  };
}

export function saleLinksPedido(v: VentaClienteRow, pid: string): boolean {
  if (!pid) return false;
  const notes = v.notes ?? "";
  return notes.includes(pid) || notes.includes(`pedido ${pid}`);
}

export function ventasLinkedToAnyPedido(
  v: VentaClienteRow,
  pedidos: PedidoItem[],
): boolean {
  return pedidos.some((p) => saleLinksPedido(v, pedidoId(p)));
}

function isoDay(iso: string): string {
  return iso.slice(0, 10);
}

/** Agrupa ventas sin pedido enlazado por día calendario. */
export function groupVentasAsPedidosHistoricos(
  ventas: VentaClienteRow[],
  clientId: string,
): PedidoHistoricoView[] {
  const byDay = new Map<string, VentaClienteRow[]>();
  for (const v of ventas) {
    const day = isoDay(v.created_at);
    const list = byDay.get(day) ?? [];
    list.push(v);
    byDay.set(day, list);
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([day, lines]) => {
      const sorted = [...lines].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
      const syntheticId = `ventas-${clientId}-${day}`;
      return {
        id: syntheticId,
        _id: syntheticId,
        client_id: clientId,
        status: "entregado" as const,
        entrega_en_tienda: false,
        ciudad: undefined,
        direccion_o_punto: undefined,
        notas_entrega: "Reconstruido desde ventas registradas (sin pedido formal)",
        fecha_tentativa_entrega: day,
        paid_at: sorted[0]?.created_at ?? null,
        delivered_at: sorted[0]?.created_at ?? null,
        lines: sorted.map(ventaToLine),
        created_at: sorted[sorted.length - 1]?.created_at ?? day,
        updated_at: sorted[0]?.created_at ?? day,
        historicoSource: "ventas" as const,
        ventasIds: sorted.map((s) => s._id),
      };
    });
}

/**
 * Une pedidos del API con ventas históricas:
 * - Enriquece pedidos sin líneas desde ventas enlazadas por nota.
 * - Añade grupos sintéticos por día para ventas huérfanas.
 */
export function buildHistorialClienteView(
  pedidos: PedidoItem[],
  ventas: VentaClienteRow[],
  clientId: string,
): PedidoHistoricoView[] {
  const usedVentaIds = new Set<string>();

  const fromPedidos: PedidoHistoricoView[] = pedidos.map((p) => {
    const pid = pedidoId(p);
    if (p.lines.length > 0) {
      return { ...p, historicoSource: "pedido" as const };
    }
    const linked = ventas.filter((v) => saleLinksPedido(v, pid));
    linked.forEach((v) => usedVentaIds.add(v._id));
    if (linked.length === 0) {
      return { ...p, historicoSource: "pedido" as const };
    }
    return {
      ...p,
      lines: linked.map(ventaToLine),
      historicoSource: "pedido" as const,
      ventasIds: linked.map((v) => v._id),
    };
  });

  const orphanVentas = ventas.filter(
    (v) => !usedVentaIds.has(v._id) && !ventasLinkedToAnyPedido(v, pedidos),
  );
  const fromVentas = groupVentasAsPedidosHistoricos(orphanVentas, clientId);

  const merged = [...fromPedidos, ...fromVentas];
  merged.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  return merged;
}

export function historialTotals(items: PedidoHistoricoView[]): {
  pedidos: number;
  cartas: number;
  totalCop: number;
} {
  let cartas = 0;
  let totalCop = 0;
  for (const p of items) {
    cartas += p.lines.length;
    totalCop += p.lines.reduce((s, l) => s + l.precio, 0);
  }
  return { pedidos: items.length, cartas, totalCop };
}
