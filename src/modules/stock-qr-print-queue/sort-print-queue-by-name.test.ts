import { describe, expect, it } from "vitest";
import { sortPrintQueueByName } from "./sort-print-queue-by-name";

describe("sortPrintQueueByName", () => {
  it("ordena por nombre sin mutar el original", () => {
    const queue = [
      { stockId: "z", quantity: 1 },
      { stockId: "a", quantity: 2 },
      { stockId: "m", quantity: 1 },
    ];
    const names = new Map([
      ["z", "Zubat"],
      ["a", "Abra"],
      ["m", "Mew"],
    ]);
    const sorted = sortPrintQueueByName(queue, names);
    expect(sorted.map((e) => e.stockId)).toEqual(["a", "m", "z"]);
    expect(queue.map((e) => e.stockId)).toEqual(["z", "a", "m"]);
    expect(sorted[0]?.quantity).toBe(2);
  });

  it("ignora mayúsculas", () => {
    const queue = [
      { stockId: "2", quantity: 1 },
      { stockId: "1", quantity: 1 },
    ];
    const names = new Map([
      ["2", "pikachu"],
      ["1", "Pidgey"],
    ]);
    expect(sortPrintQueueByName(queue, names).map((e) => e.stockId)).toEqual([
      "1",
      "2",
    ]);
  });

  it("deja sin nombre al final y desempata por stockId", () => {
    const queue = [
      { stockId: "b", quantity: 1 },
      { stockId: "missing", quantity: 1 },
      { stockId: "a", quantity: 1 },
    ];
    const names = new Map([
      ["b", "Pikachu"],
      ["a", "Pikachu"],
    ]);
    expect(sortPrintQueueByName(queue, names).map((e) => e.stockId)).toEqual([
      "a",
      "b",
      "missing",
    ]);
  });
});
