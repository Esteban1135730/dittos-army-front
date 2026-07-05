import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { useMemo } from "react";
import { apiUrl } from "../config/api";
import type { Ct0BatchDraft } from "./ct0-incoming-batch-draft";

const API_TCG_FIND = apiUrl("/tcg-dex/card/find");

function tcgDexLocaleForLineLanguage(language: string): string {
  const lang = String(language ?? "")
    .trim()
    .toLowerCase();
  if (!lang || lang === "—" || lang === "en") return "en";
  if (lang === "ja" || lang === "jp" || lang === "jpn") return "ja";
  if (lang === "ko" || lang === "kr") return "ko";
  if (lang.startsWith("zh")) return "zh-cn";
  return "en";
}

export type Ct0TcgdexImageEntry = {
  cardId: string;
  locale: string;
};

export function collectTcgdexImageEntries(
  drafts: Ct0BatchDraft[],
): Ct0TcgdexImageEntry[] {
  const byId = new Map<string, Ct0TcgdexImageEntry>();
  for (const draft of drafts) {
    for (const line of draft.lines) {
      const cardId = line.tcgdexCardId?.trim();
      if (!cardId || byId.has(cardId)) continue;
      byId.set(cardId, {
        cardId,
        locale: tcgDexLocaleForLineLanguage(line.language),
      });
    }
  }
  return [...byId.values()];
}

export function useCt0DraftTcgdexImages(drafts: Ct0BatchDraft[]): {
  images: Record<string, string>;
  missingImageIds: Set<string>;
  isLoading: boolean;
} {
  const entries = useMemo(() => collectTcgdexImageEntries(drafts), [drafts]);

  const query = useQuery({
    queryKey: [
      "ct0-draft-tcgdex-images",
      entries.map((e) => `${e.locale}:${e.cardId}`).join(","),
    ],
    enabled: entries.length > 0,
    staleTime: 30 * 60 * 1000,
    queryFn: async () => {
      const images: Record<string, string> = {};
      const missing = new Set<string>();

      await Promise.all(
        entries.map(async ({ cardId, locale }) => {
          try {
            const res = await axios.get(
              `${API_TCG_FIND}/${encodeURIComponent(cardId)}`,
              { params: { locale } },
            );
            const img =
              (typeof res.data?.image === "string" && res.data.image.trim()) ||
              (typeof res.data?.images?.small === "string" &&
                res.data.images.small.trim()) ||
              "";
            if (img) {
              images[cardId] = img;
            } else {
              missing.add(cardId);
            }
          } catch {
            missing.add(cardId);
          }
        }),
      );

      return { images, missing: [...missing] };
    },
  });

  return {
    images: query.data?.images ?? {},
    missingImageIds: new Set(query.data?.missing ?? []),
    isLoading: query.isFetching && entries.length > 0,
  };
}
