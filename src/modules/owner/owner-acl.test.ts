import { describe, expect, it } from "vitest";
import { isFeatureAllowed, parseStoredOwner } from "../../config/owners";
import { routeToFeature } from "./owner-acl";

describe("owner ACL helpers", () => {
  it("isFeatureAllowed esteban cotizar → true; sin incoming/export-tienda", () => {
    expect(isFeatureAllowed("esteban", "cotizar")).toBe(true);
    expect(isFeatureAllowed("esteban", "incoming")).toBe(false);
    expect(isFeatureAllowed("esteban", "export-tienda")).toBe(false);
  });

  it("isFeatureAllowed pablo export-tienda → true", () => {
    expect(isFeatureAllowed("pablo", "export-tienda")).toBe(true);
  });

  it("routeToFeature /ventas/escanear-qr → venta-asistida-qr", () => {
    expect(routeToFeature("/ventas/escanear-qr")).toBe("venta-asistida-qr");
  });

  it("routeToFeature /ventas/desde-movil → ventas", () => {
    expect(routeToFeature("/ventas/desde-movil")).toBe("ventas");
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

  it("routeToFeature ignora el prefijo de TCG", () => {
    expect(routeToFeature("/yugioh")).toBe("inicio");
    expect(routeToFeature("/yugioh/add-stock")).toBe("agregar-stock");
    expect(routeToFeature("/yugioh/stock")).toBe("stock");
    expect(routeToFeature("/yugioh/cardtrader-transit")).toBe("cardtrader");
    expect(routeToFeature("/yugioh/ventas")).toBe("ventas");
    expect(routeToFeature("/yugioh/clientes")).toBe("clientes");
    expect(routeToFeature("/yugioh/envios")).toBe("clientes");
    expect(routeToFeature("/yugioh/stock/revision")).toBe("stock");
    expect(routeToFeature("/yugioh/stock/imprimir-etiquetas-qr")).toBe("stock");
    expect(routeToFeature("/pokemon/stock")).toBe("stock");
    expect(routeToFeature("/magic/cotizar")).toBe("cotizar");
    expect(routeToFeature("/onepiece/add-stock")).toBe("agregar-stock");
    expect(routeToFeature("/onepiece")).toBe("inicio");
  });

  it("parseStoredOwner inválido → pablo", () => {
    expect(parseStoredOwner(null)).toBe("pablo");
    expect(parseStoredOwner("nope")).toBe("pablo");
    expect(parseStoredOwner("esteban")).toBe("esteban");
  });
});
