import { describe, expect, it } from "vitest";
import {
  expansionFromCardDto,
  pathDestinoWhatsApp,
  resolverDestinoWhatsApp,
  urlWhatsAppConTexto,
} from "./mensaje-reserva-pedido";

describe("expansionFromCardDto", () => {
  it("prioriza setEnglishName sobre el nombre localizado en set", () => {
    expect(
      expansionFromCardDto({
        set: "SV5a(クリムゾンヘイズ)",
        setEnglishName: "Crimson Haze",
      }),
    ).toBe("Crimson Haze");
  });

  it("usa el nombre dentro de paréntesis si no hay setEnglishName", () => {
    expect(expansionFromCardDto({ set: "sv8(Surging Sparks)" })).toBe(
      "Surging Sparks",
    );
  });

  it("ignora setEnglishName vacío y cae al set localizado", () => {
    expect(
      expansionFromCardDto({
        set: "SV5a(クリムゾンヘイズ)",
        setEnglishName: "  ",
      }),
    ).toBe("クリムゾンヘイズ");
  });
});

describe("resolverDestinoWhatsApp", () => {
  it("antepone 57 a móviles colombianos de 10 dígitos", () => {
    expect(resolverDestinoWhatsApp("3001234567")).toEqual({
      kind: "phone",
      value: "573001234567",
    });
    expect(pathDestinoWhatsApp("+57 300 123 4567")).toBe("573001234567");
  });

  it("usa @{nick} si el contacto empieza por @ o tiene letras", () => {
    expect(resolverDestinoWhatsApp("@dittos.army")).toEqual({
      kind: "username",
      value: "dittos.army",
    });
    expect(pathDestinoWhatsApp("@@Juan_Perez")).toBe("@Juan_Perez");
    expect(pathDestinoWhatsApp("tienda_dittos")).toBe("@tienda_dittos");
  });

  it("no trata un número con guiones como nick", () => {
    expect(pathDestinoWhatsApp("300-123-4567")).toBe("573001234567");
  });
});

describe("urlWhatsAppConTexto", () => {
  it("abre wa.me con número o con @{nick}", () => {
    expect(urlWhatsAppConTexto("3001234567", "hola")).toBe(
      "https://wa.me/573001234567?text=hola",
    );
    expect(urlWhatsAppConTexto("@dittos.army", "hola")).toBe(
      "https://wa.me/@dittos.army?text=hola",
    );
  });

  it("abre wa.me sin destino si no hay contacto", () => {
    expect(urlWhatsAppConTexto(undefined, "hola")).toBe("https://wa.me/?text=hola");
    expect(urlWhatsAppConTexto("   ", "hola")).toBe("https://wa.me/?text=hola");
  });
});
