import { describe, expect, it } from "vitest";
import { isCiudadBogota } from "./ciudad-bogota";

describe("isCiudadBogota", () => {
  it("reconoce Bogotá / bogota / BOGOTÁ D.C.", () => {
    expect(isCiudadBogota("Bogotá")).toBe(true);
    expect(isCiudadBogota("bogota")).toBe(true);
    expect(isCiudadBogota("BOGOTÁ D.C.")).toBe(true);
  });

  it("rechaza otras ciudades y vacío", () => {
    expect(isCiudadBogota("Medellín")).toBe(false);
    expect(isCiudadBogota("")).toBe(false);
    expect(isCiudadBogota(undefined)).toBe(false);
  });
});
