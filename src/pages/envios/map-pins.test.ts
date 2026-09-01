import { describe, expect, it } from "vitest";
import { groupDomicilioPins, groupTiendaPins, unlocatedDomicilioIds } from "./map-pins";
import type { PedidoCalendarioItem } from "./types";

function tienda(id: string, storeId: string, name: string): PedidoCalendarioItem {
  return {
    id,
    client_id: "c1",
    client_name: "Ana",
    status: "reservado",
    entrega_en_tienda: true,
    store_id: storeId,
    store_name: name,
    fecha_tentativa_entrega: "2026-08-20",
    overdue: false,
    mapa: { kind: "tienda", store_id: storeId, lat: 4.73, lng: -74.04 },
  };
}

function domicilio(id: string, dir: string, kind: "domicilio_bogota" | "omitido" = "domicilio_bogota"): PedidoCalendarioItem {
  return {
    id,
    client_id: "c1",
    client_name: "Ana",
    status: "pagado",
    entrega_en_tienda: false,
    ciudad: kind === "omitido" ? "Medellín" : "Bogotá",
    direccion_o_punto: dir,
    notas_entrega: kind === "omitido" ? "Unicentro" : undefined,
    fecha_tentativa_entrega: "2026-08-20",
    overdue: false,
    mapa: kind === "omitido" ? { kind: "omitido", reason: "fuera_bogota" } : { kind: "domicilio_bogota" },
  };
}

describe("map-pins", () => {
  it("agrupa varios pedidos del mismo hobby center en un pin", () => {
    const pins = groupTiendaPins([
      tienda("a", "valhalla", "Valhalla"),
      tienda("b", "valhalla", "Valhalla"),
      tienda("c", "lx-store", "LX Store"),
    ]);
    expect(pins).toHaveLength(2);
    const valhalla = pins.find((p) => p.id === "tienda:valhalla");
    expect(valhalla?.items).toHaveLength(2);
    expect(valhalla?.lat).toBe(4.73);
  });

  it("omite domicilio sin coords y marca sin ubicación", () => {
    const items = [domicilio("d1", "Calle 1"), domicilio("d2", "Calle 2")];
    const coords = { "Calle 1, Bogotá": { lat: 4.65, lng: -74.08 }, "Calle 2, Bogotá": null };
    expect(groupDomicilioPins(items, coords)).toHaveLength(1);
    expect([...unlocatedDomicilioIds(items, coords)]).toEqual(["d2"]);
  });

  it("pin si Google/Nominatim resolvió un omitido cuya descripción cae en Bogotá", () => {
    const items = [domicilio("d3", "punto de encuentro", "omitido")];
    const query = "punto de encuentro, Unicentro, Medellín";
    const pins = groupDomicilioPins(items, {
      [query]: { lat: 4.686, lng: -74.042 },
    });
    expect(pins).toHaveLength(1);
    expect(pins[0].kind).toBe("domicilio");
  });
});
