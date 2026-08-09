import { describe, expect, it } from "vitest";
import {
  parseStockBarcodePayload,
  parseStockQrPayloadMulti,
} from "./stock-barcode-payload";

const validId = "507f1f77bcf86cd799439011";

describe("parseStockBarcodePayload", () => {
  it("lee prefijo DA-STOCK", () => {
    expect(parseStockBarcodePayload(`DA-STOCK:${validId}`)).toBe(validId);
  });

  it("lee ObjectId solo", () => {
    expect(parseStockBarcodePayload(validId)).toBe(validId);
  });

  it("tolera layout teclado ES en pistola QR", () => {
    expect(parseStockBarcodePayload("DA'STOCKÑ691e97501c83b1923bfc6e63")).toBe(
      "691e97501c83b1923bfc6e63",
    );
  });

  it("tolera layout teclado ES/LATAM en macOS (pistola: / y >)", () => {
    expect(
      parseStockQrPayloadMulti(`ESTEBAN/STOCK>${validId}`),
    ).toEqual({
      stockId: validId,
      owner: "esteban",
      prefixUsed: "ESTEBAN-STOCK:",
    });
    expect(parseStockBarcodePayload(`DA/STOCK>${validId}`)).toBe(validId);
  });
});
