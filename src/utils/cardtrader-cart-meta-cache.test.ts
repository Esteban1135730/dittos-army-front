import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildCartMetaFromOffer,
  CARDTRADER_CART_META_TTL_MS,
  loadCardtraderCartMetaCache,
  mergeCartItemMeta,
  upsertCardtraderCartMeta,
} from "./cardtrader-cart-meta-cache";

const STORAGE_KEY = "dittos-army.cardtrader-cart-meta.v1";

function mockLocalStorage() {
  const store: Record<string, string> = {};
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => {
      store[k] = v;
    },
    removeItem: (k: string) => {
      delete store[k];
    },
    clear: () => {
      for (const key of Object.keys(store)) delete store[key];
    },
  });
  return store;
}

describe("cardtrader-cart-meta-cache", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("guarda y recupera metadata por product_id", () => {
    mockLocalStorage();
    upsertCardtraderCartMeta(42, {
      name: "Pikachu",
      imageUrl: "https://example.com/pika.png",
      language: "EN",
    });
    const all = loadCardtraderCartMetaCache();
    expect(all[42]).toMatchObject({
      name: "Pikachu",
      imageUrl: "https://example.com/pika.png",
      language: "EN",
    });
  });

  it("fusiona campos sin borrar los existentes", () => {
    mockLocalStorage();
    upsertCardtraderCartMeta(1, { name: "Mew", expansion: "Base" });
    upsertCardtraderCartMeta(1, { imageUrl: "https://img/mew.png" });
    expect(loadCardtraderCartMetaCache()[1]).toMatchObject({
      name: "Mew",
      expansion: "Base",
      imageUrl: "https://img/mew.png",
    });
  });

  it("expira entradas mayores a 48 h", () => {
    const store = mockLocalStorage();
    const old = Date.now() - CARDTRADER_CART_META_TTL_MS - 1000;
    store[STORAGE_KEY] = JSON.stringify({
      v: 1,
      items: {
        "99": {
          savedAt: old,
          meta: { name: "Expired" },
        },
      },
    });
    expect(loadCardtraderCartMetaCache()[99]).toBeUndefined();
    expect(JSON.parse(store[STORAGE_KEY]).items).toEqual({});
  });

  it("buildCartMetaFromOffer arma campos desde oferta y blueprint", () => {
    const meta = buildCartMetaFromOffer({
      product: {
        id: 10,
        name_en: "Charizard",
        blueprint_id: 5,
        properties_hash: { condition: "Near Mint", pokemon_language: "en" },
      },
      blueprint: {
        id: 5,
        image_url: "https://img/char.png",
        fixed_properties: { collector_number: "4", pokemon_rarity: "Rare" },
      },
      expansion: { name_en: "Base Set" },
    });
    expect(meta).toMatchObject({
      name: "Charizard",
      expansion: "Base Set",
      condition: "Near Mint",
      language: "EN",
      collectorNumber: "4",
      rarity: "Rare",
      imageUrl: "https://img/char.png",
    });
  });
});

describe("mergeCartItemMeta", () => {
  it("prefiere valores nuevos no vacíos", () => {
    expect(
      mergeCartItemMeta({ name: "A", language: "EN" }, { name: "B" }),
    ).toMatchObject({ name: "B", language: "EN" });
  });
});
