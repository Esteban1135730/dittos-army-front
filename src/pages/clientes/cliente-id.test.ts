import { describe, expect, it } from "vitest";
import { clientItemId, normalizeClientItem, normalizeClientList } from "./cliente-id";

describe("cliente-id", () => {
  it("clientItemId prefiere _id", () => {
    expect(clientItemId({ _id: "a", id: "b" })).toBe("a");
  });

  it("clientItemId usa id si falta _id", () => {
    expect(clientItemId({ id: "mongo-id" })).toBe("mongo-id");
  });

  it("normalizeClientList filtra inválidos", () => {
    const list = normalizeClientList([
      { _id: "1", nombre: "Ana", metodo_contacto: "whatsapp" },
      { nombre: "Sin id" },
      { id: "2", nombre: "Bob", metodo_contacto: "facebook" },
    ]);
    expect(list).toHaveLength(2);
    expect(list[0]._id).toBe("1");
    expect(list[1]._id).toBe("2");
  });

  it("normalizeClientItem null si no hay id", () => {
    expect(normalizeClientItem({ nombre: "X" })).toBeNull();
  });
});
