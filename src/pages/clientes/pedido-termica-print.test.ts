import { describe, expect, it } from "vitest";
import {
  THERMAL_PEDIDO_WIDTH_MM,
  buildPedidoTermicaPrintHtml,
  openPedidoTermicaPrintWindow,
  pedidoTermicaMuestraAbono,
  type PedidoTermicaTicket,
} from "./pedido-termica-print";

function ticket(
  overrides: Partial<PedidoTermicaTicket> = {},
): PedidoTermicaTicket {
  return {
    nombre: "Ana Pérez",
    celular: "3001234567",
    entrega: "Tienda centro",
    fechaTentativa: "10 sep 2026",
    lineas: [{ nombre: "Pikachu VMAX", precio: 15_000 }],
    total: 15_000,
    ...overrides,
  };
}

describe("THERMAL_PEDIDO_WIDTH_MM", () => {
  it("usa rollo continuo 58 mm", () => {
    expect(THERMAL_PEDIDO_WIDTH_MM).toBe(58);
  });
});

describe("buildPedidoTermicaPrintHtml", () => {
  it("incluye cliente, total y @page 58 mm", () => {
    const html = buildPedidoTermicaPrintHtml([ticket()]);

    expect(html).toContain("Ana Pérez");
    expect(html).toContain("TOTAL");
    expect(html).toContain("@page");
    expect(html).toContain("58mm auto");
    expect(html).toContain("size: 58mm auto");
    expect(html).toContain("Pikachu VMAX");
    expect(html).toContain("3001234567");
    expect(html).toContain("Tienda centro");
  });

  it("prefija ☼ solo en líneas de Esteban", () => {
    const html = buildPedidoTermicaPrintHtml([
      ticket({
        lineas: [
          { nombre: "Pikachu Pablo", precio: 10_000, stock_owner: "pablo" },
          { nombre: "Mew Esteban", precio: 12_000, stock_owner: "esteban" },
          { nombre: "Legado", precio: 1_000 },
        ],
        total: 23_000,
      }),
    ]);
    expect(html).toContain("☼ Mew Esteban");
    expect(html).toContain("Pikachu Pablo");
    expect(html).not.toContain("☼ Pikachu Pablo");
    expect(html).toContain("Legado");
    expect(html).not.toContain("☼ Legado");
  });

  it("escapa < en nombres de carta y no trunca a 22 caracteres", () => {
    const largo =
      "Charizard ex Special Illustration Rare <promo> edición extra larga";
    const html = buildPedidoTermicaPrintHtml([
      ticket({
        lineas: [{ nombre: largo, precio: 1_000 }],
        total: 1_000,
      }),
    ]);

    expect(html).toContain("Charizard ex Special Illustration Rare &lt;promo&gt;");
    expect(html).not.toContain("<promo>");
    expect(html).toContain("edición extra larga");
  });

  it("omite celular vacío y pone corte entre tickets (no en el último)", () => {
    const html = buildPedidoTermicaPrintHtml([
      ticket({ nombre: "Cliente A", celular: "  " }),
      ticket({ nombre: "Cliente B", celular: undefined }),
    ]);

    expect(html).toContain("Cliente A");
    expect(html).toContain("Cliente B");
    expect(html).not.toContain("Cel:");
    expect(html).toContain('class="cut"');
    expect(html).toContain("ticket-last");
    expect(html).toContain("page-break-after: always");
  });

  it("devuelve cadena vacía si no hay pedidos (el caller no abre ventana)", () => {
    expect(buildPedidoTermicaPrintHtml([])).toBe("");
  });

  it("omite Abonado y Saldo si no hay abono", () => {
    const html = buildPedidoTermicaPrintHtml([ticket()]);
    expect(html).not.toContain("Abonado");
    expect(html).not.toContain("Saldo");
  });

  it("omite Abonado si el monto es 0", () => {
    const html = buildPedidoTermicaPrintHtml([
      ticket({ abonado_cop: 0, saldo_cop: 15_000 }),
    ]);
    expect(html).not.toContain("Abonado");
    expect(html).not.toContain("Saldo");
  });

  it("incluye Abonado y Saldo debajo del total cuando aplica", () => {
    const html = buildPedidoTermicaPrintHtml([
      ticket({ abonado_cop: 4_000, saldo_cop: 11_000 }),
    ]);
    const totalIdx = html.indexOf("TOTAL");
    const abonadoIdx = html.indexOf("Abonado");
    const saldoIdx = html.indexOf("Saldo");
    expect(abonadoIdx).toBeGreaterThan(totalIdx);
    expect(saldoIdx).toBeGreaterThan(abonadoIdx);
  });
});

describe("pedidoTermicaMuestraAbono", () => {
  it("solo aplica con monto mayor que 0", () => {
    expect(pedidoTermicaMuestraAbono(undefined)).toBe(false);
    expect(pedidoTermicaMuestraAbono(0)).toBe(false);
    expect(pedidoTermicaMuestraAbono(-1)).toBe(false);
    expect(pedidoTermicaMuestraAbono(1)).toBe(true);
  });
});

describe("openPedidoTermicaPrintWindow", () => {
  it("no lanza si la lista está vacía (el caller no abre ventana)", () => {
    expect(() => openPedidoTermicaPrintWindow([])).not.toThrow();
  });
});
