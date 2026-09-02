import { describe, expect, it } from "vitest";
import {
  mapReservedClientByStockId,
  stockReservationStateLabel,
} from "./reserved-client-by-stock";

describe("mapReservedClientByStockId", () => {
  it("asocia el nombre del cliente a la línea de stock", () => {
    const map = mapReservedClientByStockId(
      [{ stock_id: "s1", client_id: "c1" }],
      [{ _id: "c1", nombre: "Ana Pérez" }],
    );
    expect(map.get("s1")).toEqual({ clientId: "c1", nombre: "Ana Pérez" });
  });

  it("usa Cliente si el cliente no está en el listado", () => {
    const map = mapReservedClientByStockId(
      [{ stock_id: "s1", client_id: "c-missing" }],
      [],
    );
    expect(map.get("s1")).toEqual({
      clientId: "c-missing",
      nombre: "Cliente",
    });
  });

  it("conserva la primera reserva si hay dos en el mismo stock", () => {
    const map = mapReservedClientByStockId(
      [
        { stock_id: "s1", client_id: "c1" },
        { stock_id: "s1", client_id: "c2" },
      ],
      [
        { _id: "c1", nombre: "Ana" },
        { _id: "c2", nombre: "Luis" },
      ],
    );
    expect(map.get("s1")?.nombre).toBe("Ana");
  });

  it("ignora reservas sin stock o cliente", () => {
    const map = mapReservedClientByStockId(
      [{ stock_id: "", client_id: "c1" }, { stock_id: "s1" }],
      [{ _id: "c1", nombre: "Ana" }],
    );
    expect(map.size).toBe(0);
  });
});

describe("stockReservationStateLabel", () => {
  it("incluye el nombre cuando está en reserva", () => {
    expect(
      stockReservationStateLabel("reserva", {
        clientId: "c1",
        nombre: "Ana Pérez",
      }),
    ).toBe("Reservada · Ana Pérez");
  });

  it("queda en Reservada si no hay cliente", () => {
    expect(stockReservationStateLabel("reserva", undefined)).toBe("Reservada");
  });

  it("no cambia el resto de estados", () => {
    expect(stockReservationStateLabel("disponible", undefined)).toBe(
      "Disponible",
    );
    expect(stockReservationStateLabel("vendida", undefined)).toBe("Vendida");
    expect(stockReservationStateLabel("propiedad", undefined)).toBe(
      "En propiedad",
    );
  });
});
