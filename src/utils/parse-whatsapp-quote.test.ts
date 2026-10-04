import { describe, expect, it } from "vitest";
import {
  detectPedidoPasteKind,
  parseWhatsappQuotePaste,
} from "./parse-whatsapp-quote";

const SAMPLE = `Hola, deseo cotizar las siguientes cartas contigo:

- Shroomish (Generations #RC2) — Idioma: Inglés, Estado: Perfecto
- Pikachu (Crown Zenith Galarian Gallery #GG30) — Idioma: Inglés, Estado: Perfecto
- Paras (Crown Zenith Galarian Gallery #GG32) — Idioma: Inglés, Estado: Perfecto
- Lacey (Prismatic Evolutions #175) — Idioma: Inglés, Estado: Perfecto
- Briar (Stellar Crown #171) — Idioma: Inglés, Estado: Perfecto
- Lana's Aid (Twilight Masquerade #219) — Idioma: Inglés, Estado: Perfecto
- Bianca's Devotion (Temporal Forces #197) — Idioma: Inglés, Estado: Perfecto
- Crispin (Prismatic Evolutions #171) — Idioma: Inglés, Estado: Perfecto
- Mela (Paradox Rift #236) — Idioma: Inglés, Estado: Perfecto
- Tulip (Paradox Rift #259) — Idioma: Inglés, Estado: Perfecto
- Roxie's Performance (Chaos Rising #112) — Idioma: Inglés, Estado: Perfecto
- Drayton (Prismatic Evolutions #172) — Idioma: Inglés, Estado: Perfecto
- Fuecoco (SVP Black Star Promos #079) — Idioma: No importa el idioma, Estado: Perfecto
* Skeledirge ex (SVP Black Star Promos #081) — Idioma: No importa el idioma, Estado: Perfecto
* Quaquaval ex (SVP Black Star Promos #084) — Idioma: No importa el idioma, Estado: Perfecto
* Fuecoco (Paldea Evolved #201) — Idioma: No importa el idioma, Estado: Perfecto
* Skeledirge ex (Paldea Evolved #258) — Idioma: No importa el idioma, Estado: Perfecto
`;

describe("parseWhatsappQuotePaste", () => {
  it("parsea el mensaje real de la tienda (viñetas - y *)", () => {
    const lines = parseWhatsappQuotePaste(SAMPLE);
    expect(lines).toHaveLength(17);
    expect(lines[0]).toMatchObject({
      name: "Shroomish",
      expansion: "Generations",
      collectorNumber: "RC2",
      languageLabel: "Inglés",
      conditionLabel: "Perfecto",
    });
    expect(lines[1]).toMatchObject({
      name: "Pikachu",
      expansion: "Crown Zenith Galarian Gallery",
      collectorNumber: "GG30",
    });
    expect(lines[12]).toMatchObject({
      name: "Fuecoco",
      expansion: "SVP Black Star Promos",
      collectorNumber: "079",
      languageLabel: "No importa el idioma",
    });
    expect(lines[13]).toMatchObject({
      name: "Skeledirge ex",
      expansion: "SVP Black Star Promos",
      collectorNumber: "081",
    });
    expect(lines[16]).toMatchObject({
      name: "Skeledirge ex",
      expansion: "Paldea Evolved",
      collectorNumber: "258",
    });
  });

  it("ignora encabezado y líneas basura", () => {
    const lines = parseWhatsappQuotePaste(
      "Hola, deseo cotizar las siguientes cartas contigo:\n\nesto no es una carta\n- Pikachu (Base Set #25) — Idioma: Español, Estado: Puede tener imperfecciones\n",
    );
    expect(lines).toHaveLength(1);
    expect(lines[0].name).toBe("Pikachu");
    expect(lines[0].conditionLabel).toBe("Puede tener imperfecciones");
  });

  it("acepta notas libres en idioma y falta de coma antes de Estado", () => {
    const lines = parseWhatsappQuotePaste(
      [
        "- Paras (BREAKthrough #1) — Idioma: normal y holo Inglés, Estado: Perfecto",
        "- Paras (Mysterious Treasures #92) — Idioma: Inglés, normal y reverse Estado: Perfecto",
        "- Erika's Paras (Gym Challenge #71) — Idioma: Inglés,first y normal  Estado: Perfecto",
        "- Paras (Generations #6) — Idioma: solo reverse Inglés, Estado: normal y reverse Perfecto",
      ].join("\n"),
    );
    expect(lines).toHaveLength(4);
    expect(lines[0]).toMatchObject({
      expansion: "BREAKthrough",
      collectorNumber: "1",
      languageLabel: "normal y holo Inglés",
      conditionLabel: "Perfecto",
    });
    expect(lines[1]).toMatchObject({
      expansion: "Mysterious Treasures",
      collectorNumber: "92",
      languageLabel: "Inglés, normal y reverse",
      conditionLabel: "Perfecto",
    });
    expect(lines[2]).toMatchObject({
      name: "Erika's Paras",
      expansion: "Gym Challenge",
      languageLabel: "Inglés,first y normal",
    });
    expect(lines[3].conditionLabel).toBe("normal y reverse Perfecto");
  });

  it("detectPedidoPasteKind: URLs ganan sobre cotización", () => {
    expect(detectPedidoPasteKind("")).toBe("empty");
    expect(detectPedidoPasteKind(SAMPLE)).toBe("quote");
    expect(
      detectPedidoPasteKind(
        "https://www.cardtrader.com/es/cards/225675-venusaur-v-100-swsh-black-star-promos",
      ),
    ).toBe("urls");
    expect(
      detectPedidoPasteKind(
        `${SAMPLE}\nhttps://www.cardtrader.com/es/cards/100-a`,
      ),
    ).toBe("urls");
  });
});
