import JsBarcode from "jsbarcode";

/** Genera SVG Code 128 listo para imprimir (lectores láser 1D). */
export function renderCode128Svg(value: string): string {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  JsBarcode(svg, value, {
    format: "CODE128",
    width: 2,
    height: 72,
    displayValue: true,
    fontSize: 14,
    margin: 8,
    textMargin: 4,
  });
  return new XMLSerializer().serializeToString(svg);
}
