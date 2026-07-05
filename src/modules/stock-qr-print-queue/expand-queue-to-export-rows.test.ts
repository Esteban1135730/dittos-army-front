import { describe, expect, it } from "vitest";
import { expandQueueToExportRows } from "./expand-queue-to-export-rows";
import type { StockQrExportRow } from "../stock-barcode";

const row = (id: string): StockQrExportRow => ({
  stock_id: id,
  qr_value: `DA-STOCK:${id}`,
  card_name: "Pikachu",
  expansion: "Base",
  rareza: null,
  language: "EN",
  price_cop: 5000,
});

describe("expandQueueToExportRows", () => {
  it("repite filas según cantidad", () => {
    const map = new Map([["a", row("a")]]);
    const { rows, omittedCount } = expandQueueToExportRows(
      [{ stockId: "a", quantity: 3 }],
      map,
    );
    expect(rows).toHaveLength(3);
    expect(omittedCount).toBe(0);
  });

  it("omite líneas no elegibles", () => {
    const map = new Map([["a", row("a")]]);
    const { rows, omittedCount } = expandQueueToExportRows(
      [
        { stockId: "a", quantity: 2 },
        { stockId: "b", quantity: 1 },
      ],
      map,
    );
    expect(rows).toHaveLength(2);
    expect(omittedCount).toBe(1);
  });
});
