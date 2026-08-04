import { describe, expect, it } from "vitest";
import { isFeatureAllowed, parseStoredOwner } from "../../config/owners";
import { routeToFeature } from "./owner-acl";

describe("owner ACL helpers", () => {
  it("isFeatureAllowed esteban cotizar → false", () => {
    expect(isFeatureAllowed("esteban", "cotizar")).toBe(false);
  });

  it("isFeatureAllowed pablo export-tienda → true", () => {
    expect(isFeatureAllowed("pablo", "export-tienda")).toBe(true);
  });

  it("routeToFeature /ventas/escanear-qr → venta-asistida-qr", () => {
    expect(routeToFeature("/ventas/escanear-qr")).toBe("venta-asistida-qr");
  });

  it("parseStoredOwner inválido → pablo", () => {
    expect(parseStoredOwner(null)).toBe("pablo");
    expect(parseStoredOwner("nope")).toBe("pablo");
    expect(parseStoredOwner("esteban")).toBe("esteban");
  });
});
