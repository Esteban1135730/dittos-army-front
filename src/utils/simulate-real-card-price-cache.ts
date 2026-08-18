/** Campos del modal de simulación en localStorage — una sola entrada global por navegador. */

export const SIMULATE_INPUTS_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const STORAGE_PREFIX = "dittos-army.incoming-simulate-inputs";
/** v2: clave única global (antes v1 era por batch). */
const VERSION = 2 as const;

export type SimulateInputsCachePayload = {
  v: typeof VERSION;
  n: string;
  purchaseUsd: string;
  shippingCop: string;
  savedAt: number;
};

export function simulateInputsStorageKey(): string {
  return `${STORAGE_PREFIX}.v${VERSION}`;
}

function getLocalStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function loadSimulateInputsCache(): {
  n: string;
  purchaseUsd: string;
  shippingCop: string;
} | null {
  const ls = getLocalStorage();
  if (!ls) return null;
  try {
    const raw = ls.getItem(simulateInputsStorageKey());
    if (!raw) return null;
    const data = JSON.parse(raw) as SimulateInputsCachePayload;
    if (data.v !== VERSION || typeof data.savedAt !== "number") return null;
    if (Date.now() - data.savedAt > SIMULATE_INPUTS_CACHE_TTL_MS) {
      ls.removeItem(simulateInputsStorageKey());
      return null;
    }
    return {
      n: String(data.n ?? ""),
      purchaseUsd: String(data.purchaseUsd ?? ""),
      shippingCop: String(data.shippingCop ?? ""),
    };
  } catch {
    return null;
  }
}

export function saveSimulateInputsCache(fields: {
  n: string;
  purchaseUsd: string;
  shippingCop: string;
}): void {
  const ls = getLocalStorage();
  if (!ls) return;
  try {
    const payload: SimulateInputsCachePayload = {
      v: VERSION,
      n: fields.n,
      purchaseUsd: fields.purchaseUsd,
      shippingCop: fields.shippingCop,
      savedAt: Date.now(),
    };
    ls.setItem(simulateInputsStorageKey(), JSON.stringify(payload));
  } catch {
    // Quota u otro error: no bloquear UI
  }
}
