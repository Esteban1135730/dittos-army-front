import type { OwnerKey } from "../../config/owners";

export type MetricsCardOwner = OwnerKey;

export type MetricsTopSellerRow = {
  card_id: string;
  card_name: string | null;
  image_url: string | null;
  units: number;
  revenue_cop: number;
  /** Present when the view merges multiple owners (Pokémon). */
  owner?: MetricsCardOwner;
};

export type MetricsProfitRow = {
  card_id: string;
  card_name: string | null;
  image_url: string | null;
  units: number;
  revenue_cop: number;
  cost_cop: number;
  profit_cop: number;
  owner?: MetricsCardOwner;
};

export type MetricsInventoryLossItem = {
  stock_id: string;
  card_id: string;
  card_name: string | null;
  cost_cop: number;
  lost_at: string | null;
  owner?: MetricsCardOwner;
};

export type MetricsDeadStockItem = {
  stock_id: string;
  card_id: string;
  card_name: string | null;
  image_url?: string | null;
  stock_lines?: number;
  cost_cop: number;
  stocked_at: string | null;
  days_in_stock: number | null;
  priority?: "alta" | "media" | "baja";
  reasons?: string[];
  reason_codes?: string[];
  pvp_cop?: number | null;
  potential_margin_cop?: number | null;
  potential_margin_pct?: number | null;
  sales_in_period?: number;
  is_vintage?: boolean;
  /** Mediana de días hasta venta del mismo card_id en el periodo (si hay datos). */
  type_median_days_to_sell?: number | null;
  type_remaining_units?: number;
  type_sell_through_pct?: number | null;
  type_stuck_pct?: number | null;
  owner?: MetricsCardOwner;
};

export type MetricsAnalyticsResponse = {
  generated_at: string;
  period: { from: string; to: string };
  summary: {
    units_sold: number;
    revenue_cop: number;
    cost_cop: number;
    gross_profit_cop: number;
    gross_margin_pct: number | null;
    aov_cop: number | null;
    tickets_count: number;
    cost_data_quality: {
      with_snapshot: number;
      with_fallback: number;
    };
    timing_data_quality?: {
      with_sale_created_at: number;
      reception_from_snapshot: number;
      reception_from_stocked_at: number;
      reception_from_objectid: number;
      reception_missing: number;
      tags_from_snapshot: number;
      tags_from_card_map: number;
    };
  };
  top_sellers_by_units: MetricsTopSellerRow[];
  top_sellers_by_revenue: MetricsTopSellerRow[];
  top_profit: MetricsProfitRow[];
  top_loss_sales: MetricsProfitRow[];
  velocity_by_product_kind: Array<{
    product_kind: string;
    samples: number;
    avg_days_to_sell: number | null;
    median_days_to_sell: number | null;
    approximate: boolean;
  }>;
  fastest_kinds: Array<{
    product_kind: string;
    samples: number;
    avg_days_to_sell: number | null;
    median_days_to_sell: number | null;
    approximate: boolean;
  }>;
  slowest_kinds: Array<{
    product_kind: string;
    samples: number;
    avg_days_to_sell: number | null;
    median_days_to_sell: number | null;
    approximate: boolean;
  }>;
  sales_by_day: Array<{
    date: string;
    units: number;
    revenue_cop: number;
    profit_cop: number;
  }>;
  sales_by_cycle: Array<{
    cycle_key: string;
    cycle_closed_at: string | null;
    units: number;
    revenue_cop: number;
    profit_cop: number;
  }>;
  sales_by_tag: Array<{
    tag: string;
    label: string;
    units: number;
    revenue_cop: number;
    profit_cop: number;
    avg_days_to_sell: number | null;
    approximate: boolean;
  }>;
  inventory_losses: {
    lines_count: number;
    cost_cop: number;
    items: MetricsInventoryLossItem[];
  };
  dead_stock: {
    lines_count: number;
    cards_count?: number;
    cost_cop: number;
    items: MetricsDeadStockItem[];
  };
  kpis: {
    sell_through_pct: number | null;
    sell_through_approximate: boolean;
    inventory_turnover_approximate: number | null;
    gmroi_approximate: number | null;
  };
};
