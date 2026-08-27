import { describe, expect, it } from "vitest";
import {
  buildQuoteSessionCreateBody,
  mapQuoteSessionToPedidoLines,
} from "./map-quote-session";
import { pedidoLineCanLoadOffers, pedidoLineShowsCandidates } from "./map-whatsapp-quote-to-pedido";

describe("mapQuoteSession", () => {
  it("arma el POST de WhatsApp con snapshot resolve", () => {
    const body = buildQuoteSessionCreateBody({
      source: "whatsapp",
      rawPaste: "Hola",
      quoteLines: [
        {
          lineNumber: 1,
          raw: "- Shroomish (Generations #RC2) — Idioma: Inglés, Estado: Perfecto",
          name: "Shroomish",
          expansion: "Generations",
          collectorNumber: "RC2",
          languageLabel: "Inglés",
          conditionLabel: "Perfecto",
        },
      ],
      results: [{ status: "matched", blueprint_id: 99, expansion_id: 1577 }],
    });
    expect(body.lines[0]).toMatchObject({
      name: "Shroomish",
      expansion: "Generations",
      collector_number: "RC2",
      resolve: { status: "matched", blueprint_id: 99 },
    });
  });

  it("hidrata ambiguous con candidatos y sin ofertas hasta el pick", () => {
    const lines = mapQuoteSessionToPedidoLines({
      id: "abc",
      status: "in_progress",
      source: "whatsapp",
      active_index: 0,
      lines: [
        {
          index: 0,
          name: "Pikachu",
          expansion: "Crown Zenith Galarian Gallery",
          collector_number: "GG30",
          resolve: {
            status: "ambiguous",
            candidates: [
              {
                blueprint_id: 1,
                expansion_id: 2,
                name: "Pikachu",
                expansion_name: "Crown Zenith",
                collector_number: "GG30",
                image_url: "https://cdn.example/a.jpg",
              },
            ],
          },
          selected_blueprint: null,
        },
      ],
    });
    expect(pedidoLineShowsCandidates(lines[0])).toBe(true);
    expect(pedidoLineCanLoadOffers(lines[0])).toBe(false);
    expect(lines[0].candidates?.[0].imageUrl).toContain("cdn.example");
  });
});
