import { describe, expect, it } from "vitest";
import {
  groupCounterSearchRows,
  isCounterSearchRowSellable,
  pickGroupScanStockId,
  type CounterSearchRow,
} from "./search-groups";

  function row(partial: Partial<CounterSearchRow> & Pick<CounterSearchRow, "_id">): CounterSearchRow {
  return {
    _id: partial._id,
    card_id: partial.card_id ?? "swsh3-136",
    card_name: partial.card_name ?? "Pikachu",
    image_url: partial.image_url ?? "",
    card_state: partial.card_state ?? "disponible",
    language: partial.language ?? "en",
    rareza: partial.rareza === undefined ? "holofoil" : partial.rareza,
    holofoil: partial.holofoil,
    league_card: partial.league_card,
    product_kind: partial.product_kind,
    quantity: partial.quantity,
    pvp: partial.pvp,
    pvp_currency: partial.pvp_currency,
    owner: partial.owner,
  };
}

describe("búsqueda manual del mostrador", () => {
  it("excluye estados no vendibles", () => {
    expect(isCounterSearchRowSellable(row({ _id: "1", card_state: "vendida" }))).toBe(false);
    expect(isCounterSearchRowSellable(row({ _id: "2", card_state: "propiedad" }))).toBe(false);
    expect(isCounterSearchRowSellable(row({ _id: "3", card_state: "perdida" }))).toBe(false);
    expect(isCounterSearchRowSellable(row({ _id: "4", card_state: "reserva" }))).toBe(false);
    expect(
      isCounterSearchRowSellable(
        row({ _id: "5", product_kind: "quantity", quantity: 0 }),
      ),
    ).toBe(false);
    expect(isCounterSearchRowSellable(row({ _id: "6", card_state: "en_stock_colombia" }))).toBe(
      true,
    );
  });

  it("agrupa por card_id, idioma y rareza operativa", () => {
    const groups = groupCounterSearchRows([
      row({ _id: "b", language: "en", rareza: "holofoil", pvp: 5000, pvp_currency: "COP" }),
      row({ _id: "a", language: "EN", rareza: "holofoil" }),
      row({ _id: "c", language: "ja", rareza: "holofoil" }),
      row({ _id: "d", language: "en", rareza: null, holofoil: true }),
      row({ _id: "e", card_state: "vendida" }),
      row({ _id: "f", card_state: "perdida", language: "en" }),
    ]);
    expect(groups).toHaveLength(2);
    const en = groups.find((g) => g.language === "EN");
    const ja = groups.find((g) => g.language === "JA");
    expect(en?.stock_ids).toEqual(["a", "b", "d"]);
    expect(en?.count).toBe(3);
    expect(en?.rareza).toBe("Holofoil");
    expect(en?.pvp).toBe(5000);
    expect(en?.pvp_currency).toBe("COP");
    expect(ja?.stock_ids).toEqual(["c"]);
  });

  it("separa la misma carta si está en Pablo y en Esteban", () => {
    const groups = groupCounterSearchRows([
      row({ _id: "p1", owner: "pablo" }),
      row({ _id: "e1", owner: "esteban" }),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups.map((g) => g.owner).sort()).toEqual(["esteban", "pablo"]);
    expect(groups.every((g) => g.stock_ids.length === 1)).toBe(true);
  });

  it("elige un id fuera del carrito y, si no hay, el primero", () => {
    expect(pickGroupScanStockId(["a", "b", "c"], ["a"])).toBe("b");
    expect(pickGroupScanStockId(["a", "b"], ["a", "b"])).toBe("a");
    expect(pickGroupScanStockId([], [])).toBeNull();
  });
});
