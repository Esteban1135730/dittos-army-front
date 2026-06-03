export type DashboardOverviewResponse = {
  generated_at: string;
  highlights: {
    capital_engaged_cop: number;
    pending_revenue_cop: number;
    inventory_margin_potential_cop: number;
    combined_estimated_profit_cop: number;
  };
  stock: {
    total_lines: number;
    by_state: Record<string, number>;
    sellable_lines: number;
    inventory_cost_cop: number;
    inventory_pvp_cop: number;
  };
  sales: {
    active_count: number;
    active_amount_cop: number;
    active_estimated_profit_cop: number;
    closed_last_30_days_count: number;
    closed_last_30_days_amount_cop: number;
    consistency_issue_count: number;
  };
  clients_reservations: {
    clients_count: number;
    reservas_stock_count: number;
    ventas_esperadas_cop: number;
    ganancia_estimada_cop: number;
    reservas_incoming_units: number;
    reservas_incoming_client_count: number;
  };
  incoming: {
    open_batches_count: number;
    units_in_transit: number;
    estimated_cost_cop: number;
  };
  charts: {
    sales_by_month: Array<{ month: string; count: number; amount_cop: number }>;
    stock_by_state: Array<{ state: string; count: number }>;
    money_flow: Array<{ key: string; label: string; value_cop: number }>;
  };
};
