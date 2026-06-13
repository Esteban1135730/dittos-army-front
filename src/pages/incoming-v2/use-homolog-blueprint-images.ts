import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { apiBase, apiUrl } from '../../config/api';
import {
  buildBlueprintImageUrlMapFromExport,
  normalizeCtExpansions,
  resolveCtExpansionId,
} from '../../utils/cardtrader-blueprint-image';
import { getPedidoBlueprintImageDisplaySrc } from '../../utils/cardtrader-pedido-blueprint-image-cache';

const API_CARDTRADER = apiUrl('/cardtrader');

export type HomologImageUnit = {
  blueprint_id: number;
  expansion: string;
};

export function useHomologBlueprintImages(units: HomologImageUnit[]) {
  const blueprintIds = useMemo(() => {
    const ids = new Set<number>();
    for (const u of units) {
      if (u.blueprint_id > 0) ids.add(u.blueprint_id);
    }
    return [...ids];
  }, [units]);

  const expansionsQuery = useQuery({
    queryKey: ['cardtrader', 'expansions', 'pokemon', 'homolog-v2'],
    queryFn: async () => {
      const res = await axios.get(`${API_CARDTRADER}/expansions`, {
        params: { game_id: 5 },
      });
      return res.data;
    },
    staleTime: 60 * 60 * 1000,
  });

  const blueprintImagesQuery = useQuery<Record<number, string>>({
    queryKey: ['incoming-v2-bp-images', blueprintIds.join(',')],
    enabled: expansionsQuery.isSuccess && blueprintIds.length > 0,
    staleTime: 30 * 60 * 1000,
    queryFn: async () => {
      const expansions = normalizeCtExpansions(expansionsQuery.data);
      const expansionNames = new Set<string>();
      for (const u of units) {
        if (u.blueprint_id > 0 && u.expansion?.trim()) {
          expansionNames.add(u.expansion.trim());
        }
      }

      const expansionIds = [
        ...new Set(
          [...expansionNames]
            .map((name) => resolveCtExpansionId(expansions, name))
            .filter((id): id is number => id != null),
        ),
      ];

      const imageUrlByBlueprint = new Map<number, string>();
      await Promise.all(
        expansionIds.map(async (expansionId) => {
          try {
            const res = await axios.get(`${API_CARDTRADER}/blueprints`, {
              params: { expansion_id: expansionId },
            });
            for (const [bpId, url] of buildBlueprintImageUrlMapFromExport(res.data)) {
              imageUrlByBlueprint.set(bpId, url);
            }
          } catch {
            /* skip expansion */
          }
        }),
      );

      const missing = blueprintIds.filter((id) => !imageUrlByBlueprint.has(id));
      await Promise.all(
        missing.map(async (bpId) => {
          try {
            const res = await axios.get(`${API_CARDTRADER}/blueprints/item/${bpId}`);
            const url = buildBlueprintImageUrlMapFromExport([res.data]).get(bpId);
            if (url) imageUrlByBlueprint.set(bpId, url);
          } catch {
            /* skip */
          }
        }),
      );

      const base = apiBase();
      const out: Record<number, string> = {};
      for (const bpId of blueprintIds) {
        const src = getPedidoBlueprintImageDisplaySrc(
          bpId,
          imageUrlByBlueprint.get(bpId),
          base,
        );
        if (src) out[bpId] = src;
      }
      return out;
    },
  });

  return {
    blueprintImages: blueprintImagesQuery.data ?? {},
    imagesLoading: blueprintImagesQuery.isFetching,
  };
}

export function resolveBlueprintImageSrc(
  blueprintId: number | undefined | null,
  blueprintImages: Record<number, string>,
): string | undefined {
  if (!blueprintId || blueprintId <= 0) return undefined;
  return blueprintImages[blueprintId];
}

export function resolvePanelImageSrc(imageUrl: string | undefined | null): string | undefined {
  const url = imageUrl?.trim();
  return url || undefined;
}
