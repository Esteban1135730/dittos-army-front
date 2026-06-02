export type CartPriceLineInput = {
  priceCents: number;
  quantity: number;
};

export type ResolvedCartItemPricing = {
  unitCents: number;
  lineTotalCents: number;
  /** true si price_cents del API era el total de la línea (paquete). */
  priceWasLineTotal: boolean;
};

function subcartUsesUnitPrices(
  items: { priceCents: number; quantity: number }[],
  subcartSubtotalCents: number,
): boolean {
  const sumAsUnitPrices = items.reduce((s, i) => s + i.priceCents * i.quantity, 0);
  const sumAsLineTotals = items.reduce((s, i) => s + i.priceCents, 0);
  const diffUnit = Math.abs(sumAsUnitPrices - subcartSubtotalCents);
  const diffLine = Math.abs(sumAsLineTotals - subcartSubtotalCents);
  return diffUnit < diffLine;
}

/**
 * Resuelve precio unitario y total de línea del carrito CardTrader.
 *
 * Con cantidad > 1, en la práctica `price_cents` suele ser el **total del paquete**
 * (p. ej. 37,20 USD por 6 cartas). El unitario es total ÷ cantidad.
 * Solo si el subtotal del subcart demuestra precio unitario en `price_cents`, se usa raw como unitario.
 */
export function resolveCartItemPricing(args: {
  priceCents: number;
  quantity: number;
  subcartItems: CartPriceLineInput[];
  subcartSubtotalCents?: number;
  cartSubtotalCents?: number;
  /** Ignorado: el listing no debe forzar unitario cuando el carrito trae total de paquete. */
  marketplaceUnitPriceCents?: number;
}): ResolvedCartItemPricing {
  const q = Math.max(1, args.quantity);
  const raw = Math.max(0, Math.round(args.priceCents));

  if (q === 1) {
    return { unitCents: raw, lineTotalCents: raw, priceWasLineTotal: false };
  }

  const items = args.subcartItems.map((i) => ({
    priceCents: Math.max(0, Math.round(i.priceCents)),
    quantity: Math.max(1, i.quantity),
  }));

  const subtotal =
    typeof args.subcartSubtotalCents === "number" && args.subcartSubtotalCents > 0
      ? args.subcartSubtotalCents
      : typeof args.cartSubtotalCents === "number" &&
          args.cartSubtotalCents > 0 &&
          items.length === 1
        ? args.cartSubtotalCents
        : undefined;

  // Por defecto: price_cents = total del paquete (caso habitual ×N).
  let priceWasLineTotal = true;

  if (typeof subtotal === "number" && subtotal > 0) {
    priceWasLineTotal = !subcartUsesUnitPrices(items, subtotal);
  }

  const unitCents = priceWasLineTotal ? Math.round(raw / q) : raw;
  const lineTotalCents = priceWasLineTotal ? raw : raw * q;

  return { unitCents, lineTotalCents, priceWasLineTotal };
}

/** @deprecated Usa resolveCartItemPricing */
export function resolveCartItemUnitPriceCents(
  args: Parameters<typeof resolveCartItemPricing>[0],
): number {
  return resolveCartItemPricing(args).unitCents;
}
