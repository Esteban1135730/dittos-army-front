import type { PedidoItem, PedidoLine, PedidoStatus } from "./pedido-types";

export function pedidoTotal(lines: PedidoLine[]): number {
  return lines.reduce((s, l) => s + l.precio, 0);
}

export function parseIsoDayLocal(isoDay: string | null | undefined): Date | null {
  if (!isoDay?.trim()) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDay.trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Días hasta la fecha tentativa (0 = hoy, negativo = vencida). */
export function diasHastaEntrega(isoDay: string | null | undefined): number | null {
  const target = parseIsoDayLocal(isoDay);
  if (!target) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const t = new Date(target);
  t.setHours(0, 0, 0, 0);
  return Math.round((t.getTime() - today.getTime()) / 86400000);
}

export type EntregaUrgencia = "none" | "ok" | "soon" | "today" | "overdue";

export function entregaUrgencia(
  isoDay: string | null | undefined,
  status: PedidoStatus,
): EntregaUrgencia {
  if (status === "entregado") return "none";
  const dias = diasHastaEntrega(isoDay);
  if (dias == null) return "none";
  if (dias < 0) return "overdue";
  if (dias === 0) return "today";
  if (dias <= 2) return "soon";
  return "ok";
}

export function entregaUrgenciaLabel(
  isoDay: string | null | undefined,
  status: PedidoStatus,
): string | null {
  const u = entregaUrgencia(isoDay, status);
  const dias = diasHastaEntrega(isoDay);
  if (u === "none" || dias == null) return null;
  if (u === "overdue") return dias === -1 ? "Venció ayer" : `Venció hace ${Math.abs(dias)} días`;
  if (u === "today") return "Entrega hoy";
  if (u === "soon") return dias === 1 ? "Mañana" : `En ${dias} días`;
  return `En ${dias} días`;
}

export function pedidoStatusStepIndex(status: PedidoStatus): number {
  if (status === "reservado") return 0;
  if (status === "pagado") return 1;
  return 2;
}

export const PEDIDO_STEPS = ["Reservado", "Pagado", "Entregado"] as const;

export type PedidoHistorialFilter = "activos" | "cerrados" | "todos";

export function filterPedidosHistorial(
  pedidos: PedidoItem[],
  filter: PedidoHistorialFilter,
  excludeId?: string,
): PedidoItem[] {
  let list = excludeId ? pedidos.filter((p) => (p.id || p._id) !== excludeId) : [...pedidos];
  if (filter === "activos") {
    list = list.filter((p) => p.status === "reservado" || p.status === "pagado");
  } else if (filter === "cerrados") {
    list = list.filter((p) => p.status === "entregado");
  }
  return list;
}
