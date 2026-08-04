import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  OWNERS_CONFIG,
  OWNER_STORAGE_KEY,
  getOwnerDefinition,
  isFeatureAllowed,
  parseStoredOwner,
  type FeatureKey,
  type OwnerKey,
} from "../../config/owners";
import { setApiOwnerHeader } from "../../config/api";
import { isRouteAllowed } from "./owner-acl";

type OwnerContextValue = {
  owner: OwnerKey;
  label: string;
  allowedFeatures: FeatureKey[];
  setOwner: (next: OwnerKey, opts?: { clearCartConfirm?: () => boolean }) => void;
  can: (feature: FeatureKey) => boolean;
  isPathAllowed: (pathname: string) => boolean;
};

const OwnerContext = createContext<OwnerContextValue | null>(null);

function readInitialOwner(): OwnerKey {
  try {
    return parseStoredOwner(localStorage.getItem(OWNER_STORAGE_KEY));
  } catch {
    return OWNERS_CONFIG.defaultOwner;
  }
}

export function OwnerProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [owner, setOwnerState] = useState<OwnerKey>(() => {
    const initial = readInitialOwner();
    setApiOwnerHeader(initial);
    return initial;
  });

  const setOwner = useCallback(
    (next: OwnerKey, opts?: { clearCartConfirm?: () => boolean }) => {
      if (next === owner) return;
      if (opts?.clearCartConfirm && !opts.clearCartConfirm()) return;

      setOwnerState(next);
      try {
        localStorage.setItem(OWNER_STORAGE_KEY, next);
      } catch {
        /* ignore */
      }
      setApiOwnerHeader(next);
      void queryClient.invalidateQueries();
    },
    [owner, queryClient],
  );

  const value = useMemo<OwnerContextValue>(() => {
    const def = getOwnerDefinition(owner);
    return {
      owner,
      label: def.label,
      allowedFeatures: def.allowedFeatures,
      setOwner,
      can: (feature) => isFeatureAllowed(owner, feature),
      isPathAllowed: (pathname) =>
        isRouteAllowed(pathname, def.allowedFeatures),
    };
  }, [owner, setOwner]);

  return (
    <OwnerContext.Provider value={value}>{children}</OwnerContext.Provider>
  );
}

export function useOwner(): OwnerContextValue {
  const ctx = useContext(OwnerContext);
  if (!ctx) {
    throw new Error("useOwner must be used within OwnerProvider");
  }
  return ctx;
}
