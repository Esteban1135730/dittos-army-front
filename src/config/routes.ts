import { TCG_KEYS, type TcgKey } from "./owners";

/**
 * UI path prefix for the Pokémon surface of the panel.
 * BrowserRouter basename; legacy URLs without a TCG prefix redirect here.
 */
export const PANEL_UI_PREFIX = "/pokemon";

/** BrowserRouter basename de cada superficie TCG del panel. */
export const TCG_UI_PREFIX: Record<TcgKey, string> = {
  pokemon: PANEL_UI_PREFIX,
  yugioh: "/yugioh",
  magic: "/magic",
  onepiece: "/onepiece",
};

/** TCG de la superficie según la URL, o null si no hay prefijo TCG. */
export function tcgForPath(pathname: string): TcgKey | null {
  for (const tcg of TCG_KEYS) {
    const prefix = TCG_UI_PREFIX[tcg];
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return tcg;
  }
  return null;
}

/** Basename del panel según la URL, o null si hay que redirigir a Pokémon. */
export function panelBasenameForPath(pathname: string): string | null {
  const tcg = tcgForPath(pathname);
  return tcg ? TCG_UI_PREFIX[tcg] : null;
}

/** TCG de la superficie activa (Pokémon fuera del navegador o sin prefijo). */
export function currentPanelTcg(): TcgKey {
  if (typeof window === "undefined") return "pokemon";
  return tcgForPath(window.location.pathname) ?? "pokemon";
}

/**
 * If the location is outside any TCG prefix, replace to the Pokémon path.
 * @returns true when a redirect was triggered (caller should not mount the app).
 */
export function redirectLegacyPanelPath(): boolean {
  const { pathname, search, hash } = window.location;
  if (panelBasenameForPath(pathname)) {
    return false;
  }
  const dest =
    pathname === "/"
      ? `${PANEL_UI_PREFIX}${search}${hash}`
      : `${PANEL_UI_PREFIX}${pathname}${search}${hash}`;
  window.location.replace(dest);
  return true;
}

/** Absolute panel path (e.g. panelPath("/stock") → "/pokemon/stock"). */
export function panelPath(path = "/"): string {
  if (!path || path === "/") return PANEL_UI_PREFIX;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (
    normalized === PANEL_UI_PREFIX ||
    normalized.startsWith(`${PANEL_UI_PREFIX}/`)
  ) {
    return normalized;
  }
  return `${PANEL_UI_PREFIX}${normalized}`;
}
