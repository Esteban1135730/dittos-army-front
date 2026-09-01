import axios from "axios";
import { apiUrl } from "../../config/api";

export type GeocodePoint = { lat: number; lng: number };

const cache = new Map<string, GeocodePoint | null>();
let queue: Promise<unknown> = Promise.resolve();

export function geocodeCacheKey(query: string): string {
  return query.trim().replace(/\s+/g, " ");
}

export function clearGeocodeCache(): void {
  cache.clear();
  queue = Promise.resolve();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.then(
    () => sleep(1000),
    () => sleep(1000),
  );
  return run;
}

/**
 * Busca la descripción del envío en el API (Google si hay clave, si no Nominatim).
 * Solo devuelve coords si la coincidencia es Bogotá. Máx. 1 req/s. Cache de sesión.
 */
export async function geocodeBogotaAddress(
  query: string,
): Promise<GeocodePoint | null> {
  const key = geocodeCacheKey(query);
  if (key.length < 3) return null;
  if (cache.has(key)) return cache.get(key) ?? null;

  const point = await enqueue(async () => {
    if (cache.has(key)) return cache.get(key) ?? null;
    try {
      const res = await axios.get(apiUrl("/pedido/geocode"), {
        params: { q: key },
      });
      const data = res.data as { ok?: boolean; lat?: number | null; lng?: number | null };
      if (!data?.ok) {
        cache.set(key, null);
        return null;
      }
      const lat = Number(data.lat);
      const lng = Number(data.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        cache.set(key, null);
        return null;
      }
      const found: GeocodePoint = { lat, lng };
      cache.set(key, found);
      return found;
    } catch {
      cache.set(key, null);
      return null;
    }
  });

  return point;
}
