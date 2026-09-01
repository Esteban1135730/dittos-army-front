import { useEffect, useMemo, useState } from "react";
import type { PedidoCalendarioItem } from "./types";
import {
  geocodeBogotaAddress,
  type GeocodePoint,
} from "./geocode-nominatim";
import { envioQueryKey } from "./map-pins";
import { isEnvioGeocodeCandidate } from "./envio-geocode-query";

export function useDayGeocode(items: PedidoCalendarioItem[]) {
  const addresses = useMemo(() => {
    const keys = new Set<string>();
    for (const item of items) {
      if (!isEnvioGeocodeCandidate(item)) continue;
      const key = envioQueryKey(item);
      if (key.length >= 3) keys.add(key);
    }
    return [...keys].sort();
  }, [items]);

  const addressKey = addresses.join("|");
  const [coordsByAddress, setCoordsByAddress] = useState<
    Record<string, GeocodePoint | null>
  >({});

  useEffect(() => {
    let cancelled = false;
    const list = addressKey.length > 0 ? addressKey.split("|") : [];
    if (list.length === 0) {
      setCoordsByAddress({});
      return;
    }
    void (async () => {
      const next: Record<string, GeocodePoint | null> = {};
      for (const addr of list) {
        const point = await geocodeBogotaAddress(addr);
        if (cancelled) return;
        next[addr] = point;
        setCoordsByAddress({ ...next });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [addressKey]);

  return coordsByAddress;
}
