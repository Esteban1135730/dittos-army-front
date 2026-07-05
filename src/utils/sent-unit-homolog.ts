import type { CardsCostCurrency } from './purchase-currency';
import { fxUnitPriceFromSentUnit, normalizeCardsCostCurrency } from './purchase-currency';
import type { ExpansionHomologIndex } from './transit-card-match';
import {
  buildExternalTransitProfile,
  buildPanelTransitProfile,
  scoreTransitCardMatch,
} from './transit-card-match';
import { normalizeCardNameForMatch } from './incoming-ct0-package-match';
import type { OrderTransitLine } from './order-transit-packages';

const NAME_STOPWORDS = new Set([
  'ex',
  'δ',
  'delta',
  'species',
  'de',
  'la',
  'el',
  'the',
  'a',
]);

export type PanelHomologItem = {
  transit_line_id: string;
  transit_lot_id: string;
  card_id: string;
  card_name: string;
  image_url: string;
  language: string;
  rareza: string | null;
  remaining_quantity: number;
  quantity_ordered: number;
  fx_unit_price: number;
  fx_total_lot: number;
  unit_cost_cop: number;
  cards_cost_currency?: CardsCostCurrency | string;
  lot_purchase_date: string | null;
  lot_total_fx_cards_cost: number | null;
  lot_total_cop_cards_cost: number | null;
  real_fx_rate_cop: number | null;
  assigned_in_session: number;
  available_in_session: number;
};

export type SentHomologUnit = {
  sent_unit_key: string;
  line_key: string;
  unit_index: number;
  order_id: number;
  order_code: string;
  name: string;
  expansion: string;
  language: string;
  blueprint_id: number;
  unit_price_eur: number | null;
  unit_price_fx: number | null;
  price_currency?: string | null;
  paid_at: string | null;
  rareza: string | null;
  status: 'pending' | 'verified' | 'novedad';
  batch_item_id: string | null;
  batch_id: string | null;
  batch_item_card_id: string | null;
  batch_item_card_name: string | null;
  transit_line_id: string | null;
  transit_lot_id: string | null;
  transit_line_card_id: string | null;
  transit_line_card_name: string | null;
  unit_cost_cop: number | null;
  purchase_price_eur: number | null;
  purchase_price_fx: number | null;
  purchase_price_currency: string | null;
  match_score: number | null;
  novedad_notes: string;
  verified_at?: string | null;
};

export type PanelMatchCandidate = {
  transitLineId: string;
  transitLotId: string;
  cardId: string;
  cardName: string;
  imageUrl: string;
  language: string;
  rareza: string | null;
  fxUnitPrice: number;
  fxTotalLot: number;
  cardsCostCurrency: CardsCostCurrency;
  unitCostCop: number;
  quantityOrdered: number;
  remainingQuantity: number;
  availableInSession: number;
  lotPurchaseDate: string | null;
  lotTotalFxCardsCost: number | null;
  lotTotalCopCardsCost: number | null;
  realFxRateCop: number | null;
  projectedUnitCostCop: number | null;
  structuralScore: number;
  wordScore: number;
  matchTier: 'best' | 'possible';
  matchedWords: string[];
};

export function expandSentOnlyUnits(lines: OrderTransitLine[]): Array<
  OrderTransitLine & { sent_unit_key: string; unit_index: number }
> {
  const units: Array<OrderTransitLine & { sent_unit_key: string; unit_index: number }> =
    [];
  for (const line of lines) {
    if (String(line.orderState).toLowerCase() !== 'sent') continue;
    const qty = Math.max(1, line.qty);
    for (let unitIndex = 0; unitIndex < qty; unitIndex++) {
      units.push({
        ...line,
        sent_unit_key: `${line.lineKey}#${unitIndex}`,
        unit_index: unitIndex,
        qty: 1,
      });
    }
  }
  return units;
}

export function tokenizeCardName(name: string): string[] {
  const normalized = normalizeCardNameForMatch(name);
  return normalized
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !NAME_STOPWORDS.has(t));
}

