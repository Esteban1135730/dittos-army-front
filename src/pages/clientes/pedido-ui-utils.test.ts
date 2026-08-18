import { describe, expect, it } from "vitest";
import {
  diasHastaEntrega,
  entregaUrgencia,
  entregaUrgenciaLabel,
  pedidoTotal,
} from "./pedido-ui-utils";

describe("pedido-ui-utils", () => {
  it("pedidoTotal suma líneas", () => {
    expect(
      pedidoTotal([
        { stock_id: "a", card_id: "c", precio: 1000, currency: "COP" },
        { stock_id: "b", card_id: "c", precio: 500, currency: "COP" },
      ]),
    ).toBe(1500);
  });

  it("pedidoTotal multiplica por quantity", () => {
    expect(
      pedidoTotal([
        { stock_id: "bulk", card_id: "da-bulk", precio: 2000, currency: "COP", quantity: 3 },
      ]),
    ).toBe(6000);
  });

  it("entregaUrgencia detecta vencida y pronto", () => {
    const past = new Date();
    past.setDate(past.getDate() - 3);
    const y = past.getFullYear();
    const m = String(past.getMonth() + 1).padStart(2, "0");
    const d = String(past.getDate()).padStart(2, "0");
    expect(entregaUrgencia(`${y}-${m}-${d}`, "reservado")).toBe("overdue");

    const future = new Date();
    future.setDate(future.getDate() + 1);
    const fy = future.getFullYear();
    const fm = String(future.getMonth() + 1).padStart(2, "0");
    const fd = String(future.getDate()).padStart(2, "0");
    expect(entregaUrgencia(`${fy}-${fm}-${fd}`, "pagado")).toBe("soon");
    expect(entregaUrgenciaLabel(`${fy}-${fm}-${fd}`, "pagado")).toBe("Mañana");
  });

  it("diasHastaEntrega null si fecha inválida", () => {
    expect(diasHastaEntrega(null)).toBeNull();
    expect(diasHastaEntrega("")).toBeNull();
  });
});
