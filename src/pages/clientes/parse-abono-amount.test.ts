import { describe, expect, it } from "vitest";
import { parseAbonoAmountCop } from "./parse-abono-amount";

describe("parseAbonoAmountCop", () => {
  it("acepta un entero ≥ 1 dentro del saldo", () => {
    expect(parseAbonoAmountCop("1500", 5000)).toEqual({ ok: true, amount: 1500 });
    expect(parseAbonoAmountCop("  1  ", 1)).toEqual({ ok: true, amount: 1 });
  });

  it("rechaza vacío, decimales y no dígitos", () => {
    expect(parseAbonoAmountCop("", 5000).ok).toBe(false);
    expect(parseAbonoAmountCop("1.5", 5000).ok).toBe(false);
    expect(parseAbonoAmountCop("1,5", 5000).ok).toBe(false);
    expect(parseAbonoAmountCop("abc", 5000).ok).toBe(false);
    expect(parseAbonoAmountCop("0", 5000).ok).toBe(false);
    expect(parseAbonoAmountCop("-10", 5000).ok).toBe(false);
  });

  it("rechaza un monto mayor que el saldo cuando hay saldo", () => {
    expect(parseAbonoAmountCop("5001", 5000)).toEqual({
      ok: false,
      message: "El abono no puede superar el saldo.",
    });
  });
});
