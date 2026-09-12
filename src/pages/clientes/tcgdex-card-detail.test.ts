import { describe, expect, it, vi } from "vitest";
import axios from "axios";
import { buildTcgdexCardIdLookupCandidates } from "../../utils/tcgdex-set-resolve";
import {
  fetchTcgdexCardDetail,
  looksLikeTcgdexCardId,
  lookupTcgdexDetail,
  mapTcgdexApiToDetail,
  resolveCardImageSrc,
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

vi.mock("../../config/api", () => ({
  apiUrl: (path: string) => `https://api.test${path.startsWith("/") ? path : `/${path}`}`,
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

  it("resolveCardImageSrc prioriza la URL guardada y cae a TCGdex", () => {
    const detail = {
      id: "me05-066",
      name: "Pikipek",
      imageUrl: "https://tcgdex.example/pikipek.png",
      imageLargeUrl: "",
      rarity: "",
      category: "",
      setLabel: "",
    };
    const map = { "me05-066": detail };
    expect(resolveCardImageSrc("me05-066", "https://lote/local.png", map)).toBe(
      "https://lote/local.png",
    );
    expect(resolveCardImageSrc("me05-066", "", map)).toBe("https://tcgdex.example/pikipek.png");
    expect(resolveCardImageSrc("me05-066", null, {})).toBe("");
  });

  it("resolveCardImageSrc prefiere CDN TCGdex si la URL guardada es caché local", () => {
    const detail = {
      id: "me03-117",
      name: "Wondrous Patch",
      imageUrl: "https://assets.tcgdex.net/en/me/me03/117/low.png",
      imageLargeUrl: "",
      rarity: "",
      category: "",
      setLabel: "",
    };
    const map = { "me03-117": detail };
    expect(
      resolveCardImageSrc(
        "me03-117",
        "http://localhost:3000/card-images/me03/me03-117.png",
        map,
      ),
    ).toBe("https://assets.tcgdex.net/en/me/me03/117/low.png");
    expect(resolveCardImageSrc("me03-117", "/card-images/me03/me03-117.png", map)).toBe(
      "https://assets.tcgdex.net/en/me/me03/117/low.png",
    );
    expect(
      resolveCardImageSrc(
        "me03-117",
        "http://localhost:3000/card-images/me03/me03-117.png",
        {},
      ),
    ).toBe("https://api.test/card-images/me03/me03-117.png");
  });

  it("resolveCardImageSrc reescribe /card-images/ y localhost contra el API", () => {
    expect(resolveCardImageSrc("sv8-194", "/card-images/sv8/sv8-194.png", {})).toBe(
      "https://api.test/card-images/sv8/sv8-194.png",
    );
    expect(
      resolveCardImageSrc("sv8-194", "http://localhost:3000/card-images/sv8/sv8-194.png", {}),
    ).toBe("https://api.test/card-images/sv8/sv8-194.png");
    expect(
      resolveCardImageSrc("sv8-194", "https://assets.tcgdex.net/en/sv8/194/low.png", {}),
    ).toBe("https://assets.tcgdex.net/en/sv8/194/low.png");
  });
});