export function scoreWordOverlap(aName: string, bName: string): {
  score: number;
  matchedWords: string[];
} {
  const tokensA = tokenizeCardName(aName);
  const tokensB = new Set(tokenizeCardName(bName));
  if (tokensA.length === 0 || tokensB.size === 0) {
    return { score: 0, matchedWords: [] };
  }
  const matched = tokensA.filter((t) => tokensB.has(t));
  const score = matched.length / Math.max(tokensA.length, tokensB.size);
  return { score, matchedWords: matched };
}

export const FALLBACK_UNIT_COST_COP = 1;

export type SystemTrmRates = {
  euroToCop: number | null;
  usdToCop: number | null;
};

export function copFromSystemTrm(
  fxAmount: number | null | undefined,
  currency: CardsCostCurrency,
  rates: SystemTrmRates,
): number | null {
  if (fxAmount == null || !Number.isFinite(fxAmount) || fxAmount <= 0) {
    return null;
  }
  const copPerUnit =
    currency === 'USD' ? rates.usdToCop : rates.euroToCop;
  if (copPerUnit == null || !Number.isFinite(copPerUnit) || copPerUnit <= 0) {
    return null;
  }
  return fxAmount * copPerUnit;
}

export function resolveNovedadUnitCostCop(
  unit: Pick<
    SentHomologUnit,
    | 'status'
    | 'unit_cost_cop'
    | 'unit_price_fx'
    | 'unit_price_eur'
    | 'purchase_price_fx'
    | 'purchase_price_eur'
    | 'price_currency'
    | 'purchase_price_currency'
  >,
  systemTrm: SystemTrmRates,
): number | null {
  if (unit.unit_cost_cop != null && unit.unit_cost_cop > 0) {
    return unit.unit_cost_cop;
  }
  if (unit.status !== 'novedad') return null;
  const ctFx = fxUnitPriceFromSentUnit(unit);
  return copFromSystemTrm(ctFx.amount, ctFx.currency, systemTrm);
}

export function computeUnitCostCop(
  purchasePriceFx: number,
  copPerFxUnit: number | null,
  fallbackUnitCostCop: number,
): number {
  if (
    Number.isFinite(purchasePriceFx) &&
    purchasePriceFx > 0 &&
    copPerFxUnit != null &&
    copPerFxUnit > 0
  ) {
    return purchasePriceFx * copPerFxUnit;
  }
  return fallbackUnitCostCop;
}

