export type PedidoLineItem = {
  nombre: string;
  precio: number;
};

export type PedidoPrintSheet = {
  items: PedidoLineItem[];
  sheetIndex: number;
  sheetCount: number;
  showTotal: boolean;
};

/** Líneas en una sola tarjeta (cabecera + total, sin «Tarjeta X de Y»). */
export const MAX_LINEAS_TARJETA_PEDIDO_UNICA = 11;

/** Líneas en tarjetas intermedias (con «Tarjeta X de Y», sin total). */
export const MAX_LINEAS_TARJETA_PEDIDO_INTERMEDIA = 11;

/** Líneas en la última tarjeta (con «Tarjeta X de Y» y total). */
export const MAX_LINEAS_TARJETA_PEDIDO_FINAL = 10;

export function paginatePedidoLineItems(items: PedidoLineItem[]): PedidoPrintSheet[] {
  if (items.length === 0) {
    return [];
  }

  if (items.length <= MAX_LINEAS_TARJETA_PEDIDO_UNICA) {
    return [
      {
        items,
        sheetIndex: 1,
        sheetCount: 1,
        showTotal: true,
      },
    ];
  }

  const chunks: PedidoLineItem[][] = [];
  let remaining = items;

  while (remaining.length > MAX_LINEAS_TARJETA_PEDIDO_FINAL) {
    chunks.push(remaining.slice(0, MAX_LINEAS_TARJETA_PEDIDO_INTERMEDIA));
    remaining = remaining.slice(MAX_LINEAS_TARJETA_PEDIDO_INTERMEDIA);
  }

  chunks.push(remaining);

  const sheetCount = chunks.length;
  return chunks.map((chunk, index) => ({
    items: chunk,
    sheetIndex: index + 1,
    sheetCount,
    showTotal: index === sheetCount - 1,
  }));
}
