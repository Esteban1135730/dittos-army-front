import type { OwnerKey } from "../config/owners";
import type { CardtraderCartItemMeta } from "./cardtrader-cart-meta-cache";

export const CARDTRADER_CART_EXPORT_VERSION = 1 as const;

export type CardtraderCartExportItem = {
  product_id: number;
  quantity: number;
  name?: string;
  meta?: CardtraderCartItemMeta;
};

export type CardtraderCartExportPayload = {
  version: typeof CARDTRADER_CART_EXPORT_VERSION;
  sourceOwner: OwnerKey;
  exportedAt: string;
  items: CardtraderCartExportItem[];
};

type CartLike = {
  subcarts?: Array<{
    cart_items?: Array<{
      quantity?: number;
      product?: {
        id?: number;
        name_en?: string;
      };
    }>;
  }>;
};

export function extractCartItemsFromResponse(cart: CartLike | null | undefined): CardtraderCartExportItem[] {
  const out: CardtraderCartExportItem[] = [];
  if (!cart?.subcarts?.length) return out;

  for (const subcart of cart.subcarts) {
    for (const line of subcart.cart_items ?? []) {
      const productId = line.product?.id;
      if (typeof productId !== "number" || productId < 1) continue;
      const quantity = Math.max(1, Math.trunc(line.quantity ?? 1));
      out.push({
        product_id: productId,
        quantity,
        name: line.product?.name_en?.trim() || undefined,
      });
    }
  }

  return out;
}

export function buildCartExportPayload(args: {
  cart: CartLike | null | undefined;
  sourceOwner: OwnerKey;
  metaByProductId?: Record<number, CardtraderCartItemMeta>;
  exportedAt?: string;
}): CardtraderCartExportPayload {
  const items = extractCartItemsFromResponse(args.cart).map((item) => ({
    ...item,
    meta: args.metaByProductId?.[item.product_id],
  }));

  return {
    version: CARDTRADER_CART_EXPORT_VERSION,
    sourceOwner: args.sourceOwner,
    exportedAt: args.exportedAt ?? new Date().toISOString(),
    items,
  };
}

export function parseCartExportPayload(raw: unknown): CardtraderCartExportPayload {
  if (!raw || typeof raw !== "object") {
    throw new Error("JSON de carrito inválido.");
  }
  const data = raw as Partial<CardtraderCartExportPayload>;
  if (data.version !== CARDTRADER_CART_EXPORT_VERSION) {
    throw new Error("Versión de export de carrito no soportada.");
  }
  if (!Array.isArray(data.items) || data.items.length === 0) {
    throw new Error("El carrito exportado no tiene líneas.");
  }

  const items: CardtraderCartExportItem[] = [];
  for (const line of data.items) {
    const productId = Number((line as CardtraderCartExportItem)?.product_id);
    const quantity = Number((line as CardtraderCartExportItem)?.quantity);
    if (!Number.isInteger(productId) || productId < 1) {
      throw new Error("Línea de carrito con product_id inválido.");
    }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
      throw new Error(`Cantidad inválida para product_id ${productId}.`);
    }
    items.push({
      product_id: productId,
      quantity,
      name: typeof line?.name === "string" ? line.name : undefined,
      meta:
        line?.meta && typeof line.meta === "object"
          ? (line.meta as CardtraderCartItemMeta)
          : undefined,
    });
  }

  return {
    version: CARDTRADER_CART_EXPORT_VERSION,
    sourceOwner: data.sourceOwner === "esteban" ? "esteban" : "pablo",
    exportedAt: typeof data.exportedAt === "string" ? data.exportedAt : new Date().toISOString(),
    items,
  };
}

export function cartExportFilename(sourceOwner: OwnerKey, now = new Date()): string {
  const stamp = now.toISOString().slice(0, 19).replace(/[:T]/g, "-");
  return `cardtrader-cart-${sourceOwner}-${stamp}.json`;
}

export function downloadCartExport(payload: CardtraderCartExportPayload): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = cartExportFilename(payload.sourceOwner);
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function copyCartExportToClipboard(payload: CardtraderCartExportPayload): Promise<void> {
  const text = JSON.stringify(payload);
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  throw new Error("El portapapeles no está disponible en este navegador.");
}

export function parseCartExportJsonText(text: string): CardtraderCartExportPayload {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("Pega o carga el JSON exportado del carrito de Esteban.");
  }
  let raw: unknown;
  try {
    raw = JSON.parse(trimmed);
  } catch {
    throw new Error("El archivo no es un JSON válido.");
  }
  return parseCartExportPayload(raw);
}

export type CartImportFailedLine = {
  product_id: number;
  name?: string;
  error: string;
};

export type CartImportBestEffortResult = {
  imported: number;
  total: number;
  failed: CartImportFailedLine[];
};

export async function importCartExportBestEffort(args: {
  items: CardtraderCartExportItem[];
  addItem: (item: CardtraderCartExportItem) => Promise<void>;
}): Promise<CartImportBestEffortResult> {
  const failed: CartImportFailedLine[] = [];
  let imported = 0;

  for (const item of args.items) {
    try {
      await args.addItem(item);
      imported += 1;
    } catch (e: unknown) {
      failed.push({
        product_id: item.product_id,
        name: item.name,
        error: e instanceof Error ? e.message : "No se pudo añadir al carrito.",
      });
    }
  }

  return {
    imported,
    total: args.items.length,
    failed,
  };
}

export function formatCartImportSnack(
  result: CartImportBestEffortResult,
): { msg: string; severity: "success" | "warning" | "error" } {
  const { imported, total, failed } = result;
  if (imported === 0) {
    const firstError = failed[0]?.error;
    return {
      msg: firstError
        ? `No se pudo importar ninguna línea (${total}). ${firstError}`
        : `No se pudo importar ninguna línea (${total}).`,
      severity: "error",
    };
  }
  if (failed.length === 0) {
    return {
      msg: `Importadas ${imported} línea(s) del JSON de Esteban.`,
      severity: "success",
    };
  }
  return {
    msg: `Importadas ${imported}/${total} línea(s). ${failed.length} no se pudieron añadir a tu carrito.`,
    severity: "warning",
  };
}
