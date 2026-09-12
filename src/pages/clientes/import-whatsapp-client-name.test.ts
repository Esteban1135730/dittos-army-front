import { describe, expect, it } from "vitest";
import {
  clientNameDiffersFromMessage,
  extractClientNameFromStoreMessage,
} from "./import-whatsapp-client-name";

describe("clientNameDiffersFromMessage", () => {
  it("no advierte si el mensaje no trae nombre", () => {
    expect(clientNameDiffersFromMessage("Ana", null)).toBe(false);
    expect(clientNameDiffersFromMessage("Ana", "")).toBe(false);
  });

  it("detecta diferencia ignorando mayúsculas", () => {
    expect(clientNameDiffersFromMessage("Ana García", "ana garcía")).toBe(false);
    expect(clientNameDiffersFromMessage("Ana", "Pedro")).toBe(true);
  });

  it("extrae A nombre de del mensaje", () => {
    expect(
      extractClientNameFromStoreMessage("A nombre de: Juan Pérez\nNota:"),
    ).toBe("Juan Pérez");
    expect(extractClientNameFromStoreMessage("sin nombre")).toBeNull();
  });
});
