const LOCALHOST_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

function cardImagesPathname(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      if (!LOCALHOST_HOSTS.has(parsed.hostname.toLowerCase())) return null;
      return parsed.pathname;
    } catch {
      return null;
    }
  }
  if (trimmed.startsWith("/")) {
    return trimmed.split("?")[0] ?? "";
  }
  return null;
}

/** Caché local `/card-images` (relativa o localhost). Puede 404 si el archivo ya se podó. */
export function isLocalCardImagesUrl(url: string): boolean {
  const pathname = cardImagesPathname(url);
  return pathname != null && pathname.toLowerCase().startsWith("/card-images/");
}

/**
 * Reescribe `/card-images/...` y `http://localhost[:port]/card-images/...`
 * (también 127.0.0.1) contra la base del API. Otras URLs se dejan igual.
 */
export function rewriteCardImagesUrl(
  url: string,
  apiUrlFn: (path: string) => string,
): string {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;

  const pathname = cardImagesPathname(trimmed);
  if (!pathname || !pathname.toLowerCase().startsWith("/card-images/")) {
    return trimmed;
  }
  return apiUrlFn(pathname);
}
