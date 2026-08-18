import axios from "axios";
import { formatCOP } from "../../utils/convert";
import { apiUrl } from "../../config/api";
import { buildTcgdexCardIdLookupCandidates } from "../../utils/tcgdex-set-resolve";

const API_TCG = apiUrl("/tcg-dex/card/find");

type TcgCardLite = {
  set?: string;
  name?: string;
  /** Nombre EN del set (homólogo / cards-database) cuando el set localizado no es inglés. */
  setEnglishName?: string;
};

/** Expone la lógica de expansión para tests y para el mensaje WhatsApp. */
export function expansionFromCardDto(card: TcgCardLite | null | undefined): string | undefined {
  const english = card?.setEnglishName?.trim();
  if (english) return english;
  if (!card?.set) return undefined;
  const s = String(card.set);
  const m = s.match(/\(([^)]+)\)\s*$/);
  return m ? m[1].trim() : s.trim();
}

export async function fetchExpansionForCard(cardId: string): Promise<string | undefined> {
  const candidates = buildTcgdexCardIdLookupCandidates(cardId);
  const toTry = candidates.length > 0 ? candidates : [cardId.trim()];
  for (const id of toTry) {
    try {
      const res = await axios.get<TcgCardLite>(`${API_TCG}/${encodeURIComponent(id)}`);
      const exp = expansionFromCardDto(res.data);
      if (exp) return exp;
    } catch {
      /* siguiente variante */
    }
  }
  return undefined;
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
  descripcionEntrega?: string;
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
  ];
  if (opts.descripcionEntrega?.trim()) {
    parts.push(`Entrega: ${opts.descripcionEntrega.trim()}`);
  }
  parts.push("");

  if (opts.lines.length > 0) {
    parts.push("Cartas reservadas:", ...lineasStock, "", `*Total: ${formatCOP(total)}*`, "");
  }

  if (opts.incomingLines && opts.incomingLines.length > 0) {
    parts.push("Cartas en camino (a tu nombre, sin precio todavía):", ...lineasIncoming, "");
  }

  parts.push("Cualquier duda me escribes. ¡Gracias!");

  return parts.join("\n");
}

/** Dígitos; Colombia 10 dígitos empezando en 3 → prefijo 57 */
export function normalizarNumeroWhatsApp(celular: string): string {
  const digitos = celular.replace(/\D/g, "");
  if (digitos.length === 10 && digitos.startsWith("3")) return "57" + digitos;
  return digitos;
}

/** Usuario WhatsApp: quita `@` iniciales y espacios. */
export function normalizarNickWhatsApp(contacto: string): string {
  return contacto.trim().replace(/^@+/, "").trim();
}

export type DestinoWhatsApp =
  | { kind: "phone"; value: string }
  | { kind: "username"; value: string };

/**
 * Número (solo dígitos / formato telefónico) o usuario `@{nick}`.
 * Letras o `_` (o un `@` inicial) se tratan como nick.
 */
export function resolverDestinoWhatsApp(contacto: string): DestinoWhatsApp | null {
  const raw = contacto.trim();
  if (!raw) return null;

  if (raw.startsWith("@") || /[A-Za-z_]/.test(raw)) {
    const nick = normalizarNickWhatsApp(raw);
    if (!nick) return null;
    return { kind: "username", value: nick };
  }

  const phone = normalizarNumeroWhatsApp(raw);
  if (!phone) return null;
  return { kind: "phone", value: phone };
}

/** Path de wa.me: dígitos del número o `@{nick}`. */
export function pathDestinoWhatsApp(contacto: string): string | null {
  const dest = resolverDestinoWhatsApp(contacto);
  if (!dest) return null;
  return dest.kind === "username" ? `@${dest.value}` : dest.value;
}

export function urlWhatsAppConTexto(contacto: string | undefined, texto: string): string {
  const encoded = encodeURIComponent(texto);
  const path = contacto?.trim() ? pathDestinoWhatsApp(contacto) : null;
  if (path) return `https://wa.me/${path}?text=${encoded}`;
  return `https://wa.me/?text=${encoded}`;
}

export function abrirWhatsAppConTexto(celular: string | undefined, texto: string): void {
  window.open(urlWhatsAppConTexto(celular, texto), "_blank", "noopener,noreferrer");
}
