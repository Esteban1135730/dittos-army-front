const LOCALHOST_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

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

  let pathname = "";
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      const host = parsed.hostname.toLowerCase();
      if (!LOCALHOST_HOSTS.has(host)) return trimmed;
      pathname = parsed.pathname;
    } catch {
      return trimmed;
    }
  } else if (trimmed.startsWith("/")) {
    pathname = trimmed.split("?")[0] ?? "";
  } else {
    return trimmed;
  }

  if (!pathname.toLowerCase().startsWith("/card-images/")) return trimmed;
  return apiUrlFn(pathname);
}
