import { normalizeOperationalRareza } from "../../constants/item-rareza";

/** Agrupa por carta + rareza operativa + idioma (ignora el lote). */
export function incomingVariantGroupKey(
  cardId: string,
  rareza: string | null | undefined,
  language: string,
): string {
  const rz = normalizeOperationalRareza(rareza) ?? "";
  return `${cardId}\u0001${rz}\u0001${String(language).trim().toLowerCase()}`;
}

export type OldestSortable = {
  batch_purchase_date?: string | Date | null;
  item_created_at?: string | Date | null;
  created_at?: string | Date | null;
};

/** Lote más antiguo primero; desempate por fecha creación del ítem. */
export function compareIncomingLinesByOldest(a: OldestSortable, b: OldestSortable): number {
  const pa = new Date(a.batch_purchase_date ?? 0).getTime();
  const pb = new Date(b.batch_purchase_date ?? 0).getTime();
  if (pa !== pb) return pa - pb;
  const ca = new Date(a.item_created_at ?? a.created_at ?? 0).getTime();
  const cb = new Date(b.item_created_at ?? b.created_at ?? 0).getTime();
  return ca - cb;
}

/**
 * Costo unitario medio ponderado: Σ(unit_cost × cantidad) / Σ(cantidad).
 * `cantidad` es típicamente `remaining_quantity` por línea de lote.
 */
export function weightedAverageUnitCostCop(
  lines: Array<{ unit_cost_cop: number; remaining_quantity: number }>,
): number {
  let sumProduct = 0;
  let qty = 0;
  for (const L of lines) {
    const q = Math.max(0, Number(L.remaining_quantity) || 0);
    sumProduct += Number(L.unit_cost_cop) * q;
    qty += q;
  }
  if (qty <= 0) return 0;
  return sumProduct / qty;
}

/** Reparte `total` unidades en orden FIFO por capacidades por cubeta. */
export function distributeFifo(capacities: number[], total: number): number[] {
  const n = capacities.length;
  const out = new Array(n).fill(0);
  const capSum = capacities.reduce((s, c) => s + c, 0);
  let left = Math.min(total, capSum);
  for (let i = 0; i < n && left > 0; i++) {
    const take = Math.min(capacities[i], left);
    out[i] = take;
    left -= take;
  }
  return out;
}
