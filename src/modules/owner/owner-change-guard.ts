import { useEffect } from "react";
import type { OwnerKey } from "../../config/owners";

type Guard = (next: OwnerKey) => boolean;

const guards = new Set<Guard>();

export function runOwnerChangeGuards(next: OwnerKey): boolean {
  for (const g of guards) {
    if (!g(next)) return false;
  }
  return true;
}

/** Register a guard that can abort owner switch (return false). */
export function useOwnerChangeGuard(guard: Guard) {
  useEffect(() => {
    guards.add(guard);
    return () => {
      guards.delete(guard);
    };
  }, [guard]);
}
