import { describe, expect, it } from "vitest";
import { isBarcodeIdLike, parseBarcodeScan } from "./barcode-value";

describe("parseBarcodeScan", () => {
  it("recorta espacios y devuelve id igual al texto", () => {
    expect(parseBarcodeScan("  swsh3-136  ")).toEqual({
      raw: "swsh3-136",
      id: "swsh3-136",
    });
  });

  it("acepta ids solo numéricos", () => {
    expect(parseBarcodeScan("130752")).toEqual({
      raw: "130752",
      id: "130752",
    });
  });
});

describe("isBarcodeIdLike", () => {
  it("valida alfanuméricos habituales", () => {
    expect(isBarcodeIdLike("abc123")).toBe(true);
    expect(isBarcodeIdLike("130752")).toBe(true);
    expect(isBarcodeIdLike("swsh3-136")).toBe(true);
  });

  it("rechaza vacío", () => {
    expect(isBarcodeIdLike("")).toBe(false);
  });
});
