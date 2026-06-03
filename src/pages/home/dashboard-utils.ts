import { formatCOP } from "../../utils/convert";
import type { DashboardOverviewResponse } from "./dashboard-types";

export { formatCOP };

export const STATE_LABELS: Record<string, string> = {
  disponible: "Disponible",
  reserva: "Reserva",
  vendida: "Vendida",
  propiedad: "Propiedad",
  en_stock_colombia: "En stock Colombia",
  sin_estado: "Sin estado",
};

export const STATE_COLORS: Record<string, string> = {
  disponible: "#16a34a",
  reserva: "#2563eb",
  vendida: "#64748b",
  propiedad: "#9333ea",
  en_stock_colombia: "#d97706",
  sin_estado: "#94a3b8",
};

export const MONEY_FLOW_COLORS: Record<string, string> = {
  inventory: "#6366f1",
  transit: "#0ea5e9",
  active_sales: "#22c55e",
  reservations: "#f59e0b",
};

export function stateLabel(state: string): string {
  return STATE_LABELS[state] ?? state.replace(/_/g, " ");
}

export function stateColor(state: string): string {
  return STATE_COLORS[state] ?? "#64748b";
}

export function formatCOPShort(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  if (abs >= 1_000) {
    return `$${Math.round(value / 1_000)}k`;
  }
  return formatCOP(value);
}

export function formatChartMonth(yyyyMm: string): string {
  const [year, month] = yyyyMm.split("-").map(Number);
  const d = new Date(year, month - 1, 1);
  return d.toLocaleDateString("es-CO", { month: "short", year: "2-digit" });
}

export function profitTone(
  value: number,
): "success" | "error" | "default" {
  if (value > 0) return "success";
  if (value < 0) return "error";
  return "default";
}

const SALES_CHART_MONTHS = 6;

type LegacySalesDayRow = { date: string; count: number; amount_cop: number };

function buildLastNMonthKeys(n: number): string[] {
  const keys: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    keys.push(`${y}-${m}`);
  }
  return keys;
}

function emptySalesByMonth(): Array<{ month: string; count: number; amount_cop: number }> {
  return buildLastNMonthKeys(SALES_CHART_MONTHS).map((month) => ({
    month,
    count: 0,
    amount_cop: 0,
  }));
}

function salesByMonthFromLegacyDays(
  rows: LegacySalesDayRow[],
): Array<{ month: string; count: number; amount_cop: number }> {
  const bucket = new Map<string, { count: number; amount_cop: number }>();
  for (const key of buildLastNMonthKeys(SALES_CHART_MONTHS)) {
    bucket.set(key, { count: 0, amount_cop: 0 });
  }
  for (const row of rows) {
    const month = row.date.slice(0, 7);
    const cell = bucket.get(month);
    if (!cell) continue;
    cell.count += row.count ?? 0;
    cell.amount_cop += row.amount_cop ?? 0;
  }
  return buildLastNMonthKeys(SALES_CHART_MONTHS).map((month) => {
    const cell = bucket.get(month)!;
    return { month, count: cell.count, amount_cop: cell.amount_cop };
  });
}

function stockByStateFromRecord(
  byState: Record<string, number> | undefined,
): Array<{ state: string; count: number }> {
  if (!byState) return [];
  return Object.entries(byState)
    .filter(([, count]) => count > 0)
    .map(([state, count]) => ({ state, count }))
    .sort((a, b) => b.count - a.count);
}

/** Normaliza respuestas parciales, caché antigua o API sin reiniciar. */
export function normalizeDashboardOverview(raw: unknown): DashboardOverviewResponse {
  const r = (raw ?? {}) as Partial<DashboardOverviewResponse> & {
    charts?: Partial<DashboardOverviewResponse["charts"]> & {
      sales_by_day?: LegacySalesDayRow[];
    };
  };

  const stock = r.stock ?? {
    total_lines: 0,
    by_state: {},
    sellable_lines: 0,
    inventory_cost_cop: 0,
    inventory_pvp_cop: 0,
  };
  const sales = r.sales ?? {
    active_count: 0,
    active_amount_cop: 0,
    active_estimated_profit_cop: 0,
    closed_last_30_days_count: 0,
    closed_last_30_days_amount_cop: 0,
    consistency_issue_count: 0,
  };
  const clients = r.clients_reservations ?? {
    clients_count: 0,
    reservas_stock_count: 0,
    ventas_esperadas_cop: 0,
    ganancia_estimada_cop: 0,
    reservas_incoming_units: 0,
    reservas_incoming_client_count: 0,
  };
  const incoming = r.incoming ?? {
    open_batches_count: 0,
    units_in_transit: 0,
    estimated_cost_cop: 0,
  };

  let sales_by_month = r.charts?.sales_by_month ?? [];
  if (!sales_by_month.length && r.charts?.sales_by_day?.length) {
    sales_by_month = salesByMonthFromLegacyDays(r.charts.sales_by_day);
  }
  if (!sales_by_month.length) {
    sales_by_month = emptySalesByMonth();
  }

  const stock_by_state =
    r.charts?.stock_by_state?.length
      ? r.charts.stock_by_state
      : stockByStateFromRecord(stock.by_state);

  const money_flow = r.charts?.money_flow ?? [];

  const highlights = r.highlights ?? {
    capital_engaged_cop: stock.inventory_cost_cop + incoming.estimated_cost_cop,
    pending_revenue_cop: sales.active_amount_cop + clients.ventas_esperadas_cop,
    inventory_margin_potential_cop: Math.max(
      0,
      stock.inventory_pvp_cop - stock.inventory_cost_cop,
    ),
    combined_estimated_profit_cop:
      sales.active_estimated_profit_cop + clients.ganancia_estimada_cop,
  };

  return {
    generated_at: r.generated_at ?? new Date().toISOString(),
    highlights,
    stock,
    sales,
    clients_reservations: clients,
    incoming,
    charts: {
      sales_by_month,
      stock_by_state,
      money_flow,
    },
  };
}
