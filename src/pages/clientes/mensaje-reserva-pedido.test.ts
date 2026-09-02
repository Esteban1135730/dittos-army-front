import { describe, expect, it, vi } from "vitest";
import {
  expansionFromCardDto,
  pathDestinoWhatsApp,
  resolverDestinoWhatsApp,
  urlWhatsAppConTexto,
  buildWhatsAppPedidoText,
  formatStoreReservaCaminoLine,
  buildWhatsAppReservaCaminoText,
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

vi.mock("axios", () => ({
  default: {
    get: vi.fn().mockRejectedValue(new Error("offline")),
    defaults: { headers: { common: {} } },
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  },
}));

describe("buildWhatsAppPedidoText", () => {
  it("incluye entrega de tienda", async () => {
    const text = await buildWhatsAppPedidoText({
      clientName: "Ana",
      descripcionEntrega: "Valhalla — Cl. 150 #16-56",
      lines: [{ card_id: "a", card_name: "Pikachu", precio: 1000 }],
    });
    expect(text).toContain("Entrega: Valhalla — Cl. 150 #16-56");
    expect(text).not.toContain("Tienda de entrega:");
  });

  it("omite línea de entrega si no hay pedido", async () => {
    const text = await buildWhatsAppPedidoText({
      clientName: "Ana",
      lines: [{ card_id: "a", card_name: "Pikachu", precio: 1000 }],
    });
    expect(text).not.toContain("Entrega:");
    expect(text).not.toContain("Tienda de entrega:");
  });

  it("incluye Abonado y Saldo del pedido tras el Total", async () => {
    const text = await buildWhatsAppPedidoText({
      clientName: "Ana",
      lines: [{ card_id: "a", card_name: "Pikachu", precio: 1000 }],
      abonado_cop: 400,
      saldo_cop: 600,
    });
    const totalIdx = text.indexOf("Total:");
    const abonadoIdx = text.indexOf("Abonado:");
    const saldoIdx = text.indexOf("Saldo:");
    expect(totalIdx).toBeGreaterThan(-1);
    expect(abonadoIdx).toBeGreaterThan(totalIdx);
    expect(saldoIdx).toBeGreaterThan(abonadoIdx);
  });
});

describe("formatStoreReservaCaminoLine", () => {
  it("usa el formato de la tienda con PVP", async () => {
    const line = formatStoreReservaCaminoLine(
      {
        card_id: "me05-066",
        card_name: "Pikipek",
        quantity: 2,
        language: "en",
        precio_cop: 4000,
      },
      "Pitch Black",
    );
    expect(line).toContain("ID: me05-066");
    expect(line).toContain("Idioma: Inglés");
    expect(line).toContain("x2");
    expect(line).toMatch(/Precio:/);

    const text = await buildWhatsAppReservaCaminoText({
      clientName: "Julian Pabon",
      lines: [
        {
          card_id: "me05-066",
          card_name: "Pikipek",
          quantity: 2,
          language: "en",
          precio_cop: 4000,
        },
      ],
    });
    expect(text).toContain("te confirmo tu reserva");
    expect(text).toContain("A nombre de: Julian Pabon");
    expect(text).toContain("ID: me05-066");
    expect(text).toMatch(/Precio:/);
    expect(text).not.toContain("Abonado:");
    expect(text).not.toContain("Saldo:");
  });

  it("añade Abonado y Saldo después del Total cuando se pasan las cifras", async () => {
    const text = await buildWhatsAppReservaCaminoText({
      clientName: "Julian Pabon",
      lines: [
        {
          card_id: "me05-066",
          card_name: "Pikipek",
          quantity: 2,
          language: "en",
          precio_cop: 4000,
        },
      ],
      abonado_cop: 3000,
      saldo_cop: 5000,
    });
    const totalIdx = text.indexOf("Total:");
    const abonadoIdx = text.indexOf("Abonado:");
    const saldoIdx = text.indexOf("Saldo:");
    expect(totalIdx).toBeGreaterThan(-1);
    expect(abonadoIdx).toBeGreaterThan(totalIdx);
    expect(saldoIdx).toBeGreaterThan(abonadoIdx);
  });

  it("añade Abonado y Saldo aunque no haya Total PVP", async () => {
    const text = await buildWhatsAppReservaCaminoText({
      clientName: "Ana",
      lines: [{ card_id: "x-1", card_name: "Carta", quantity: 1 }],
      abonado_cop: 500,
      saldo_cop: -500,
    });
    expect(text).not.toContain("Total:");
    expect(text).toContain("Abonado:");
    expect(text).toContain("Saldo:");
  });
});
