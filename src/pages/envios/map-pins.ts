import type { PedidoCalendarioItem } from "./types";
import type { GeocodePoint } from "./geocode-nominatim";
import { geocodeCacheKey } from "./geocode-nominatim";
import {
  buildEnvioGeocodeQuery,
  isEnvioGeocodeCandidate,
} from "./envio-geocode-query";

export type EnviosMapPin = {
  id: string;
  kind: "tienda" | "domicilio";
  lat: number;
  lng: number;
  label: string;
  items: PedidoCalendarioItem[];
};

export function envioQueryKey(item: PedidoCalendarioItem): string {
  return geocodeCacheKey(buildEnvioGeocodeQuery(item));
}

export function groupTiendaPins(items: PedidoCalendarioItem[]): EnviosMapPin[] {
  const byStore = new Map<string, EnviosMapPin>();
  for (const item of items) {
    if (item.mapa.kind !== "tienda") continue;
    const existing = byStore.get(item.mapa.store_id);
    if (existing) {
      existing.items.push(item);
      continue;
    }
    byStore.set(item.mapa.store_id, {
      id: `tienda:${item.mapa.store_id}`,
      kind: "tienda",
      lat: item.mapa.lat,
      lng: item.mapa.lng,
      label: item.store_name?.trim() || item.mapa.store_id,
      items: [item],
    });
  }
  return [...byStore.values()];
}

function domicilioLabel(item: PedidoCalendarioItem): string {
  return (
    [item.direccion_o_punto, item.notas_entrega, item.ciudad]
      .map((s) => s?.trim())
      .filter(Boolean)
      .join(" · ") || "Domicilio"
  );
}

export function groupDomicilioPins(
  items: PedidoCalendarioItem[],
  coordsByAddress: Record<string, GeocodePoint | null>,
): EnviosMapPin[] {
  const byPoint = new Map<string, EnviosMapPin>();
  for (const item of items) {
    if (!isEnvioGeocodeCandidate(item)) continue;
    const key = envioQueryKey(item);
    const coords = coordsByAddress[key];
    if (!coords) continue;
    const id = `domicilio:${coords.lat.toFixed(5)},${coords.lng.toFixed(5)}`;
    const existing = byPoint.get(id);
    if (existing) {
      existing.items.push(item);
      continue;
    }
    byPoint.set(id, {
      id,
      kind: "domicilio",
      lat: coords.lat,
      lng: coords.lng,
      label: domicilioLabel(item),
      items: [item],
    });
  }
  return [...byPoint.values()];
}

export function unlocatedDomicilioIds(
  items: PedidoCalendarioItem[],
  coordsByAddress: Record<string, GeocodePoint | null>,
): Set<string> {
  const ids = new Set<string>();
  for (const item of items) {
    if (!isEnvioGeocodeCandidate(item)) continue;
    const key = envioQueryKey(item);
    if (!key) continue;
    if (key in coordsByAddress && coordsByAddress[key] == null) {
      ids.add(item.id);
    }
  }
  return ids;
}
