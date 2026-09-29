import { describe, expect, it } from "vitest";
import {
  mergeMetricsAnalytics,
  recoverInventoryCost,
  recoverSellableUnits,
} from "./merge-metrics";
import type { MetricsAnalyticsResponse } from "./types";

function emptyMetrics(
  overrides: Partial<MetricsAnalyticsResponse> = {},
): MetricsAnalyticsResponse {
  return {
    generated_at: "2026-09-01T12:00:00.000Z",
    period: { from: "2026-06-01", to: "2026-09-01" },
    summary: {
      units_sold: 0,
      revenue_cop: 0,
      cost_cop: 0,
      gross_profit_cop: 0,
      gross_margin_pct: null,
      aov_cop: null,
      tickets_count: 0,
      cost_data_quality: { with_snapshot: 0, with_fallback: 0 },
    },
    top_sellers_by_units: [],
    top_sellers_by_revenue: [],
    top_profit: [],
    top_loss_sales: [],
    velocity_by_product_kind: [],
    fastest_kinds: [],
    slowest_kinds: [],
    sales_by_day: [],
    sales_by_cycle: [],
    sales_by_tag: [],
    inventory_losses: { lines_count: 0, cost_cop: 0, items: [] },
    dead_stock: { lines_count: 0, cards_count: 0, cost_cop: 0, items: [] },
    kpis: {
      sell_through_pct: null,
      sell_through_approximate: true,
      inventory_turnover_approximate: null,
      gmroi_approximate: null,
    },
    ...overrides,
  };
}

describe("recoverSellableUnits", () => {
  it("recupera stock vendible desde sell-through", () => {
    // 50% = 10 / (10 + sellable) → sellable = 10
    expect(recoverSellableUnits(10, 50)).toBe(10);
  });

  it("devuelve 0 si sell-through es 100%", () => {
    expect(recoverSellableUnits(5, 100)).toBe(0);
  });

  it("no puede recuperar con 0%", () => {
    expect(recoverSellableUnits(0, 0)).toBeNull();
  });
});

describe("recoverInventoryCost", () => {
  it("recupera costo de inventario desde rotación", () => {
    // turnover 2 = cost 100 / inv → inv = 50
    expect(recoverInventoryCost(100, 2)).toBe(50);
  });
});

