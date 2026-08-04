import { describe, expect, it } from "vitest";
import {
  filterReceiptLineCardGroups,
  groupReceiptLinesByCard,
  type ReceiptLineGroupInput,
} from "./group-receipt-lines-by-card";

function line(
  partial: Partial<ReceiptLineGroupInput> & { line_id: string },
): ReceiptLineGroupInput {
  return {
    card_id: "sv1-1",
    card_name: "Pikachu",
    language: "EN",
    rareza: null,
    collector_number: "25",
    expansion: "SV1",
    quantity_expected: 1,
    blueprint_id: null,
    ...partial,
  };
}

describe("groupReceiptLinesByCard", () => {
  it("agrupa la misma carta de lotes distintos bajo un grupo", () => {
    const groups = groupReceiptLinesByCard([
      line({ line_id: "1", card_id: "sv1-1" }),
      line({ line_id: "2", card_id: "sv1-1" }),
      line({
        line_id: "3",
        card_id: "sv1-2",
        card_name: "Charmander",
      }),
    ]);
    expect(groups).toHaveLength(2);
    const pika = groups.find((g) => g.title === "Pikachu");
    expect(pika?.lines).toHaveLength(2);
  });

  it("prioriza blueprint_id sobre card_id", () => {
    const groups = groupReceiptLinesByCard([
      line({
        line_id: "1",
        blueprint_id: 42,
        card_id: "a",
        card_name: "Same BP",
      }),
      line({
        line_id: "2",
        blueprint_id: 42,
        card_id: "b",
        card_name: "Same BP",
      }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe("bp:42");
    expect(groups[0].lines).toHaveLength(2);
  });

  it("ordena grupos por nombre", () => {
    const groups = groupReceiptLinesByCard([
      line({ line_id: "1", card_id: "z", card_name: "Zebra" }),
      line({ line_id: "2", card_id: "a", card_name: "Abra" }),
    ]);
    expect(groups.map((g) => g.title)).toEqual(["Abra", "Zebra"]);
  });
});

describe("filterReceiptLineCardGroups", () => {
  it("filtra por nombre", () => {
    const groups = groupReceiptLinesByCard([
      line({ line_id: "1", card_name: "Pikachu", card_id: "1" }),
      line({ line_id: "2", card_name: "Mew", card_id: "2" }),
    ]);
    const filtered = filterReceiptLineCardGroups(groups, "pik");
    expect(filtered).toHaveLength(1);
    expect(filtered[0].title).toBe("Pikachu");
  });
});
