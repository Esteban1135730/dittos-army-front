/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useExchangeRates } from "./tasa";

function seedRates() {
  localStorage.setItem("euro-cop-rate", "4500");
  localStorage.setItem("usd-cop-rate", "4000");
  localStorage.setItem("usd-eur-rate", "0.9");
  localStorage.setItem("rates-date", new Date().toISOString());
}

describe("useExchangeRates", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("convert mantiene la misma referencia entre renders si las tasas no cambian", () => {
    seedRates();
    const { result, rerender } = renderHook(() => useExchangeRates());
    const first = result.current.convert;
    rerender();
    rerender();
    expect(result.current.convert).toBe(first);
    expect(first.toCopFromEur(2)).toBe(9000);
    expect(first.toCopFromUsd(2)).toBe(8000);
    expect(first.toEurFromUsd(10)).toBe(9);
    expect(first.toEurFromCop(9000)).toBe(2);
    expect(first.toUsdFromCop(8000)).toBe(2);
  });

  it("sin tasas → conversiones null; al guardar tasas cambia la referencia y convierte", () => {
    const { result } = renderHook(() => useExchangeRates());
    const before = result.current.convert;
    expect(result.current.isPrompting).toBe(true);
    expect(before.toCopFromEur(1)).toBeNull();
    expect(before.toEurFromCop(1)).toBeNull();

    act(() => {
      result.current.handleSaveRates({
        euroToCop: "5000",
        usdToCop: "4000",
        usdToEur: "0.8",
      });
    });

    expect(result.current.convert).not.toBe(before);
    expect(result.current.convert.toCopFromEur(1)).toBe(5000);
    expect(result.current.isPrompting).toBe(false);
  });
});