export function rankPanelCandidates(args: {
  sentUnit: Pick<
    SentHomologUnit,
    | 'name'
    | 'expansion'
    | 'language'
    | 'unit_price_eur'
    | 'unit_price_fx'
    | 'price_currency'
    | 'rareza'
  >;
  panelItems: PanelHomologItem[];
  expansionHomolog: ExpansionHomologIndex;
}): PanelMatchCandidate[] {
  const sentCurrency = normalizeCardsCostCurrency(args.sentUnit.price_currency);
  const sentFx = fxUnitPriceFromSentUnit(args.sentUnit).amount;

  const external = buildExternalTransitProfile({
    name: args.sentUnit.name,
    language: args.sentUnit.language,
    expansion: args.sentUnit.expansion,
    rareza: args.sentUnit.rareza,
    unitPriceEur: sentCurrency === 'EUR' ? sentFx : null,
    unitPrice: sentFx ?? 0,
    priceCurrency: sentCurrency,
    expansionHomolog: args.expansionHomolog,
  });

  const ranked: PanelMatchCandidate[] = [];

  for (const item of args.panelItems) {
    if (item.available_in_session <= 0) continue;

    const panel = buildPanelTransitProfile({
      card_id: item.card_id,
      card_name: item.card_name,
      language: item.language,
      rareza: item.rareza,
      eur_unit_price: item.fx_unit_price,
    });

    const structuralScore = scoreTransitCardMatch(panel, external);
    const { score: wordScore, matchedWords } = scoreWordOverlap(
      args.sentUnit.name,
      item.card_name,
    );

    const hasStructural = Number.isFinite(structuralScore);
    const hasWord = wordScore > 0 && matchedWords.length > 0;
    if (!hasStructural && !hasWord) continue;

    ranked.push({
      transitLineId: item.transit_line_id,
      transitLotId: item.transit_lot_id,
      cardId: item.card_id,
      cardName: item.card_name,
      imageUrl: item.image_url,
      language: item.language,
      rareza: item.rareza,
      fxUnitPrice: item.fx_unit_price,
      fxTotalLot: item.fx_total_lot,
      cardsCostCurrency: normalizeCardsCostCurrency(item.cards_cost_currency),
      unitCostCop: item.unit_cost_cop,
      quantityOrdered: item.quantity_ordered,
      remainingQuantity: item.remaining_quantity,
      availableInSession: item.available_in_session,
      lotPurchaseDate: item.lot_purchase_date,
      lotTotalFxCardsCost: item.lot_total_fx_cards_cost,
      lotTotalCopCardsCost: item.lot_total_cop_cards_cost,
      realFxRateCop: item.real_fx_rate_cop,
      projectedUnitCostCop:
        sentFx != null &&
        sentFx > 0 &&
        sentCurrency === normalizeCardsCostCurrency(item.cards_cost_currency)
          ? computeUnitCostCop(
              sentFx,
              item.real_fx_rate_cop,
              item.unit_cost_cop,
            )
          : item.unit_cost_cop,
      structuralScore: hasStructural ? structuralScore : Number.POSITIVE_INFINITY,
      wordScore,
      matchTier:
        hasStructural && structuralScore < Number.POSITIVE_INFINITY
          ? 'best'
          : 'possible',
      matchedWords,
    });
  }

  ranked.sort((a, b) => {
    if (a.matchTier !== b.matchTier) {
      return a.matchTier === 'best' ? -1 : 1;
    }
    if (a.structuralScore !== b.structuralScore) {
      return a.structuralScore - b.structuralScore;
    }
    if (b.wordScore !== a.wordScore) return b.wordScore - a.wordScore;
    return a.cardName.localeCompare(b.cardName, 'es');
  });

  return ranked;
}

export function buildCreateTandaCardsPayload(
  units: SentHomologUnit[],
  panelItems: PanelHomologItem[],
  systemTrm: SystemTrmRates = { euroToCop: null, usdToCop: null },
): Array<{
  sent_unit_key: string;
  transit_line_id: string;
  purchase_price_eur: number;
  unit_cost_cop: number;
  is_novedad: boolean;
  novedad_notes: string;
}> {
  const panelMap = new Map(panelItems.map((p) => [p.transit_line_id, p]));

  return units.map((u) => {
    const lineId = u.transit_line_id ?? u.batch_item_id;
    const panel = lineId ? panelMap.get(lineId) : undefined;
    const panelCurrency = normalizeCardsCostCurrency(panel?.cards_cost_currency);
    const ctFx = fxUnitPriceFromSentUnit(u);
    let purchaseFx = ctFx.amount;
    if (purchaseFx == null && ctFx.currency === panelCurrency) {
      purchaseFx = panel?.fx_unit_price ?? null;
    }
    if (purchaseFx == null || purchaseFx <= 0) {
      purchaseFx = 0.01;
    }

    const unitCostCop =
      u.unit_cost_cop != null && u.unit_cost_cop > 0
        ? u.unit_cost_cop
        : u.status === 'novedad'
          ? (resolveNovedadUnitCostCop(u, systemTrm) ?? FALLBACK_UNIT_COST_COP)
          : computeUnitCostCop(
              purchaseFx,
              panel?.real_fx_rate_cop ?? null,
              panel?.unit_cost_cop ?? 0,
            );

    const finalUnitCostCop =
      Number.isFinite(unitCostCop) && unitCostCop > 0
        ? unitCostCop
        : FALLBACK_UNIT_COST_COP;

    return {
      sent_unit_key: u.sent_unit_key,
      transit_line_id: lineId ?? '',
      purchase_price_eur: purchaseFx,
      unit_cost_cop: finalUnitCostCop,
      is_novedad: u.status === 'novedad',
      novedad_notes: u.novedad_notes ?? '',
    };
  });
}
