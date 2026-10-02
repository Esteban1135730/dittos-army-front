import { describe, expect, it } from "vitest";
import {
  API_TCG_PREFIX,
  apiUrl,
  getApiOrigin,
  resolveAxiosTcg,
} from "./api";

describe("apiUrl", () => {
  it("antepone /pokemon a recursos Nest", () => {
    const origin = getApiOrigin();
    expect(apiUrl("/stock")).toBe(`${origin}${API_TCG_PREFIX}/stock`);
    expect(apiUrl("sales/dashboard")).toBe(
      `${origin}${API_TCG_PREFIX}/sales/dashboard`,
    );
    expect(apiUrl("/pokemon/client")).toBe(`${origin}${API_TCG_PREFIX}/client`);
  });

  it("no prefija /card-images, /stock-photos ni /health", () => {
    const origin = getApiOrigin();
    expect(apiUrl("/card-images/swsh3/a.png")).toBe(
      `${origin}/card-images/swsh3/a.png`,
    );
    expect(apiUrl("/stock-photos/pablo/sv8-1/abc.jpg")).toBe(
      `${origin}/stock-photos/pablo/sv8-1/abc.jpg`,
    );
    expect(apiUrl("/health")).toBe(`${origin}/health`);
  });

  it("catálogo externo va bajo /pokemon (TCG por X-Tcg)", () => {
    const origin = getApiOrigin();
    expect(apiUrl("/catalog/sets")).toBe(`${origin}${API_TCG_PREFIX}/catalog/sets`);
  });

  it("resolveAxiosTcg respeta override", () => {
    expect(resolveAxiosTcg({}, "pokemon")).toBe("pokemon");
    expect(resolveAxiosTcg({ tcgOverride: "yugioh" }, "pokemon")).toBe("yugioh");
    expect(resolveAxiosTcg({ tcgOverride: "onepiece" }, "magic")).toBe("onepiece");
  });
});
