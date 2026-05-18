import { apiClient } from "../../api/client";
import { formatCOP } from "../../utils/convert";

const API_TCG = "/tcg-dex/card/find";

type TcgCardLite = { set?: string; name?: string };

function expansionFromCardDto(card: TcgCardLite | null | undefined): string | undefined {
  if (!card?.set) return undefined;
  const s = String(card.set);
  const m = s.match(/\(([^)]+)\)\s*$/);
  return m ? m[1].trim() : s.trim();
}

export async function fetchExpansionForCard(cardId: string): Promise<string | undefined> {
  try {
    const res = await apiClient.get<TcgCardLite>(`${API_TCG}/${encodeURIComponent(cardId)}`);
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

export async function buildWhatsAppPedidoText(opts: {
  clientName: string;
  tiendaEntrega: string;
  lines: PedidoLineInput[];
}): Promise<string> {
  const uniqueIds = [...new Set(opts.lines.map((l) => l.card_id))];
  const expansions = new Map<string, string | undefined>();
  await Promise.all(
    uniqueIds.map(async (id) => {
      expansions.set(id, await fetchExpansionForCard(id));
    }),
  );

  const lineasTexto = opts.lines.map((l) => {
    const exp = expansions.get(l.card_id);
    const rare = l.rareza?.trim() ? ` — Rareza: ${l.rareza}` : "";
    const exps = exp ? ` — Expansión: ${exp}` : "";
    return `• ${l.card_name}${rare}${exps}: ${formatCOP(l.precio)}`;
  });

  const total = opts.lines.reduce((s, l) => s + l.precio, 0);

  return [
    "¡Hola!",
    "",
    "Te envío el resumen de tu pedido:",
    "",
    `*Pedido — ${opts.clientName}*`,
    `Tienda de entrega: ${opts.tiendaEntrega}`,
    "",
    "Cartas reservadas:",
    ...lineasTexto,
    "",
    `*Total: ${formatCOP(total)}*`,
    "",
    "Cualquier duda me escribes. ¡Gracias!",
  ].join("\n");
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
