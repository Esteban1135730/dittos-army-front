import axios from "axios";
import { formatCOP } from "../../utils/convert";
import { apiUrl } from "../../config/api";
import { buildTcgdexCardIdLookupCandidates } from "../../utils/tcgdex-set-resolve";
import { operationalRarezaLabel } from "../../constants/item-rareza";

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
  quantity?: number;
};

/** Líneas en camino (PVP opcional, formato tienda). */
export type PedidoIncomingLineInput = {
  card_id: string;
  card_name: string;
  quantity: number;
  rareza?: string | null;
  language?: string;
  precio_cop?: number | null;
};

const LANGUAGE_LABELS: Record<string, string> = {
  "no-importa": "No importa el idioma",
  en: "Inglés",
  es: "Español",
  fr: "Francés",
  de: "Alemán",
  it: "Italiano",
  pt: "Portugués",
  ja: "Japonés",
  ko: "Coreano",
  zh: "Chino",
  otro: "Otro",
};

function languageLabel(code?: string): string {
  const key = (code ?? "").trim().toLowerCase();
  if (!key) return "—";
  return LANGUAGE_LABELS[key] ?? code!.trim();
}

function cardNumberFromCardId(cardId: string): string | undefined {
  const id = (cardId ?? "").trim();
  const dash = id.lastIndexOf("-");
  return dash > 0 ? id.slice(dash + 1) : undefined;
}

function setIdFromCardId(cardId: string): string {
  const id = (cardId ?? "").trim();
  const dash = id.lastIndexOf("-");
  return dash > 0 ? id.slice(0, dash) : id;
}

/** Misma forma que `formatStoreCardLine` en dittos-army-store. */
export function formatStoreReservaCaminoLine(
  line: PedidoIncomingLineInput,
  expansion?: string,
): string {
  const lang = languageLabel(line.language);
  const number = cardNumberFromCardId(line.card_id);
  const expansionName = (expansion ?? "").trim() || setIdFromCardId(line.card_id);
  const expansionPart = number
    ? `Expansión: ${expansionName} (#${number})`
    : `Expansión: ${expansionName}`;
  const qty = Math.max(1, line.quantity || 1);
  let pricePart = "";
  if (line.precio_cop != null && line.precio_cop > 0) {
    const unit = formatCOP(line.precio_cop);
    pricePart =
      qty > 1
        ? ` | Precio: ${unit} c/u (${formatCOP(line.precio_cop * qty)} en esta línea)`
        : ` | Precio: ${unit}`;
  }
  const rz = line.rareza?.trim();
  const variant = rz ? ` — ${operationalRarezaLabel(rz)}` : "";
  return `- ${line.card_name} | ID: ${line.card_id} | ${expansionPart} | Idioma: ${lang}${pricePart}${variant} x${qty}`;
}

export async function buildWhatsAppReservaCaminoText(opts: {
  clientName: string;
  lines: PedidoIncomingLineInput[];
}): Promise<string> {
  const uniqueIds = [...new Set(opts.lines.map((l) => l.card_id).filter(Boolean))];
  const expansions = new Map<string, string | undefined>();
  await Promise.all(
    uniqueIds.map(async (id) => {
      expansions.set(id, await fetchExpansionForCard(id));
    }),
  );
  const formatted = opts.lines.map((l) =>
    formatStoreReservaCaminoLine(l, expansions.get(l.card_id)),
  );
  const total = opts.lines.reduce((s, l) => {
    const qty = Math.max(1, l.quantity || 1);
    return s + (l.precio_cop != null && l.precio_cop > 0 ? l.precio_cop * qty : 0);
  }, 0);
  const parts = [
    "Hola, te confirmo tu reserva de estas cartas en camino:",
    "",
    ...formatted,
    "",
  ];
  if (total > 0) {
    parts.push(`Total: ${formatCOP(total)}`);
  }
  parts.push(`A nombre de: ${opts.clientName}`);
  return parts.join("\n");
}

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
    const units =
      typeof l.quantity === "number" && Number.isInteger(l.quantity) && l.quantity >= 1
        ? l.quantity
        : 1;
    const qty = units > 1 ? ` ×${units}` : "";
    return `• ${l.card_name}${qty}${rare}${exps}: ${formatCOP(l.precio * units)}`;
  });

  const total = opts.lines.reduce((s, l) => {
    const units =
      typeof l.quantity === "number" && Number.isInteger(l.quantity) && l.quantity >= 1
        ? l.quantity
        : 1;
    return s + l.precio * units;
  }, 0);

  const lineasIncoming = (opts.incomingLines ?? []).map((l) =>
    formatStoreReservaCaminoLine(l, expansions.get(l.card_id)),
  );

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
    parts.push("Cartas en camino:", ...lineasIncoming, "");
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
