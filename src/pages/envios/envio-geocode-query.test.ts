import { describe, expect, it } from "vitest";
import { buildEnvioGeocodeQuery, isEnvioGeocodeCandidate } from "./envio-geocode-query";

describe("buildEnvioGeocodeQuery", () => {
  it("usa dirección y notas, no solo la ciudad", () => {
    expect(
      buildEnvioGeocodeQuery({
        direccion_o_punto: "Unicentro local 203",
        notas_entrega: "Portería torre 2",
        ciudad: "",
      }),
    ).toBe("Unicentro local 203, Portería torre 2");
  });
});

describe("isEnvioGeocodeCandidate", () => {
  it("sí para envío omitido o domicilio, no para tienda", () => {
    expect(
      isEnvioGeocodeCandidate({
        entrega_en_tienda: false,
        mapa: { kind: "omitido" },
      }),
    ).toBe(true);
    expect(
      isEnvioGeocodeCandidate({
        entrega_en_tienda: true,
        mapa: { kind: "tienda" },
      }),
    ).toBe(false);
  });
});
