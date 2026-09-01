import type { CalendarCell, DayCount, PedidoCalendarioItem } from "./types";

/** YYYY-MM-DD del calendario local. No usar `toISOString().slice(0, 10)`. */
export function formatYmdLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function todayYmdLocal(now: Date = new Date()): string {
  return formatYmdLocal(now);
}

function weekdayMonday0(date: Date): number {
  return (date.getDay() + 6) % 7;
}

/**
 * Grilla mensual (lunes a domingo) incluyendo días de meses adyacentes.
 * `from`/`to` son el primer y último día de esa grilla, YYYY-MM-DD local.
 */
export function monthGridRange(
  year: number,
  monthIndex: number,
): { from: string; to: string; cells: CalendarCell[] } {
  const first = new Date(year, monthIndex, 1);
  const last = new Date(year, monthIndex + 1, 0);
  const gridStart = new Date(year, monthIndex, 1 - weekdayMonday0(first));
  const gridEnd = new Date(year, monthIndex + 1, 0 + (6 - weekdayMonday0(last)));

  const cells: CalendarCell[] = [];
  const cursor = new Date(gridStart);
  while (cursor.getTime() <= gridEnd.getTime()) {
    cells.push({
      ymd: formatYmdLocal(cursor),
      day: cursor.getDate(),
      inMonth: cursor.getMonth() === monthIndex,
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  return {
    from: formatYmdLocal(gridStart),
    to: formatYmdLocal(gridEnd),
    cells,
  };
}

export function groupCalendarioByFecha(
  items: PedidoCalendarioItem[],
): Record<string, DayCount> {
  const out: Record<string, DayCount> = {};
  for (const item of items) {
    const key = item.fecha_tentativa_entrega?.slice(0, 10) ?? "";
    if (!key) continue;
    const bucket = out[key] ?? { count: 0, overdue_count: 0, items: [] };
    bucket.count += 1;
    if (item.overdue) bucket.overdue_count += 1;
    bucket.items.push(item);
    out[key] = bucket;
  }
  return out;
}

export function entregaLugar(item: PedidoCalendarioItem): string {
  if (item.entrega_en_tienda) {
    return [item.store_name, item.store_address].filter(Boolean).join(" — ");
  }
  return [item.ciudad, item.direccion_o_punto, item.notas_entrega]
    .filter(Boolean)
    .join(" · ");
}
