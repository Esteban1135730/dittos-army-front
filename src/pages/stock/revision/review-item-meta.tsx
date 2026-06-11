import { operationalRarezaLabel } from "../../../constants/item-rareza";

type ReviewItemMetaProps = {
  language?: string | null;
  rareza?: string | null;
  cardState?: string;
  extra?: string;
};

export function formatReviewItemMeta({
  language,
  rareza,
  cardState,
  extra,
}: ReviewItemMetaProps): string {
  const parts: string[] = [];
  const lang = language?.trim();
  if (lang) parts.push(lang.toUpperCase());
  if (rareza != null && String(rareza).trim() !== "") {
    parts.push(operationalRarezaLabel(String(rareza).trim()));
  }
  if (cardState?.trim()) parts.push(cardState.trim());
  if (extra?.trim()) parts.push(extra.trim());
  return parts.join(" · ");
}

export function ReviewItemMeta({
  language,
  rareza,
  cardState,
  extra,
}: ReviewItemMetaProps) {
  const line = formatReviewItemMeta({ language, rareza, cardState, extra });
  if (!line) return null;
  return <p className="text-xs text-gray-500">{line}</p>;
}
