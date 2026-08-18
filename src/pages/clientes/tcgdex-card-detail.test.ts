import { describe, expect, it, vi } from "vitest";
import axios from "axios";
import { buildTcgdexCardIdLookupCandidates } from "../../utils/tcgdex-set-resolve";
import {
  fetchTcgdexCardDetail,
  looksLikeTcgdexCardId,
  lookupTcgdexDetail,
  mapTcgdexApiToDetail,
  tcgdxCardIdCandidates,
} from "./tcgdex-card-detail";

vi.mock("axios", () => ({
  default: {
    get: vi.fn(),
    interceptors: {
      request: { use: vi.fn() },
    },
    defaults: { headers: { common: {} } },
  },
}));

describe("tcgdex-card-detail", () => {
  it("looksLikeTcgdexCardId acepta ids con ceros extra y sets con punto", () => {
    expect(looksLikeTcgdexCardId("sv8-194")).toBe(true);
    expect(looksLikeTcgdexCardId("sv08-130")).toBe(true);
    expect(looksLikeTcgdexCardId("sv04.5-028")).toBe(true);
    expect(looksLikeTcgdexCardId("neo3-032")).toBe(true);
    expect(looksLikeTcgdexCardId("")).toBe(false);
    expect(looksLikeTcgdexCardId("not-an-id")).toBe(false);
  });

  it("tcgdxCardIdCandidates normaliza neo3-032 → neo3-32", () => {
    const candidates = tcgdxCardIdCandidates("neo3-032");
    expect(candidates[0]).toBe("neo3-32");
    expect(candidates).toContain("neo3-032");
  });

  it("buildTcgdexCardIdLookupCandidates mantiene padding en sets SV", () => {
    expect(buildTcgdexCardIdLookupCandidates("sv10-023", "en")).toEqual(["sv10-023"]);
    expect(buildTcgdexCardIdLookupCandidates("sv08-130", "en")).toEqual(["sv08-130"]);
  });

  it("mapTcgdexApiToDetail extrae set y rareza", () => {
    const d = mapTcgdexApiToDetail({
      id: "sv8-194",
      name: "Pikachu",
      rarity: "Common",
      category: "Pokemon",
      set: "sv8(Surging Sparks)",
      setEnglishName: "Surging Sparks",
      images: { small: "http://img/s.png", large: "http://img/l.png" },
      types: ["Lightning"],
      hp: 60,
    });
    expect(d?.setLabel).toBe("Surging Sparks");
    expect(d?.rarity).toBe("Common");
    expect(d?.types).toEqual(["Lightning"]);
  });

  it("fetchTcgdexCardDetail devuelve null si id inválido", async () => {
    await expect(fetchTcgdexCardDetail("bad")).resolves.toBeNull();
  });

  it("fetchTcgdexCardDetail prueba variantes normalizadas", async () => {
    vi.mocked(axios.get).mockImplementation(async (url: string) => {
      if (url.includes("neo3-32")) {
        return {
          data: {
            id: "neo3-32",
            name: "Test Card",
            rarity: "Rare",
            category: "Pokemon",
            set: "neo3(Set)",
            image: "http://img",
          },
        };
      }
      throw new Error("404");
    });
    const d = await fetchTcgdexCardDetail("neo3-032");
    expect(d?.name).toBe("Test Card");
    expect(d?.id).toBe("neo3-32");
  });

  it("lookupTcgdexDetail funciona con objeto plano (cache React Query)", () => {
    const detail = {
      id: "neo3-32",
      name: "Test",
      imageUrl: "",
      imageLargeUrl: "",
      rarity: "",
      category: "",
      setLabel: "",
    };
    const map = { "neo3-032": detail, "neo3-32": detail };
    expect(lookupTcgdexDetail("neo3-032", map)?.name).toBe("Test");
  });
});
