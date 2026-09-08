import { describe, expect, it } from "vitest";
import { ESTEBAN_STOCK_MARK } from "../../config/owners";
import { formatWhatsAppLineOwners } from "./import-whatsapp-owner-label";

describe("formatWhatsAppLineOwners", () => {
  it("devuelve vacío si no hay owners", () => {
    expect(formatWhatsAppLineOwners(undefined)).toBe("");
    expect(formatWhatsAppLineOwners([])).toBe("");
  });

  it("una sola DB", () => {
    expect(formatWhatsAppLineOwners(["pablo", "pablo"])).toBe("2 Pablo");
    expect(formatWhatsAppLineOwners(["esteban"])).toBe(`1 ${ESTEBAN_STOCK_MARK} Esteban`);
  });

  it("línea mixta N Pablo + M ☼ Esteban", () => {
    expect(formatWhatsAppLineOwners(["pablo", "esteban"])).toBe(
      `1 Pablo + 1 ${ESTEBAN_STOCK_MARK} Esteban`,
    );
    expect(formatWhatsAppLineOwners(["pablo", "pablo", "esteban"])).toBe(
      `2 Pablo + 1 ${ESTEBAN_STOCK_MARK} Esteban`,
    );
  });

  it("usa el glifo U+263C", () => {
    expect(ESTEBAN_STOCK_MARK).toBe("\u263C");
    expect(formatWhatsAppLineOwners(["esteban"])).toContain("\u263C");
  });
});