describe("mergeMetricsAnalytics", () => {
  it("suma summary y recalcula margen y AOV", () => {
    const a = emptyMetrics({
      summary: {
        units_sold: 2,
        revenue_cop: 10000,
        cost_cop: 4000,
        gross_profit_cop: 6000,
        gross_margin_pct: 60,
        aov_cop: 5000,
        tickets_count: 2,
        cost_data_quality: { with_snapshot: 2, with_fallback: 0 },
      },
    });
    const b = emptyMetrics({
      generated_at: "2026-09-01T13:00:00.000Z",
      summary: {
        units_sold: 3,
        revenue_cop: 15000,
        cost_cop: 6000,
        gross_profit_cop: 9000,
        gross_margin_pct: 60,
        aov_cop: 5000,
        tickets_count: 3,
        cost_data_quality: { with_snapshot: 1, with_fallback: 2 },
      },
    });

    const merged = mergeMetricsAnalytics(a, b, "pablo", "esteban");
    expect(merged.summary.units_sold).toBe(5);
    expect(merged.summary.revenue_cop).toBe(25000);
    expect(merged.summary.cost_cop).toBe(10000);
    expect(merged.summary.gross_profit_cop).toBe(15000);
    expect(merged.summary.tickets_count).toBe(5);
    expect(merged.summary.gross_margin_pct).toBe(60);
    expect(merged.summary.aov_cop).toBe(5000);
    expect(merged.summary.cost_data_quality).toEqual({
      with_snapshot: 3,
      with_fallback: 2,
    });
    expect(merged.generated_at).toBe("2026-09-01T13:00:00.000Z");
  });

  it("reordena tops y preserva owner en cada item", () => {
    const a = emptyMetrics({
      top_sellers_by_units: [
        {
          card_id: "pika",
          card_name: "Pikachu",
          image_url: null,
          units: 5,
          revenue_cop: 1000,
        },
      ],
      top_sellers_by_revenue: [
        {
          card_id: "pika",
          card_name: "Pikachu",
          image_url: null,
          units: 5,
          revenue_cop: 1000,
        },
      ],
      top_profit: [
        {
          card_id: "pika",
          card_name: "Pikachu",
          image_url: null,
          units: 5,
          revenue_cop: 1000,
          cost_cop: 200,
          profit_cop: 800,
        },
      ],
      top_loss_sales: [
        {
          card_id: "pika",
          card_name: "Pikachu",
          image_url: null,
          units: 1,
          revenue_cop: 100,
          cost_cop: 200,
          profit_cop: -100,
        },
      ],
    });
    const b = emptyMetrics({
      top_sellers_by_units: [
        {
          card_id: "char",
          card_name: "Charizard",
          image_url: null,
          units: 8,
          revenue_cop: 5000,
        },
        {
          card_id: "pika",
          card_name: "Pikachu",
          image_url: null,
          units: 2,
          revenue_cop: 400,
        },
      ],
      top_sellers_by_revenue: [
        {
          card_id: "char",
          card_name: "Charizard",
          image_url: null,
          units: 8,
          revenue_cop: 5000,
        },
      ],
      top_profit: [
        {
          card_id: "char",
          card_name: "Charizard",
          image_url: null,
          units: 8,
          revenue_cop: 5000,
          cost_cop: 1000,
          profit_cop: 4000,
        },
      ],
      top_loss_sales: [
        {
          card_id: "bulk",
          card_name: "Bulk",
          image_url: null,
          units: 1,
          revenue_cop: 50,
          cost_cop: 300,
          profit_cop: -250,
        },
      ],
    });

    const merged = mergeMetricsAnalytics(a, b, "pablo", "esteban");

    expect(merged.top_sellers_by_units[0]).toMatchObject({
      card_id: "char",
      units: 8,
      owner: "esteban",
    });
    expect(merged.top_sellers_by_units[1]).toMatchObject({
      card_id: "pika",
      units: 5,
      owner: "pablo",
    });
    // Same card_id from both owners stay as separate rows
    expect(
      merged.top_sellers_by_units.filter((r) => r.card_id === "pika"),
    ).toHaveLength(2);

    expect(merged.top_sellers_by_revenue[0].owner).toBe("esteban");
    expect(merged.top_profit[0]).toMatchObject({
      card_id: "char",
      profit_cop: 4000,
      owner: "esteban",
    });
    expect(merged.top_loss_sales[0]).toMatchObject({
      card_id: "bulk",
      profit_cop: -250,
      owner: "esteban",
    });
  });

  it("suma series por día y etiqueta owner en pérdidas / dead stock", () => {
    const a = emptyMetrics({
      sales_by_day: [
        { date: "2026-08-01", units: 1, revenue_cop: 100, profit_cop: 40 },
        { date: "2026-08-02", units: 2, revenue_cop: 200, profit_cop: 80 },
      ],
      inventory_losses: {
        lines_count: 1,
        cost_cop: 500,
        items: [
          {
            stock_id: "s1",
            card_id: "c1",
            card_name: "A",
            cost_cop: 500,
            lost_at: "2026-08-10T00:00:00.000Z",
          },
        ],
      },
      dead_stock: {
        lines_count: 2,
        cards_count: 1,
        cost_cop: 20000,
        items: [
          {
            stock_id: "d1",
            card_id: "dead1",
            card_name: "Dead Pablo",
            cost_cop: 20000,
            stocked_at: null,
            days_in_stock: 100,
            priority: "alta",
          },
        ],
      },
    });
    const b = emptyMetrics({
      sales_by_day: [
        { date: "2026-08-01", units: 3, revenue_cop: 300, profit_cop: 120 },
      ],
      inventory_losses: {
        lines_count: 1,
        cost_cop: 300,
        items: [
          {
            stock_id: "s2",
            card_id: "c2",
            card_name: "B",
            cost_cop: 300,
            lost_at: "2026-08-11T00:00:00.000Z",
          },
        ],
      },
      dead_stock: {
        lines_count: 1,
        cards_count: 1,
        cost_cop: 15000,
        items: [
          {
            stock_id: "d2",
            card_id: "dead2",
            card_name: "Dead Esteban",
            cost_cop: 15000,
            stocked_at: null,
            days_in_stock: 200,
            priority: "media",
          },
        ],
      },
    });

    const merged = mergeMetricsAnalytics(a, b, "pablo", "esteban");

    expect(merged.sales_by_day).toEqual([
      { date: "2026-08-01", units: 4, revenue_cop: 400, profit_cop: 160 },
      { date: "2026-08-02", units: 2, revenue_cop: 200, profit_cop: 80 },
    ]);
    expect(merged.inventory_losses.lines_count).toBe(2);
    expect(merged.inventory_losses.cost_cop).toBe(800);
    expect(merged.inventory_losses.items[0]).toMatchObject({
      stock_id: "s2",
      owner: "esteban",
    });
    expect(merged.inventory_losses.items[1]).toMatchObject({
      stock_id: "s1",
      owner: "pablo",
    });

    expect(merged.dead_stock.lines_count).toBe(3);
    expect(merged.dead_stock.cards_count).toBe(2);
    expect(merged.dead_stock.cost_cop).toBe(35000);
    // Re-ranked by days_in_stock desc
    expect(merged.dead_stock.items[0]).toMatchObject({
      card_id: "dead2",
      owner: "esteban",
      days_in_stock: 200,
    });
    expect(merged.dead_stock.items[1]).toMatchObject({
      card_id: "dead1",
      owner: "pablo",
    });
  });

  it("recalcula KPIs fusionando pools recuperados", () => {
    // A: 10 sold, 50% → sellable 10; cost 100, turnover 2 → inv 50; profit 60 → gmroi 1.2
    const a = emptyMetrics({
      summary: {
        units_sold: 10,
        revenue_cop: 200,
        cost_cop: 100,
        gross_profit_cop: 60,
        gross_margin_pct: 30,
        aov_cop: 20,
        tickets_count: 10,
        cost_data_quality: { with_snapshot: 10, with_fallback: 0 },
      },
      kpis: {
        sell_through_pct: 50,
        sell_through_approximate: true,
        inventory_turnover_approximate: 2,
        gmroi_approximate: 1.2,
      },
    });
    // B: 10 sold, 50% → sellable 10; cost 100, turnover 1 → inv 100; profit 40 → gmroi 0.4
    const b = emptyMetrics({
      summary: {
        units_sold: 10,
        revenue_cop: 200,
        cost_cop: 100,
        gross_profit_cop: 40,
        gross_margin_pct: 20,
        aov_cop: 20,
        tickets_count: 10,
        cost_data_quality: { with_snapshot: 10, with_fallback: 0 },
      },
      kpis: {
        sell_through_pct: 50,
        sell_through_approximate: true,
        inventory_turnover_approximate: 1,
        gmroi_approximate: 0.4,
      },
    });

    const merged = mergeMetricsAnalytics(a, b, "pablo", "esteban");
    // 20 / (20 + 20) = 50%
    expect(merged.kpis.sell_through_pct).toBe(50);
    // cost 200 / inv 150 ≈ 1.33
    expect(merged.kpis.inventory_turnover_approximate).toBe(1.33);
    // profit 100 / inv 150 ≈ 0.67  (gross from revenue-cost = 200)
    // wait: merged gross = revenue 400 - cost 200 = 200
    expect(merged.summary.gross_profit_cop).toBe(200);
    expect(merged.kpis.gmroi_approximate).toBe(1.33);
  });
});
