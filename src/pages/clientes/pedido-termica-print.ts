import { formatCOP } from "../../utils/convert";

/** Ancho del rollo continuo (impresora 632-L58P). */
export const THERMAL_PEDIDO_WIDTH_MM = 58;

export type PedidoTermicaLinea = {
  nombre: string;
  precio: number;
};

export type PedidoTermicaTicket = {
  nombre: string;
  celular?: string;
  entrega: string;
  fechaTentativa: string;
  lineas: PedidoTermicaLinea[];
  total: number;
  /** Solo se imprime si `pedidoTermicaMuestraAbono` es true. */
  abonado_cop?: number;
  saldo_cop?: number;
};

/** Hay abono de capital que vale la pena mostrar en el ticket (monto > 0). */
export function pedidoTermicaMuestraAbono(abonado_cop?: number): boolean {
  return (abonado_cop ?? 0) > 0;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatMoney(value: number): string {
  return escapeHtml(String(formatCOP(value)));
}

/**
 * HTML del ticket térmico 58 mm. Vacío si no hay pedidos (el caller no abre ventana).
 */
export function buildPedidoTermicaPrintHtml(
  pedidos: PedidoTermicaTicket[],
): string {
  if (pedidos.length === 0) return "";

  const W = THERMAL_PEDIDO_WIDTH_MM;
  const subtitle = `${pedidos.length} ticket${pedidos.length === 1 ? "" : "s"} · rollo continuo ${W} mm`;

  const tickets = pedidos
    .map((pedido, index) => {
      const isLast = index === pedidos.length - 1;
      const celular = (pedido.celular ?? "").trim();
      const lineas =
        pedido.lineas.length === 0
          ? `<tr><td class="nombre" colspan="2">Sin líneas</td></tr>`
          : pedido.lineas
              .map(
                (linea) => `
            <tr>
              <td class="nombre">${escapeHtml(linea.nombre)}</td>
              <td class="precio">${formatMoney(linea.precio)}</td>
            </tr>`,
              )
              .join("");

      const muestraAbono = pedidoTermicaMuestraAbono(pedido.abonado_cop);
      const abonoHtml = muestraAbono
        ? `<div class="abono"><span>Abonado</span><span>${formatMoney(pedido.abonado_cop ?? 0)}</span></div>
        <div class="abono"><span>Saldo</span><span>${formatMoney(pedido.saldo_cop ?? 0)}</span></div>`
        : "";

      return `
      <div class="ticket${isLast ? " ticket-last" : ""}">
        <div class="cliente">${escapeHtml(pedido.nombre)}</div>
        ${celular ? `<div class="meta">Cel: ${escapeHtml(celular)}</div>` : ""}
        <div class="meta">Entrega: ${escapeHtml(pedido.entrega)}</div>
        <div class="meta">Fecha tentativa: ${escapeHtml(pedido.fechaTentativa)}</div>
        <table>
          <thead>
            <tr>
              <th class="nombre">Carta</th>
              <th class="precio">Precio</th>
            </tr>
          </thead>
          <tbody>${lineas}</tbody>
        </table>
        <div class="total"><span>TOTAL</span><span>${formatMoney(pedido.total)}</span></div>
        ${abonoHtml}
        ${isLast ? "" : `<div class="cut" aria-hidden="true">corte</div>`}
      </div>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Pedidos — térmica ${W} mm</title>
  <style>
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      font-family: Arial Black, Arial, "Segoe UI", sans-serif;
      color: #000;
      background: #e2e8f0;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .ticket {
      width: ${W}mm;
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    .no-print {
      width: auto;
      max-width: 420px;
      padding: 12px 16px;
      background: #1e293b;
      color: #f8fafc;
      font-family: Arial, "Segoe UI", sans-serif;
      font-size: 13px;
      margin-bottom: 8px;
    }
    .no-print h1 { font-size: 16px; font-weight: 700; margin-bottom: 4px; }
    .no-print p { opacity: 0.9; line-height: 1.4; }
    .no-print ul { margin: 8px 0 0 18px; font-size: 12px; opacity: 0.85; }
    .ticket {
      width: ${W}mm;
      padding: 1.2mm;
      background: #fff;
      color: #000;
      border: 1px dashed #94a3b8;
    }
    .cliente {
      font-size: 14pt;
      font-weight: 900;
      letter-spacing: 0.01em;
      line-height: 1.15;
      -webkit-text-stroke: 0.3px #000;
      paint-order: stroke fill;
      overflow-wrap: anywhere;
      word-break: break-word;
      border-bottom: 1px solid #000;
      padding-bottom: 1mm;
      margin-bottom: 1.2mm;
    }
    .meta {
      font-size: 10pt;
      font-weight: 800;
      letter-spacing: 0.01em;
      line-height: 1.2;
      -webkit-text-stroke: 0.2px #000;
      paint-order: stroke fill;
      overflow-wrap: anywhere;
      word-break: break-word;
      margin-bottom: 0.6mm;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 1.5mm 0 1.2mm;
      font-size: 10pt;
      font-weight: 800;
      -webkit-text-stroke: 0.2px #000;
      paint-order: stroke fill;
    }
    th, td {
      vertical-align: top;
      padding: 0.6mm 0;
    }
    th {
      border-bottom: 1px solid #000;
      font-weight: 900;
    }
    td {
      border-bottom: 1px dashed #000;
    }
    .nombre {
      text-align: left;
      padding-right: 1.5mm;
      overflow-wrap: anywhere;
      word-break: break-word;
    }
    .precio {
      text-align: right;
      white-space: nowrap;
      width: 1%;
      padding-left: 1mm;
    }
    .total {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 1.5mm;
      width: 100%;
      font-size: 13pt;
      font-weight: 900;
      letter-spacing: 0.02em;
      -webkit-text-stroke: 0.35px #000;
      paint-order: stroke fill;
      border-top: 2px solid #000;
      padding-top: 1.2mm;
      margin-top: 0.5mm;
    }
    .total span:last-child {
      white-space: nowrap;
    }
    .abono {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 1.5mm;
      width: 100%;
      font-size: 11pt;
      font-weight: 800;
      letter-spacing: 0.01em;
      -webkit-text-stroke: 0.2px #000;
      paint-order: stroke fill;
      margin-top: 0.6mm;
    }
    .abono span:last-child {
      white-space: nowrap;
    }
    .cut {
      margin-top: 2mm;
      border-top: 1px dashed #000;
      text-align: center;
      font-size: 8pt;
      font-weight: 800;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      padding-top: 0.8mm;
    }
    @page {
      size: ${W}mm auto;
      margin: 0;
    }
    @media print {
      html, body {
        width: ${W}mm;
        margin: 0;
        padding: 0;
        background: #fff;
        color: #000;
      }
      .no-print { display: none !important; }
      .ticket {
        border: none;
        width: ${W}mm;
        page-break-after: always;
        break-after: page;
      }
      .ticket-last {
        page-break-after: auto;
        break-after: auto;
      }
    }
  </style>
</head>
<body>
  <div class="no-print">
    <h1>Tickets de pedido — térmica 58 mm</h1>
    <p>${escapeHtml(subtitle)}</p>
    <ul>
      <li>Papel: <strong>58 mm</strong> (continuo). Márgenes <strong>ninguno</strong>. Escala <strong>100%</strong>.</li>
      <li>Impresora: térmica 58 mm / <strong>632-L58P</strong>.</li>
    </ul>
  </div>
  ${tickets}
  <script>window.onload = () => { setTimeout(() => window.print(), 500); };</script>
</body>
</html>`;
}

/**
 * Abre una ventana con el ticket 58 mm y dispara `window.print()`.
 * No abre nada si `pedidos` está vacío.
 */
export function openPedidoTermicaPrintWindow(
  pedidos: PedidoTermicaTicket[],
): void {
  if (pedidos.length === 0) return;

  const html = buildPedidoTermicaPrintHtml(pedidos);
  const win = window.open("", "_blank");
  if (!win) {
    throw new Error(
      "El navegador bloqueó la ventana emergente. Permite pop-ups e inténtalo de nuevo.",
    );
  }
  win.document.write(html);
  win.document.close();
}
