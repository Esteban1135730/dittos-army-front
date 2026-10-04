import { describe, expect, it } from "vitest";
import {
  QR_FAVORITES_MAX,
  QR_FAVORITES_STORAGE_KEY,
  filterQrFavorites,
  isQrFavorite,
  loadQrFavorites,
  parseQrFavorites,
  qrFavoriteKey,
  reorderQrFavorites,
  saveQrFavorites,
  toggleQrFavorite,
  type QrFavorite,
} from "./qr-favorites";

function fav(partial: Partial<QrFavorite> & Pick<QrFavorite, "stock_id">): QrFavorite {
  return {
    stock_id: partial.stock_id,
    card_id: partial.card_id ?? "swsh3-136",
    card_name: partial.card_name ?? "Pikachu",
    image_url: partial.image_url ?? "",
    language: partial.language ?? "EN",
    rareza: partial.rareza === undefined ? "Holofoil" : partial.rareza,
    owner: partial.owner ?? "pablo",
  };
}

describe("qr favorites", () => {
  it("toggle agrega y quita sin confirmación por la misma carta", () => {
    const first = fav({ stock_id: "a" });
    const added = toggleQrFavorite([], first);
    expect(added).toHaveLength(1);
    expect(isQrFavorite(added, first)).toBe(true);
    const sameCardOtherCopy = fav({ stock_id: "b" });
    expect(qrFavoriteKey(sameCardOtherCopy)).toBe(qrFavoriteKey(first));
    expect(toggleQrFavorite(added, sameCardOtherCopy)).toEqual([]);
  });

  it("conserva como máximo 24 y descarta el más antiguo", () => {
    let list: QrFavorite[] = [];
    for (let i = 0; i < QR_FAVORITES_MAX + 3; i++) {
      list = toggleQrFavorite(
        list,
        fav({ stock_id: `id-${i}`, card_id: `card-${i}`, rareza: null }),
      );
    }
    expect(list).toHaveLength(QR_FAVORITES_MAX);
    expect(list[0].stock_id).toBe(`id-${QR_FAVORITES_MAX + 2}`);
    expect(list.some((item) => item.stock_id === "id-0")).toBe(false);
  });

  it("parsea storage y descarta entradas inválidas", () => {
    const raw = JSON.stringify([
      fav({ stock_id: "ok" }),
      { stock_id: "", card_id: "x", owner: "pablo" },
      { stock_id: "z", card_id: "y", owner: "nadie" },
      "basura",
    ]);
    expect(parseQrFavorites(raw)).toEqual([fav({ stock_id: "ok" })]);
    expect(parseQrFavorites("no-json")).toEqual([]);
    expect(parseQrFavorites(null)).toEqual([]);
  });

  it("persiste en la clave estable", () => {
    const mem = new Map<string, string>();
    const storage = {
      getItem: (key: string) => mem.get(key) ?? null,
      setItem: (key: string, value: string) => {
        mem.set(key, value);
      },
    };
    const list = [fav({ stock_id: "a" })];
    saveQrFavorites(list, storage);
    expect(mem.has(QR_FAVORITES_STORAGE_KEY)).toBe(true);
    expect(loadQrFavorites(storage)).toEqual(list);
  });

  it("filtra por nombre, idioma o rareza", () => {
    const list = [
      fav({ stock_id: "a", card_name: "Pikachu", language: "EN" }),
      fav({ stock_id: "b", card_id: "sv1-2", card_name: "Charizard", language: "JA", rareza: null }),
    ];
    expect(filterQrFavorites(list, "  pika ")).toEqual([list[0]]);
    expect(filterQrFavorites(list, "ja")).toEqual([list[1]]);
    expect(filterQrFavorites(list, "")).toEqual(list);
  });

  it("reordena solo las visibles y conserva el resto", () => {
    const hidden = fav({ stock_id: "h", card_id: "hidden", card_name: "Mew" });
    const a = fav({ stock_id: "a", card_id: "a", card_name: "Pikachu" });
    const b = fav({ stock_id: "b", card_id: "b", card_name: "Charmander" });
    const list = [a, hidden, b];
    const next = reorderQrFavorites(list, [a, b], qrFavoriteKey(b), qrFavoriteKey(a));
    expect(next.map((item) => item.stock_id)).toEqual(["b", "h", "a"]);
    expect(reorderQrFavorites(list, [a, b], qrFavoriteKey(a), qrFavoriteKey(a))).toBe(list);
  });
});
