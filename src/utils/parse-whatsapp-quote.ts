/** Parseo del mensaje de cotización generado por la tienda (WhatsApp). */

export type ParsedWhatsappQuoteLine = {
  lineNumber: number;
  raw: string;
  name: string;
  expansion: string;
  collectorNumber: string;
  languageLabel: string;
  conditionLabel: string;
};

const QUOTE_LINE_RE =
  /^[-*•]\s*(.+?)\s*\((.+?)\s+#([^)]+)\)\s+[—–-]\s*Idioma:\s*(.+?)(?:,\s*|\s+)Estado:\s*(.+)$/u;

const CARDTRADER_CARD_URL_RE =
  /https?:\/\/(?:www\.)?cardtrader\.com\/(?:es|en)\/cards\/\d+-[a-z0-9-]+/i;

export function pasteHasCardtraderCardUrls(raw: string): boolean {
  return CARDTRADER_CARD_URL_RE.test(raw);
}

export function detectPedidoPasteKind(
  raw: string,
): "urls" | "quote" | "empty" {
  const text = raw.replace(/\r\n/g, "\n");
  if (!text.trim()) return "empty";
  if (pasteHasCardtraderCardUrls(text)) return "urls";
  if (parseWhatsappQuotePaste(text).length > 0) return "quote";
  return "empty";
}

export function parseWhatsappQuotePaste(raw: string): ParsedWhatsappQuoteLine[] {
  const lines: ParsedWhatsappQuoteLine[] = [];
  const text = raw.replace(/\r\n/g, "\n");
  let lineNumber = 0;

  for (const row of text.split("\n")) {
    const trimmed = row.trim();
    if (!trimmed) continue;
    const match = QUOTE_LINE_RE.exec(trimmed);
    if (!match) continue;
    const name = match[1].trim();
    const expansion = match[2].trim();
    const collectorNumber = match[3].trim();
    const languageLabel = match[4].trim();
    const conditionLabel = match[5].trim();
    if (!name || !expansion || !collectorNumber) continue;
    lineNumber += 1;
    lines.push({
      lineNumber,
      raw: trimmed,
      name,
      expansion,
      collectorNumber,
      languageLabel,
      conditionLabel,
    });
  }

  return lines;
}
