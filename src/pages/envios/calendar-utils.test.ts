import { describe, expect, it } from "vitest";
import {
  formatYmdLocal,
  groupCalendarioByFecha,
  monthGridRange,
} from "./calendar-utils";
import type { PedidoCalendarioItem } from "./types";

function item(
  fecha: string,
  overdue: boolean,
  id = fecha,
): PedidoCalendarioItem {
  return {
    id,
    client_id: "c1",
    client_name: "Ana",
    status: "reservado",
    entrega_en_tienda: true,
    fecha_tentativa_entrega: fecha,
    overdue,
    mapa: { kind: "omitido", reason: "sin_direccion" },
  };
}

describe("calendar-utils", () => {
  it("formatYmdLocal usa el día civil local", () => {
    const d = new Date(2026, 7, 5, 15, 0, 0);
    expect(formatYmdLocal(d)).toBe("2026-08-05");
  });

  it("agrupa items por fecha con count y overdue_count", () => {
    const grouped = groupCalendarioByFecha([
      item("2026-08-10", true, "a"),
      item("2026-08-10", false, "b"),
      item("2026-08-11", false, "c"),
    ]);
    expect(grouped["2026-08-10"]).toEqual({
      count: 2,
      overdue_count: 1,
      items: [
        expect.objectContaining({ id: "a" }),
        expect.objectContaining({ id: "b" }),
      ],
    });
    expect(grouped["2026-08-11"]?.count).toBe(1);
    expect(grouped["2026-08-11"]?.overdue_count).toBe(0);
  });

  it("rango de grilla del mes incluye días adyacentes (YYYY-MM-DD local)", () => {
    const { from, to, cells } = monthGridRange(2026, 7);
    expect(from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(from <= "2026-08-01").toBe(true);
    expect(to >= "2026-08-31").toBe(true);
    expect(cells.length % 7).toBe(0);
    expect(cells.some((c) => c.ymd < "2026-08-01" || !c.inMonth)).toBe(true);
    expect(cells.filter((c) => c.inMonth).map((c) => c.day)).toContain(1);
    expect(cells.filter((c) => c.inMonth).map((c) => c.day)).toContain(31);
  });
});
