const FALLBACK = "/cardtrader-receipt";

/**
 * Accept only safe relative app paths (no open redirect).
 * Rejects protocol-relative (`//…`), absolute URLs, and empty values.
 */
export function sanitizeReturnPath(
  raw: string | null | undefined,
  fallback: string = FALLBACK,
): string {
  if (raw == null) return fallback;
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return fallback;
  }
  const path = decoded.trim();
  if (!path.startsWith("/") || path.startsWith("//")) return fallback;
  if (/^[a-z][a-z0-9+.-]*:/i.test(path)) return fallback;
  return path;
}
