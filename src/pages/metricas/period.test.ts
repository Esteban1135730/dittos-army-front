import { describe, expect, it } from "vitest";
import { cycleLabel, defaultMetricsPeriod } from "./period";

describe("defaultMetricsPeriod", () => {
  it("usa hoy local y 3 meses atrás", () => {
    const now = new Date(2026, 7, 12); // Aug 12 2026 local
    const period = defaultMetricsPeriod(now);
    expect(period.to).toBe("2026-08-12");
    expect(period.from).toBe("2026-05-12");
  });
});

describe("cycleLabel", () => {
  it('muestra "Ciclo activo" para active', () => {
    expect(cycleLabel("active", null)).toBe("Ciclo activo");
  });
});
