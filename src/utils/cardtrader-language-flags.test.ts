import { describe, expect, it } from "vitest";
import {
  flagComponentForIso,
  languageCountryIso,
  languageDisplayCode,
} from "./cardtrader-language-flags";

describe("cardtrader-language-flags", () => {
  it("resuelve componente SVG empaquetado por ISO", () => {
    expect(flagComponentForIso("us")).toBeTruthy();
    expect(flagComponentForIso("es")).toBeTruthy();
    expect(flagComponentForIso("xx")).toBeNull();
  });

  it("mapea ISO país", () => {
    expect(languageCountryIso("EN")).toBe("us");
    expect(languageCountryIso("es")).toBe("es");
  });

  it("etiqueta corta de idioma", () => {
    expect(languageDisplayCode("en")).toBe("EN");
  });
});
