import { describe, expect, it } from "vitest";
import {
  incomingGroupUnitCostCop,
  reservaMarginTotalCop,
} from "./reserva-cost-margin";

describe("incomingGroupUnitCostCop", () => {
  it("promedia ponderado por quantity y omite costos vacíos", () => {
    expect(
      incomingGroupUnitCostCop([
        { unit_cost_cop: 2000, quantity: 3 },
        { unit_cost_cop: 4000, quantity: 1 },
        { unit_cost_cop: null, quantity: 9 },
      ]),
    ).toBe(2500);
  });

  it("devuelve null si no hay costo", () => {
    expect(incomingGroupUnitCostCop([{ quantity: 2 }])).toBeNull();
  });
});

describe("reservaMarginTotalCop", () => {
  it("es null sin PVP", () => {
    expect(reservaMarginTotalCop(null, 3000, 2)).toBeNull();
    expect(reservaMarginTotalCop(0, 3000, 1)).toBeNull();
  });

  it("resta el costo y multiplica por cantidad", () => {
    expect(reservaMarginTotalCop(10000, 4000, 2)).toBe(12000);
  });

  it("trata costo ausente como 0", () => {
    expect(reservaMarginTotalCop(5000, null, 1)).toBe(5000);
  });
});
