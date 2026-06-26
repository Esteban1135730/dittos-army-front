import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { useMemo } from "react";
import { apiBase, apiUrl } from "../config/api";
import type { Ct0BoxItem } from "./cardtrader-ct0-box";
import {
  buildBlueprintImageUrlMapFromExport,
  normalizeCtExpansions,
  resolveCtExpansionId,
} from "./cardtrader-blueprint-image";
import { getPedidoBlueprintImageDisplaySrc } from "./cardtrader-pedido-blueprint-image-cache";
import type { Ct0BatchDraft } from "./ct0-incoming-batch-draft";

const API_CARDTRADER = apiUrl("/cardtrader");

export function collectBlueprintIdsFromDrafts(drafts: Ct0BatchDraft[]): number[] {
  const ids = new Set<number>();
  for (const draft of drafts) {
    for (const line of draft.lines) {
      if (line.blueprintId) ids.add(line.blueprintId);
    }
  }
  return [...ids];
}

export function useCt0DraftBlueprintImages(
  drafts: Ct0BatchDraft[],
  ct0Items: Ct0BoxItem[],
): { images: Record<number, string>; isLoading: boolean } {
  const blueprintIds = useMemo(() => collectBlueprintIdsFromDrafts(drafts), [drafts]);

  const expansionsQuery = useQuery({
    queryKey: ["cardtrader", "expansions", "pokemon", "draft-images"],
    queryFn: async () => {
      const res = await axios.get(`${API_CARDTRADER}/expansions`, { params: { game_id: 5 } });
      return res.data;
    },
    staleTime: 60 * 60 * 1000,
  });

  const blueprintImagesQuery = useQuery<Record<number, string>>({
    queryKey: ["ct0-draft-bp-images", blueprintIds.join(",")],
    enabled: expansionsQuery.isSuccess && blueprintIds.length > 0,
    staleTime: 30 * 60 * 1000,
    queryFn: async () => {
      const expansions = normalizeCtExpansions(expansionsQuery.data);
      const expansionNames = new Set<string>();

      for (const draft of drafts) {
        for (const line of draft.lines) {
          if (line.blueprintId && blueprintIds.includes(line.blueprintId) && line.expansion) {
            expansionNames.add(line.expansion);
          }
        }
      }
      for (const item of ct0Items) {
        if (blueprintIds.includes(item.blueprint_id) && item.expansion) {
          expansionNames.add(item.expansion);
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
            /* skip */
          }
        }),
      );

      const out: Record<number, string> = {};
      for (const bpId of blueprintIds) {
        const src = getPedidoBlueprintImageDisplaySrc(
          bpId,
          imageUrlByBlueprint.get(bpId),
          apiBase(),
        );
        if (src) out[bpId] = src;
      }
      return out;
    },
  });

  return {
    images: blueprintImagesQuery.data ?? {},
    isLoading: blueprintImagesQuery.isFetching && blueprintIds.length > 0,
  };
}
