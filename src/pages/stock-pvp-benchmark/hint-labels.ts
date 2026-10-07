import type { StockPvpBenchmarkHint } from "./stock-pvp-benchmark.types";

export const HINT_LABELS: Record<StockPvpBenchmarkHint, string> = {
  above_max_sale: "PVP por encima de la venta más alta",
  below_min_sale: "PVP por debajo de la venta más baja",
  pvp_higher_than_partner: "PVP más alto que el otro dueño",
  pvp_lower_than_partner: "PVP más bajo que el otro dueño",
  no_pvp: "Sin PVP catalogado",
  no_sales: "Sin ventas en el periodo",
  within_sale_range: "PVP dentro del rango vendido",
};

export const HINT_CHIP_COLOR: Record<
  StockPvpBenchmarkHint,
  "error" | "warning" | "info" | "success" | "default"
> = {
  above_max_sale: "error",
  below_min_sale: "warning",
  pvp_higher_than_partner: "info",
  pvp_lower_than_partner: "info",
  no_pvp: "default",
  no_sales: "default",
  within_sale_range: "success",
};
