import { describe, expect, it } from "vitest";
import { clientNameDiffersFromMessage } from "./import-whatsapp-client-name";

describe("clientNameDiffersFromMessage", () => {
  it("no advierte si el mensaje no trae nombre", () => {
    expect(clientNameDiffersFromMessage("Ana", null)).toBe(false);
    expect(clientNameDiffersFromMessage("Ana", "")).toBe(false);
  });

  it("detecta diferencia ignorando mayúsculas", () => {
    expect(clientNameDiffersFromMessage("Ana García", "ana garcía")).toBe(false);
    expect(clientNameDiffersFromMessage("Ana", "Pedro")).toBe(true);
  });
});
