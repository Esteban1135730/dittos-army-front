import { useCallback, useEffect, useMemo, useState } from 'react';

const STORAGE_PREFIX = 'dittos-army.ct-receipt-arrived.v1';
/** Tope defensivo ante localStorage envenenado o sesiones enormes. */
const MAX_ARRIVED_KEYS = 5_000;
const MAX_KEY_LENGTH = 256;

function storageKey(sessionId: string): string {
  return `${STORAGE_PREFIX}:${sessionId}`;
}

function getLocalStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function loadArrivedKeys(sessionId: string | undefined): Set<string> {
  if (!sessionId) return new Set();
  const ls = getLocalStorage();
  if (!ls) return new Set();
  try {
    const raw = ls.getItem(storageKey(sessionId));
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    const keys = parsed.filter(
      (key): key is string =>
        typeof key === 'string' &&
        key.length > 0 &&
        key.length <= MAX_KEY_LENGTH,
    );
    return new Set(keys.slice(0, MAX_ARRIVED_KEYS));
  } catch {
    return new Set();
  }
}

function saveArrivedKeys(sessionId: string, keys: Set<string>): void {
  const ls = getLocalStorage();
  if (!ls) return;
  try {
    ls.setItem(storageKey(sessionId), JSON.stringify([...keys]));
  } catch {
    /* quota / private mode */
  }
}

export type ArrivalTracking = {
  arrivedKeys: Set<string>;
  arrivedCount: number;
  isArrived: (key: string) => boolean;
  toggleArrived: (key: string) => void;
  markArrived: (key: string) => void;
  markMany: (keys: readonly string[]) => void;
  clearArrived: () => void;
};

/**
 * Persiste checkboxes de llegada física por sesión de recepción CT.
 * Independiente de homologación / verify.
 */
export function useArrivalTracking(sessionId: string | undefined): ArrivalTracking {
  const [arrivedKeys, setArrivedKeys] = useState<Set<string>>(() =>
    loadArrivedKeys(sessionId),
  );

  useEffect(() => {
    setArrivedKeys(loadArrivedKeys(sessionId));
  }, [sessionId]);

  const persist = useCallback(
    (next: Set<string>) => {
      setArrivedKeys(next);
      if (sessionId) saveArrivedKeys(sessionId, next);
    },
    [sessionId],
  );

  const isArrived = useCallback(
    (key: string) => arrivedKeys.has(key),
    [arrivedKeys],
  );

  const toggleArrived = useCallback(
    (key: string) => {
      if (!key || key.length > MAX_KEY_LENGTH) return;
      const next = new Set(arrivedKeys);
      if (next.has(key)) next.delete(key);
      else if (next.size < MAX_ARRIVED_KEYS) next.add(key);
      else return;
      persist(next);
    },
    [arrivedKeys, persist],
  );

  const markArrived = useCallback(
    (key: string) => {
      if (!key || key.length > MAX_KEY_LENGTH) return;
      if (arrivedKeys.has(key)) return;
      if (arrivedKeys.size >= MAX_ARRIVED_KEYS) return;
      const next = new Set(arrivedKeys);
      next.add(key);
      persist(next);
    },
    [arrivedKeys, persist],
  );

  const markMany = useCallback(
    (keys: readonly string[]) => {
      if (keys.length === 0) return;
      const next = new Set(arrivedKeys);
      let changed = false;
      for (const key of keys) {
        if (
          !key ||
          key.length > MAX_KEY_LENGTH ||
          next.has(key) ||
          next.size >= MAX_ARRIVED_KEYS
        ) {
          continue;
        }
        next.add(key);
        changed = true;
      }
      if (changed) persist(next);
    },
    [arrivedKeys, persist],
  );

  const clearArrived = useCallback(() => {
    persist(new Set());
  }, [persist]);

  return useMemo(
    () => ({
      arrivedKeys,
      arrivedCount: arrivedKeys.size,
      isArrived,
      toggleArrived,
      markArrived,
      markMany,
      clearArrived,
    }),
    [
      arrivedKeys,
      isArrived,
      toggleArrived,
      markArrived,
      markMany,
      clearArrived,
    ],
  );
}
