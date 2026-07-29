/** Alineado con `dittos-army-back` — catálogo cerrado. */
export const STOCK_TAG_VALUES = [
  "vintage",
  "bulk",
  "jugable",
  "brillo",
] as const;

export type StockTagId = (typeof STOCK_TAG_VALUES)[number];

export const STOCK_TAG_LABEL: Record<StockTagId, string> = {
  vintage: "Vintage",
  bulk: "Bulk",
  jugable: "Jugable",
  brillo: "Brillo",
};
