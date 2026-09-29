import type { OwnerKey } from "../../config/owners";
import type {
  MetricsAnalyticsResponse,
  MetricsDeadStockItem,
  MetricsInventoryLossItem,
  MetricsProfitRow,
  MetricsTopSellerRow,
} from "./types";

const TOP_CAP = 20;
const LOSS_CAP = 50;
const DEAD_CAP = 80;
const KIND_CAP = 10;

function roundCop(n: number): number {
  return Math.round(n);
}

function roundPct(n: number): number {
  return Math.round(n * 100) / 100;
}

function weightedAvg(
  a: number | null,
  aWeight: number,
  b: number | null,
  bWeight: number,
): number | null {
  const parts: Array<{ v: number; w: number }> = [];
  if (a != null && aWeight > 0) parts.push({ v: a, w: aWeight });
  if (b != null && bWeight > 0) parts.push({ v: b, w: bWeight });
  if (parts.length === 0) return null;
  const sumW = parts.reduce((s, p) => s + p.w, 0);
  if (sumW <= 0) return null;
  return roundPct(parts.reduce((s, p) => s + p.v * p.w, 0) / sumW);
}

function tagOwner<T extends object>(
  items: T[],
  owner: OwnerKey,
): Array<T & { owner: OwnerKey }> {
  return items.map((item) => ({ ...item, owner }));
}

function mergeTopSellers(
  a: MetricsTopSellerRow[],
  b: MetricsTopSellerRow[],
  ownerA: OwnerKey,
  ownerB: OwnerKey,
  sortBy: "units" | "revenue",
): MetricsTopSellerRow[] {
  const merged = [
    ...tagOwner(a, ownerA),
    ...tagOwner(b, ownerB),
  ];
  merged.sort((x, y) =>
    sortBy === "units"
      ? y.units - x.units || y.revenue_cop - x.revenue_cop
      : y.revenue_cop - x.revenue_cop || y.units - x.units,
  );
  return merged.slice(0, TOP_CAP);
}

function mergeProfitRows(
  a: MetricsProfitRow[],
  b: MetricsProfitRow[],
  ownerA: OwnerKey,
  ownerB: OwnerKey,
  direction: "desc" | "asc",
): MetricsProfitRow[] {
  const merged = [
    ...tagOwner(a, ownerA),
    ...tagOwner(b, ownerB),
  ];
  merged.sort((x, y) =>
    direction === "desc"
      ? y.profit_cop - x.profit_cop
      : x.profit_cop - y.profit_cop,
  );
  return merged.slice(0, TOP_CAP);
}

type VelocityRow = MetricsAnalyticsResponse["velocity_by_product_kind"][number];

function mergeVelocity(a: VelocityRow[], b: VelocityRow[]): VelocityRow[] {
  const map = new Map<string, VelocityRow>();
  for (const row of [...a, ...b]) {
    const prev = map.get(row.product_kind);
    if (!prev) {
      map.set(row.product_kind, { ...row });
      continue;
    }
    const samples = prev.samples + row.samples;
    map.set(row.product_kind, {
      product_kind: row.product_kind,
      samples,
      avg_days_to_sell: weightedAvg(
        prev.avg_days_to_sell,
        prev.samples,
        row.avg_days_to_sell,
        row.samples,
      ),
      median_days_to_sell: weightedAvg(
        prev.median_days_to_sell,
        prev.samples,
        row.median_days_to_sell,
        row.samples,
      ),
      approximate: prev.approximate || row.approximate,
    });
  }
  return [...map.values()];
}

function rankKinds(rows: VelocityRow[], direction: "asc" | "desc"): VelocityRow[] {
  const withAvg = rows.filter((v) => v.samples >= 1 && v.avg_days_to_sell != null);
  return [...withAvg]
    .sort((x, y) =>
      direction === "asc"
        ? (x.avg_days_to_sell ?? Infinity) - (y.avg_days_to_sell ?? Infinity)
        : (y.avg_days_to_sell ?? -Infinity) - (x.avg_days_to_sell ?? -Infinity),
    )
    .slice(0, KIND_CAP);
}

