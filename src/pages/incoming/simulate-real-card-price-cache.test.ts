import { afterEach, describe, expect, it, vi } from "vitest";
import {
  loadSimulateInputsCache,
  saveSimulateInputsCache,
  SIMULATE_INPUTS_CACHE_TTL_MS,
  simulateInputsStorageKey,
} from "./simulate-real-card-price-cache";

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
  });
  return store;
}

describe("simulate-real-card-price-cache", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("guarda y recupera en clave global única", () => {
    mockLocalStorage();
    saveSimulateInputsCache({
      n: "938",
      purchaseUsd: "738",
      shippingCop: "376204",
    });
    const loaded = loadSimulateInputsCache();
    expect(loaded).toEqual({
      n: "938",
      purchaseUsd: "738",
      shippingCop: "376204",
    });
    expect(simulateInputsStorageKey()).toContain("v2");
  });

  it("expira después del TTL", () => {
    mockLocalStorage();
    const key = simulateInputsStorageKey();
    localStorage.setItem(
      key,
      JSON.stringify({
        v: 2,
        n: "10",
        purchaseUsd: "100",
        shippingCop: "50000",
        savedAt: Date.now() - SIMULATE_INPUTS_CACHE_TTL_MS - 1000,
      }),
    );
    expect(loadSimulateInputsCache()).toBeNull();
    expect(localStorage.getItem(key)).toBeNull();
  });
});
