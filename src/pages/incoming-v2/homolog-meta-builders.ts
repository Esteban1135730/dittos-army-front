import type { PanelHomologItem, PanelMatchCandidate, SentHomologUnit } from '../../utils/sent-unit-homolog';
import { fxUnitPriceFromSentUnit } from '../../utils/purchase-currency';
import type { TransitLotSummaryRow } from './use-incoming-homolog';
import type { MetaLine } from './homolog-meta-panel';
import {
  formatCop,
  formatCopRateFx,
  formatFx,
  formatHomologDate,
  formatHomologDateTime,
} from './homolog-format';
import { normalizeCardsCostCurrency } from '../../utils/purchase-currency';

export function buildSentUnitMetaLines(unit: SentHomologUnit): MetaLine[] {
  const { amount: fxAmount, currency } = fxUnitPriceFromSentUnit(unit);
  const lines: MetaLine[] = [
    { label: 'Pedido', value: unit.order_code },
    { label: 'Pagado', value: formatHomologDateTime(unit.paid_at) },
    { label: 'Expansión', value: unit.expansion || '—' },
    { label: 'Idioma / rareza', value: [unit.language, unit.rareza].filter(Boolean).join(' · ') || '—' },
  ];
  if (unit.status === 'verified' || unit.status === 'novedad') {
    lines.unshift(
      {
        label: 'Precio compra (COP)',
        value: formatCop(unit.unit_cost_cop),
        highlight: true,
      },
      {
        label: `Precio real (${currency})`,
        value: formatFx(fxAmount, currency),
      },
    );
  } else {
    lines.unshift({
      label: `Precio CardTrader (${currency})`,
      value: formatFx(fxAmount, currency),
    });
  }
  return lines;
}

export function buildVerifiedMatchMetaLines(
  unit: SentHomologUnit,
  panel?: PanelHomologItem,
): MetaLine[] {
  const { amount: fxAmount, currency } = fxUnitPriceFromSentUnit(unit);
  const panelCurrency = normalizeCardsCostCurrency(panel?.cards_cost_currency);
  const lines: MetaLine[] = [
    {
      label: 'Precio compra (COP)',
      value: formatCop(unit.unit_cost_cop),
      highlight: true,
    },
    {
      label: `Precio real pagado (${currency})`,
      value: formatFx(fxAmount, currency),
    },
  ];
  if (panel) {
    lines.push(
      { label: 'Lote compra', value: formatHomologDate(panel.lot_purchase_date) },
      {
        label: 'Tasa del lote',
        value: formatCopRateFx(panel.real_fx_rate_cop, panelCurrency),
      },
      {
        label: 'Tu registro',
        value: `${formatCop(panel.unit_cost_cop)} · ${formatFx(panel.fx_unit_price, panelCurrency)}/ud · ${formatFx(panel.fx_total_lot, panelCurrency)} lote`,
      },
      { label: 'Card ID', value: panel.card_id },
    );
  }
  if (unit.verified_at) {
    lines.push({ label: 'Verificado', value: formatHomologDateTime(unit.verified_at) });
  }
  return lines;
}

export function buildCandidateMetaLines(candidate: PanelMatchCandidate): MetaLine[] {
  const currency = candidate.cardsCostCurrency;
  return [
    {
      label: 'COP / unidad',
      value: formatCop(candidate.unitCostCop),
      highlight: true,
    },
    { label: `${currency} / unidad`, value: formatFx(candidate.fxUnitPrice, currency) },
    { label: `${currency} lote (línea)`, value: formatFx(candidate.fxTotalLot, currency) },
    { label: 'Lote compra', value: formatHomologDate(candidate.lotPurchaseDate) },
    {
      label: 'Disponible',
      value: `${candidate.availableInSession} de ${candidate.remainingQuantity}`,
    },
    { label: 'Card ID', value: candidate.cardId },
  ];
}

export function buildBatchSummaryMeta(batch: TransitLotSummaryRow): MetaLine[] {
  const currency = normalizeCardsCostCurrency(batch.cards_cost_currency);
  return [
    { label: 'Fecha compra', value: formatHomologDate(batch.purchase_date), highlight: true },
    { label: 'Total cartas (COP)', value: formatCop(batch.total_cop_cards_cost), highlight: true },
    { label: `Total cartas (${currency})`, value: formatFx(batch.total_fx_cards_cost, currency) },
    { label: 'Tasa', value: formatCopRateFx(batch.real_fx_rate_cop, currency) },
    { label: 'Restante', value: `${batch.remaining_total_quantity} uds · ${batch.open_items_count} líneas` },
  ];
}
