import { apiUrl } from "../config/api";

const LOCALHOST_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

function stockPhotoPathname(url: string): string | null {
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

export function isStockPhotoUrl(url: string): boolean {
  const pathname = stockPhotoPathname(url);
  return pathname != null && pathname.toLowerCase().startsWith("/stock-photos/");
}

/** Reescribe `/stock-photos/...` contra la base del API. */
export function rewriteStockPhotoUrl(
  url: string,
  apiUrlFn: (path: string) => string = apiUrl,
): string {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;

  const pathname = stockPhotoPathname(trimmed);
  if (!pathname || !pathname.toLowerCase().startsWith("/stock-photos/")) {
    return trimmed;
  }
  return apiUrlFn(pathname);
}

export async function fetchInventoryPhotoDataUrl(
  imageUrl: string | null | undefined,
): Promise<string | null> {
  const trimmed = imageUrl?.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("data:")) return trimmed;
  try {
    const res = await fetch(trimmed, { credentials: "include" });
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!blob.size) return null;
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve(typeof reader.result === "string" ? reader.result : null);
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}
