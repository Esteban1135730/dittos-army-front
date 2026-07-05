import { describe, expect, it } from "vitest";
import { formatQrLabelMetaLine } from "./export-stock-qr-labels";

describe("formatQrLabelMetaLine", () => {
  it("combina expansión e idioma", () => {
    expect(formatQrLabelMetaLine("Scarlet & Violet", "ES")).toBe(
      "Scarlet & Violet · ES",
    );
  });

  it("omite idioma vacío o guión", () => {
    expect(formatQrLabelMetaLine("Base Set", "—")).toBe("Base Set");
    expect(formatQrLabelMetaLine("Base Set", "")).toBe("Base Set");
  });

  it("devuelve vacío si no hay datos", () => {
    expect(formatQrLabelMetaLine("", "")).toBe("");
    expect(formatQrLabelMetaLine("  ", "—")).toBe("");
  });

  it("trunca líneas largas", () => {
    const long = "A".repeat(40);
    expect(formatQrLabelMetaLine(long, "EN", 30)).toHaveLength(30);
    expect(formatQrLabelMetaLine(long, "EN", 30).endsWith("…")).toBe(true);
  });
});
