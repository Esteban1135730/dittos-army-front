import { describe, expect, it } from "vitest";
import {
  applyPedidoQuoteCandidate,
  mapWhatsappQuoteResultsToPedidoLines,
  pedidoLineCanLoadOffers,
} from "./map-whatsapp-quote-to-pedido";
import type { ParsedWhatsappQuoteLine } from "./parse-whatsapp-quote";

const parsed: ParsedWhatsappQuoteLine = {
  lineNumber: 1,
  raw: "- Shroomish (Generations #RC2) — Idioma: Inglés, Estado: Perfecto",
  name: "Shroomish",
  expansion: "Generations",
  collectorNumber: "RC2",
  languageLabel: "Inglés",
  conditionLabel: "Perfecto",
};

describe("mapWhatsappQuoteResultsToPedidoLines", () => {
  it("mapea matched con filtros de idioma y Near Mint", () => {
    const lines = mapWhatsappQuoteResultsToPedidoLines([parsed], [
      {
        status: "matched",
        blueprint_id: 99,
        expansion_id: 1577,
        expansion_name: "Generations",
        name: "Shroomish",
        collector_number: "RC2",
        pokemon_language: "en",
        condition: "Near Mint",
        image_url: "https://cdn.example/s.jpg",
      },
    ]);
    expect(lines[0]).toMatchObject({
      source: "quote",
      resolveStatus: "matched",
      blueprintId: 99,
      pokemonLanguage: "en",
      conditionFilter: "Near Mint",
      quantity: 1,
    });
    expect(pedidoLineCanLoadOffers(lines[0])).toBe(true);
  });

  it("ambiguous no carga ofertas hasta elegir candidato", () => {
    const lines = mapWhatsappQuoteResultsToPedidoLines([parsed], [
      {
        status: "ambiguous",
        candidates: [
          {
            blueprint_id: 1,
            expansion_id: 10,
            expansion_name: "Generations",
            name: "Shroomish",
            collector_number: "RC2",
          },
        ],
      },
    ]);
    expect(pedidoLineCanLoadOffers(lines[0])).toBe(false);
    const chosen = applyPedidoQuoteCandidate(lines[0], lines[0].candidates![0]);
    expect(chosen.resolveStatus).toBe("ambiguous");
    expect(chosen.blueprintId).toBe(1);
    expect(chosen.candidates).toHaveLength(1);
    expect(pedidoLineCanLoadOffers(chosen)).toBe(true);
  });

  it("not_found deja blueprint 0", () => {
    const lines = mapWhatsappQuoteResultsToPedidoLines([parsed], [
      { status: "not_found", error: "expansion_not_mapped" },
    ]);
    expect(lines[0].blueprintId).toBe(0);
    expect(pedidoLineCanLoadOffers(lines[0])).toBe(false);
  });
});