function mergeByDay(
  a: MetricsAnalyticsResponse["sales_by_day"],
  b: MetricsAnalyticsResponse["sales_by_day"],
): MetricsAnalyticsResponse["sales_by_day"] {
  const map = new Map<
    string,
    { date: string; units: number; revenue_cop: number; profit_cop: number }
  >();
  for (const row of [...a, ...b]) {
    const prev = map.get(row.date);
    if (!prev) {
      map.set(row.date, { ...row });
      continue;
    }
    prev.units += row.units;
    prev.revenue_cop = roundCop(prev.revenue_cop + row.revenue_cop);
    prev.profit_cop = roundCop(prev.profit_cop + row.profit_cop);
  }
  return [...map.values()].sort((x, y) => x.date.localeCompare(y.date));
}

function mergeByCycle(
  a: MetricsAnalyticsResponse["sales_by_cycle"],
  b: MetricsAnalyticsResponse["sales_by_cycle"],
): MetricsAnalyticsResponse["sales_by_cycle"] {
  const map = new Map<string, MetricsAnalyticsResponse["sales_by_cycle"][number]>();
  for (const row of [...a, ...b]) {
    const prev = map.get(row.cycle_key);
    if (!prev) {
      map.set(row.cycle_key, { ...row });
      continue;
    }
    map.set(row.cycle_key, {
      cycle_key: row.cycle_key,
      cycle_closed_at: prev.cycle_closed_at ?? row.cycle_closed_at,
      units: prev.units + row.units,
      revenue_cop: roundCop(prev.revenue_cop + row.revenue_cop),
      profit_cop: roundCop(prev.profit_cop + row.profit_cop),
    });
  }
  return [...map.values()].sort((x, y) => {
    if (x.cycle_key === "active") return -1;
    if (y.cycle_key === "active") return 1;
    return (y.cycle_closed_at ?? "").localeCompare(x.cycle_closed_at ?? "");
  });
}

function mergeByTag(
  a: MetricsAnalyticsResponse["sales_by_tag"],
  b: MetricsAnalyticsResponse["sales_by_tag"],
): MetricsAnalyticsResponse["sales_by_tag"] {
  const map = new Map<string, MetricsAnalyticsResponse["sales_by_tag"][number]>();
  for (const row of [...a, ...b]) {
    const prev = map.get(row.tag);
    if (!prev) {
      map.set(row.tag, { ...row });
      continue;
    }
    map.set(row.tag, {
      tag: row.tag,
      label: prev.label || row.label,
      units: prev.units + row.units,
      revenue_cop: roundCop(prev.revenue_cop + row.revenue_cop),
      profit_cop: roundCop(prev.profit_cop + row.profit_cop),
      avg_days_to_sell: weightedAvg(
        prev.avg_days_to_sell,
        prev.units,
        row.avg_days_to_sell,
        row.units,
      ),
      approximate: prev.approximate || row.approximate,
    });
  }
  // Preserve order from first response when possible, then append extras.
  const order = [...a.map((t) => t.tag), ...b.map((t) => t.tag)];
  const seen = new Set<string>();
  const ordered: MetricsAnalyticsResponse["sales_by_tag"] = [];
  for (const tag of order) {
    if (seen.has(tag)) continue;
    seen.add(tag);
    const row = map.get(tag);
    if (row) ordered.push(row);
  }
  return ordered;
}

function mergeLosses(
  a: MetricsAnalyticsResponse["inventory_losses"],
  b: MetricsAnalyticsResponse["inventory_losses"],
  ownerA: OwnerKey,
  ownerB: OwnerKey,
): MetricsAnalyticsResponse["inventory_losses"] {
  const items: MetricsInventoryLossItem[] = [
    ...tagOwner(a.items, ownerA),
    ...tagOwner(b.items, ownerB),
  ];
  items.sort(
    (x, y) =>
      (y.lost_at ?? "").localeCompare(x.lost_at ?? "") ||
      y.stock_id.localeCompare(x.stock_id),
  );
  return {
    lines_count: a.lines_count + b.lines_count,
    cost_cop: roundCop(a.cost_cop + b.cost_cop),
    items: items.slice(0, LOSS_CAP),
  };
}

function priorityRank(p: MetricsDeadStockItem["priority"]): number {
  if (p === "alta") return 0;
  if (p === "media") return 1;
  return 2;
}

