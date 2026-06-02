import axios from "axios";
import { formatCOP } from "../../utils/convert";

import { apiUrl } from "../../config/api";

const API_TCG = apiUrl("/tcg-dex/card/find");

type TcgCardLite = { set?: string; name?: string };

function expansionFromCardDto(card: TcgCardLite | null | undefined): string | undefined {
  if (!card?.set) return undefined;
  const s = String(card.set);
  const m = s.match(/\(([^)]+)\)\s*$/);
  return m ? m[1].trim() : s.trim();
}

export async function fetchExpansionForCard(cardId: string): Promise<string | undefined> {
  try {
    const res = await axios.get<TcgCardLite>(`${API_TCG}/${encodeURIComponent(cardId)}`);
    return expansionFromCardDto(res.data);
  } catch {
    return undefined;
  }
}

export type PedidoLineInput = {
  card_id: string;
  card_name: string;
  precio: number;
  rareza?: string | null;
};

/** Líneas en camino (sin precio en el mensaje). */
export type PedidoIncomingLineInput = {
  card_id: string;
  card_name: string;
  quantity: number;
  rareza?: string | null;
};

export async function buildWhatsAppPedidoText(opts: {
  clientName: string;
  tiendaEntrega: string;
  lines: PedidoLineInput[];
  incomingLines?: PedidoIncomingLineInput[];
}): Promise<string> {
  const idsStock = opts.lines.map((l) => l.card_id);
  const idsInc = (opts.incomingLines ?? []).map((l) => l.card_id);
  const uniqueIds = [...new Set([...idsStock, ...idsInc].filter(Boolean))];

  const expansions = new Map<string, string | undefined>();
  await Promise.all(
    uniqueIds.map(async (id) => {
      expansions.set(id, await fetchExpansionForCard(id));
    }),
  );

  const lineasStock = opts.lines.map((l) => {
    const exp = expansions.get(l.card_id);
    const rare = l.rareza?.trim() ? ` — Rareza: ${l.rareza}` : "";
    const exps = exp ? ` — Expansión: ${exp}` : "";
    return `• ${l.card_name}${rare}${exps}: ${formatCOP(l.precio)}`;
  });

  const total = opts.lines.reduce((s, l) => s + l.precio, 0);

  const lineasIncoming = (opts.incomingLines ?? []).map((l) => {
    const exp = expansions.get(l.card_id);
    const rare = l.rareza?.trim() ? ` — Rareza: ${l.rareza}` : "";
    const exps = exp ? ` — Expansión: ${exp}` : "";
    const qty = l.quantity > 1 ? ` ×${l.quantity}` : "";
    return `• ${l.card_name}${qty}${rare}${exps}`;
  });

  const parts: string[] = [
    "¡Hola!",
    "",
    "Te envío el resumen de tu pedido:",
    "",
    `*Pedido — ${opts.clientName}*`,
    `Tienda de entrega: ${opts.tiendaEntrega}`,
    "",
  ];

  if (opts.lines.length > 0) {
    parts.push("Cartas reservadas:", ...lineasStock, "", `*Total: ${formatCOP(total)}*`, "");
  }

  if (opts.incomingLines && opts.incomingLines.length > 0) {
    parts.push("Cartas en camino (a tu nombre, sin precio todavía):", ...lineasIncoming, "");
  }

  parts.push("Cualquier duda me escribes. ¡Gracias!");

  return parts.join("\n");
}

/** Igual que en imprimir-pedidos: dígitos; Colombia 10 dígitos empezando en 3 → prefijo 57 */
export function normalizarNumeroWhatsApp(celular: string): string {
  const digitos = celular.replace(/\D/g, "");
  if (digitos.length === 10 && digitos.startsWith("3")) return "57" + digitos;
  return digitos;
}

export function abrirWhatsAppConTexto(celular: string | undefined, texto: string): void {
  const encoded = encodeURIComponent(texto);
  const numero = celular?.trim();
  if (numero) {
    const waNum = normalizarNumeroWhatsApp(numero);
    window.open(`https://wa.me/${waNum}?text=${encoded}`, "_blank", "noopener,noreferrer");
  } else {
    window.open(`https://wa.me/?text=${encoded}`, "_blank", "noopener,noreferrer");
  }
}
