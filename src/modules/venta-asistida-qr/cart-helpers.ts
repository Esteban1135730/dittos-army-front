import type { CartLine } from "./types";

function lineQty(line: CartLine): number {
  return Math.max(1, line.qty ?? 1);
}

export function addCartLine(
  lines: CartLine[],
  line: CartLine,
): { lines: CartLine[]; status: "ok" | "duplicate" | "incremented" } {
  const existingIdx = lines.findIndex((l) => l.stock_id === line.stock_id);
  if (existingIdx >= 0) {
    const existing = lines[existingIdx];
    if (existing.product_kind === "quantity" || line.product_kind === "quantity") {
      const next = lines.map((l, i) =>
        i === existingIdx
          ? { ...l, qty: lineQty(l) + 1, product_kind: "quantity" as const }
          : l,
      );
      return { lines: next, status: "incremented" };
    }
    return { lines, status: "duplicate" };
  }
  const withQty: CartLine = {
    ...line,
    qty: line.qty ?? 1,
  };
  return { lines: [...lines, withQty], status: "ok" };
}

export function removeCartLine(lines: CartLine[], stockId: string): CartLine[] {
  return lines.filter((l) => l.stock_id !== stockId);
}

export function updateCartLinePrice(
  lines: CartLine[],
  stockId: string,
  amountCop: number,
): CartLine[] {
  return lines.map((l) =>
    l.stock_id === stockId ? { ...l, amount_cop: amountCop } : l,
  );
}

export function updateCartLineQty(
  lines: CartLine[],
  stockId: string,
  qty: number,
): CartLine[] {
  const nextQty = Math.max(1, Math.floor(qty));
  return lines.map((l) =>
    l.stock_id === stockId ? { ...l, qty: nextQty } : l,
  );
}

export function cartTotalCop(lines: CartLine[]): number {
  return lines.reduce(
    (sum, l) =>
      sum + (l.amount_cop > 0 ? l.amount_cop * lineQty(l) : 0),
    0,
  );
}

export function lineProfitCop(line: CartLine): number {
  return (line.amount_cop - line.card_cost_cop) * lineQty(line);
}

export function cartTotalProfitCop(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + lineProfitCop(l), 0);
}

export function cartUnitCount(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + lineQty(l), 0);
}

/** Expande líneas quantity a N ítems unitarios para POST /sales/sell-batch. */
export function expandCartLinesToSellBatchItems(
  lines: CartLine[],
): Array<{ stock_id: string; amount_cop: number; notes: string }> {
  const items: Array<{
    stock_id: string;
    amount_cop: number;
    notes: string;
  }> = [];
  for (const l of lines) {
    const n = lineQty(l);
    for (let i = 0; i < n; i++) {
      items.push({
        stock_id: l.stock_id,
        amount_cop: l.amount_cop,
        notes: "Venta asistida QR",
      });
    }
  }
  return items;
}

export function removeSoldFromCart(
  lines: CartLine[],
  soldStockIds: string[],
): CartLine[] {
  const soldCounts = new Map<string, number>();
  for (const id of soldStockIds) {
    soldCounts.set(id, (soldCounts.get(id) ?? 0) + 1);
  }

  const next: CartLine[] = [];
  for (const l of lines) {
    const sold = soldCounts.get(l.stock_id) ?? 0;
    if (sold <= 0) {
      next.push(l);
      continue;
    }
    if (l.product_kind === "quantity") {
      const remaining = lineQty(l) - sold;
      if (remaining > 0) {
        next.push({ ...l, qty: remaining });
      }
      continue;
    }
    // unit: remove entirely if sold
  }
  return next;
}
