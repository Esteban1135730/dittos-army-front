import type { CartLine } from "./types";

export function addCartLine(
  lines: CartLine[],
  line: CartLine,
): { lines: CartLine[]; status: "ok" | "duplicate" } {
  if (lines.some((l) => l.stock_id === line.stock_id)) {
    return { lines, status: "duplicate" };
  }
  return { lines: [...lines, line], status: "ok" };
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

export function cartTotalCop(lines: CartLine[]): number {
  return lines.reduce(
    (sum, l) => sum + (l.amount_cop > 0 ? l.amount_cop : 0),
    0,
  );
}

export function lineProfitCop(line: CartLine): number {
  return line.amount_cop - line.card_cost_cop;
}

export function cartTotalProfitCop(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + lineProfitCop(l), 0);
}

export function removeSoldFromCart(
  lines: CartLine[],
  soldStockIds: string[],
): CartLine[] {
  const sold = new Set(soldStockIds);
  return lines.filter((l) => !sold.has(l.stock_id));
}
