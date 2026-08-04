import { useEffect, useRef, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useOwner } from "./owner-context";

/**
 * Redirects to `/` when current route is denied by owner ACL.
 * Sets a one-shot session flag for a snackbar on Home (optional).
 */
export function OwnerRouteGuard({ children }: { children: ReactNode }) {
  const { isPathAllowed, owner } = useOwner();
  const location = useLocation();
  const warned = useRef(false);

  const allowed = isPathAllowed(location.pathname);

  useEffect(() => {
    if (!allowed && !warned.current) {
      warned.current = true;
      try {
        sessionStorage.setItem(
          "dittos.panel.aclRedirect",
          `Ruta no disponible para ${owner}.`,
        );
      } catch {
        /* ignore */
      }
    }
    if (allowed) warned.current = false;
  }, [allowed, owner]);

  if (!allowed) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
