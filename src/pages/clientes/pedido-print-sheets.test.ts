import { describe, expect, it } from "vitest";
import {
  MAX_LINEAS_TARJETA_PEDIDO_INTERMEDIA,
  MAX_LINEAS_TARJETA_PEDIDO_UNICA,
  paginatePedidoLineItems,
  type PedidoLineItem,
} from "./pedido-print-sheets";

function lineas(n: number): PedidoLineItem[] {
  return Array.from({ length: n }, (_, index) => ({
    nombre: `Carta ${index + 1}`,
    precio: 1_000,
  }));
}

describe("paginatePedidoLineItems", () => {
  it("devuelve una hoja con total si cabe en una tarjeta", () => {
    const items = lineas(MAX_LINEAS_TARJETA_PEDIDO_UNICA);
    const sheets = paginatePedidoLineItems(items);

    expect(sheets).toHaveLength(1);
    expect(sheets[0]).toMatchObject({
      sheetIndex: 1,
      sheetCount: 1,
      showTotal: true,
    });
    expect(sheets[0].items).toHaveLength(MAX_LINEAS_TARJETA_PEDIDO_UNICA);
  });

  it("divide pedidos largos en varias hojas y deja el total en la última", () => {
    const items = lineas(MAX_LINEAS_TARJETA_PEDIDO_UNICA + 1);
    const sheets = paginatePedidoLineItems(items);

    expect(sheets).toHaveLength(2);
    expect(sheets[0]).toMatchObject({
      sheetIndex: 1,
      sheetCount: 2,
      showTotal: false,
    });
    expect(sheets[0].items).toHaveLength(MAX_LINEAS_TARJETA_PEDIDO_INTERMEDIA);
    expect(sheets[1]).toMatchObject({
      sheetIndex: 2,
      sheetCount: 2,
      showTotal: true,
    });
    expect(sheets[1].items).toHaveLength(1);
  });

  it("reparte tres hojas cuando el pedido supera dos tarjetas", () => {
    const items = lineas(
      MAX_LINEAS_TARJETA_PEDIDO_INTERMEDIA + MAX_LINEAS_TARJETA_PEDIDO_INTERMEDIA + 1,
    );
    const sheets = paginatePedidoLineItems(items);

    expect(sheets).toHaveLength(3);
    expect(sheets.map((sheet) => sheet.items.length)).toEqual([
      MAX_LINEAS_TARJETA_PEDIDO_INTERMEDIA,
      MAX_LINEAS_TARJETA_PEDIDO_INTERMEDIA,
      1,
    ]);
    expect(sheets[2].showTotal).toBe(true);
    expect(sheets[0].showTotal).toBe(false);
    expect(sheets[1].showTotal).toBe(false);
  });

  it("devuelve lista vacía sin líneas", () => {
    expect(paginatePedidoLineItems([])).toEqual([]);
  });
});
