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

  it("routeToFeature /incoming-v2 → incoming", () => {
    expect(routeToFeature("/incoming-v2/novedad-stock")).toBe("incoming");
  });

  it("routeToFeature /envios → clientes", () => {
    expect(routeToFeature("/envios")).toBe("clientes");
  });

  it("routeToFeature /generar-pdf-grupos → inicio", () => {
    expect(routeToFeature("/generar-pdf-grupos")).toBe("inicio");
  });

  it("parseStoredOwner inválido → pablo", () => {
    expect(parseStoredOwner(null)).toBe("pablo");
    expect(parseStoredOwner("nope")).toBe("pablo");
    expect(parseStoredOwner("esteban")).toBe("esteban");
  });
});