function mergeDeadStock(
  a: MetricsAnalyticsResponse["dead_stock"],
  b: MetricsAnalyticsResponse["dead_stock"],
  ownerA: OwnerKey,
  ownerB: OwnerKey,
): MetricsAnalyticsResponse["dead_stock"] {
  const items: MetricsDeadStockItem[] = [
    ...tagOwner(a.items, ownerA),
    ...tagOwner(b.items, ownerB),
  ];
  items.sort((x, y) => {
    const da = x.days_in_stock ?? -1;
    const db = y.days_in_stock ?? -1;
    if (db !== da) return db - da;
    const pr = priorityRank(x.priority) - priorityRank(y.priority);
    if (pr !== 0) return pr;
    return y.cost_cop - x.cost_cop;
  });
  return {
    lines_count: a.lines_count + b.lines_count,
    cards_count: (a.cards_count ?? a.items.length) + (b.cards_count ?? b.items.length),
    cost_cop: roundCop(a.cost_cop + b.cost_cop),
    items: items.slice(0, DEAD_CAP),
  };
}

/** Recover sellable stock units from sell-through % when possible. */
export function recoverSellableUnits(
  unitsSold: number,
  sellThroughPct: number | null,
): number | null {
  if (sellThroughPct == null) return null;
  if (sellThroughPct >= 100) return 0;
  if (sellThroughPct <= 0) return null;
  return (unitsSold * (100 - sellThroughPct)) / sellThroughPct;
}

/** Recover inventory cost from turnover KPI when possible. */
export function recoverInventoryCost(
  costCop: number,
  turnover: number | null,
): number | null {
  if (turnover == null || turnover === 0) return null;
  return costCop / turnover;
}

function mergeKpis(
  a: MetricsAnalyticsResponse,
  b: MetricsAnalyticsResponse,
  unitsSold: number,
  costCop: number,
  grossProfit: number,
): MetricsAnalyticsResponse["kpis"] {
  const sellableA = recoverSellableUnits(
    a.summary.units_sold,
    a.kpis.sell_through_pct,
  );
  const sellableB = recoverSellableUnits(
    b.summary.units_sold,
    b.kpis.sell_through_pct,
  );

  let sell_through_pct: number | null = null;
  if (sellableA != null || sellableB != null) {
    const sellable =
      (sellableA ?? 0) + (sellableB ?? 0);
    // If one side had 0% with units=0, sellable unknown — still approximate.
    const denom = unitsSold + sellable;
    sell_through_pct =
      denom === 0 ? null : roundPct((unitsSold / denom) * 100);
  } else if (
    a.kpis.sell_through_pct === 0 &&
    b.kpis.sell_through_pct === 0
  ) {
    sell_through_pct = 0;
  } else if (
    a.kpis.sell_through_pct == null &&
    b.kpis.sell_through_pct == null
  ) {
    sell_through_pct = null;
  } else {
    // Fallback: one side null/unrecoverable — prefer known non-null when only one exists.
    const known = [a.kpis.sell_through_pct, b.kpis.sell_through_pct].filter(
      (v): v is number => v != null,
    );
    sell_through_pct = known.length === 1 ? known[0]! : null;
  }

  const invA = recoverInventoryCost(
    a.summary.cost_cop,
    a.kpis.inventory_turnover_approximate,
  );
  const invB = recoverInventoryCost(
    b.summary.cost_cop,
    b.kpis.inventory_turnover_approximate,
  );
  const inventoryCost =
    invA != null || invB != null ? (invA ?? 0) + (invB ?? 0) : null;

  const inventory_turnover_approximate =
    inventoryCost == null || inventoryCost === 0
      ? null
      : roundPct(costCop / inventoryCost);
  const gmroi_approximate =
    inventoryCost == null || inventoryCost === 0
      ? null
      : roundPct(grossProfit / inventoryCost);

  return {
    sell_through_pct,
    sell_through_approximate: true,
    inventory_turnover_approximate,
    gmroi_approximate,
  };
}

/**
 * Merge two per-owner metrics payloads into one Pokémon-combined view.
 * Card/item rows keep their `owner`; same card_id from different owners stay separate.
 */
