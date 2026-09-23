/**
 * UI path prefix for the Pokémon surface of the panel.
 * BrowserRouter basename; legacy URLs without this prefix redirect here.
 */
export const PANEL_UI_PREFIX = "/pokemon";
export const YUGIOH_UI_PREFIX = "/yugioh";

/** Basename del panel según la URL, o null si hay que redirigir a Pokémon. */
export function panelBasenameForPath(pathname: string): string | null {
  if (pathname === YUGIOH_UI_PREFIX || pathname.startsWith(`${YUGIOH_UI_PREFIX}/`)) {
    return YUGIOH_UI_PREFIX;
  }
  if (pathname === PANEL_UI_PREFIX || pathname.startsWith(`${PANEL_UI_PREFIX}/`)) {
    return PANEL_UI_PREFIX;
  }
  return null;
}

/**
 * If the location is outside `/pokemon`, replace to the prefixed path.
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