export function mergeMetricsAnalytics(
  a: MetricsAnalyticsResponse,
  b: MetricsAnalyticsResponse,
  ownerA: OwnerKey,
  ownerB: OwnerKey,
): MetricsAnalyticsResponse {
  const units_sold = a.summary.units_sold + b.summary.units_sold;
  const revenue_cop = roundCop(a.summary.revenue_cop + b.summary.revenue_cop);
  const cost_cop = roundCop(a.summary.cost_cop + b.summary.cost_cop);
  const gross_profit_cop = roundCop(revenue_cop - cost_cop);
  const tickets_count = a.summary.tickets_count + b.summary.tickets_count;
  const gross_margin_pct =
    revenue_cop === 0 ? null : roundPct((gross_profit_cop / revenue_cop) * 100);
  const aov_cop =
    tickets_count === 0 ? null : roundCop(revenue_cop / tickets_count);

  const timingA = a.summary.timing_data_quality;
  const timingB = b.summary.timing_data_quality;
  const timing_data_quality =
    timingA || timingB
      ? {
          with_sale_created_at:
            (timingA?.with_sale_created_at ?? 0) +
            (timingB?.with_sale_created_at ?? 0),
          reception_from_snapshot:
            (timingA?.reception_from_snapshot ?? 0) +
            (timingB?.reception_from_snapshot ?? 0),
          reception_from_stocked_at:
            (timingA?.reception_from_stocked_at ?? 0) +
            (timingB?.reception_from_stocked_at ?? 0),
          reception_from_objectid:
            (timingA?.reception_from_objectid ?? 0) +
            (timingB?.reception_from_objectid ?? 0),
          reception_missing:
            (timingA?.reception_missing ?? 0) +
            (timingB?.reception_missing ?? 0),
          tags_from_snapshot:
            (timingA?.tags_from_snapshot ?? 0) +
            (timingB?.tags_from_snapshot ?? 0),
          tags_from_card_map:
            (timingA?.tags_from_card_map ?? 0) +
            (timingB?.tags_from_card_map ?? 0),
        }
      : undefined;

  const velocity_by_product_kind = mergeVelocity(
    a.velocity_by_product_kind,
    b.velocity_by_product_kind,
  );

  const generatedAt =
    a.generated_at >= b.generated_at ? a.generated_at : b.generated_at;

  return {
    generated_at: generatedAt,
    period: a.period,
    summary: {
      units_sold,
      revenue_cop,
      cost_cop,
      gross_profit_cop,
      gross_margin_pct,
      aov_cop,
      tickets_count,
      cost_data_quality: {
        with_snapshot:
          a.summary.cost_data_quality.with_snapshot +
          b.summary.cost_data_quality.with_snapshot,
        with_fallback:
          a.summary.cost_data_quality.with_fallback +
          b.summary.cost_data_quality.with_fallback,
      },
      timing_data_quality,
    },
    top_sellers_by_units: mergeTopSellers(
      a.top_sellers_by_units,
      b.top_sellers_by_units,
      ownerA,
      ownerB,
      "units",
    ),
    top_sellers_by_revenue: mergeTopSellers(
      a.top_sellers_by_revenue,
      b.top_sellers_by_revenue,
      ownerA,
      ownerB,
      "revenue",
    ),
    top_profit: mergeProfitRows(
      a.top_profit,
      b.top_profit,
      ownerA,
      ownerB,
      "desc",
    ),
    top_loss_sales: mergeProfitRows(
      a.top_loss_sales,
      b.top_loss_sales,
      ownerA,
      ownerB,
      "asc",
    ),
    velocity_by_product_kind,
    fastest_kinds: rankKinds(velocity_by_product_kind, "asc"),
    slowest_kinds: rankKinds(velocity_by_product_kind, "desc"),
    sales_by_day: mergeByDay(a.sales_by_day, b.sales_by_day),
    sales_by_cycle: mergeByCycle(a.sales_by_cycle, b.sales_by_cycle),
    sales_by_tag: mergeByTag(a.sales_by_tag ?? [], b.sales_by_tag ?? []),
    inventory_losses: mergeLosses(
      a.inventory_losses,
      b.inventory_losses,
      ownerA,
      ownerB,
    ),
    dead_stock: mergeDeadStock(a.dead_stock, b.dead_stock, ownerA, ownerB),
    kpis: mergeKpis(a, b, units_sold, cost_cop, gross_profit_cop),
  };
}
