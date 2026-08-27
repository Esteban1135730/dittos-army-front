import type {
  ParsedPedidoLine,
  PedidoQuoteCandidate,
  PedidoResolveStatus,
} from "./parse-cardtrader-pedido";
import type { ParsedWhatsappQuoteLine } from "./parse-whatsapp-quote";

export type QuoteResolveApiCandidate = {
  blueprint_id?: number;
  expansion_id?: number;
  expansion_name?: string;
  name?: string;
  collector_number?: string;
  image_url?: string | null;
};

export type QuoteResolveApiResult = {
  index?: number;
  status?: PedidoResolveStatus;
  blueprint_id?: number | null;
  expansion_id?: number | null;
  expansion_name?: string | null;
  name?: string;
  collector_number?: string;
  image_url?: string | null;
  pokemon_language?: string | null;
  condition?: string | null;
  candidates?: QuoteResolveApiCandidate[];
  error?: string | null;
};

function asCandidate(raw: QuoteResolveApiCandidate): PedidoQuoteCandidate | null {
  const blueprintId = Number(raw.blueprint_id);
  const expansionId = Number(raw.expansion_id);
  if (!Number.isInteger(blueprintId) || blueprintId < 1) return null;
  if (!Number.isInteger(expansionId) || expansionId < 1) return null;
  return {
    blueprintId,
    expansionId,
    expansionName: String(raw.expansion_name ?? "").trim(),
    name: String(raw.name ?? "").trim(),
    collectorNumber: String(raw.collector_number ?? "").trim(),
    imageUrl: raw.image_url ?? null,
  };
}

export function mapWhatsappQuoteResultsToPedidoLines(
  parsed: ParsedWhatsappQuoteLine[],
  results: QuoteResolveApiResult[],
): ParsedPedidoLine[] {
  return parsed.map((q, i) => {
    const r = results[i] ?? {};
    const status: PedidoResolveStatus =
      r.status === "matched" || r.status === "ambiguous" || r.status === "not_found"
        ? r.status
        : "not_found";
    const blueprintId =
      typeof r.blueprint_id === "number" && r.blueprint_id > 0 ? r.blueprint_id : 0;
    const notes = [q.expansion, `#${q.collectorNumber}`, q.languageLabel, q.conditionLabel]
      .filter(Boolean)
      .join(" · ");
    const slugBase = `${q.lineNumber}-${q.collectorNumber}-${q.name}`
      .toLowerCase()
      .replace(/\s+/g, "-");
    return {
      id: `quote-${slugBase}`,
      lineNumber: q.lineNumber,
      quantity: 1,
      blueprintId,
      slug: "",
      displayName: String(r.name || q.name).trim(),
      url: "",
      clientNotes: notes,
      maxUsdHint: null,
      source: "quote",
      resolveStatus: status,
      expansionId:
        typeof r.expansion_id === "number" && r.expansion_id > 0 ? r.expansion_id : undefined,
      expansionName: String(r.expansion_name || q.expansion).trim(),
      collectorNumber: String(r.collector_number || q.collectorNumber).trim(),
      pokemonLanguage: r.pokemon_language ?? null,
      conditionFilter: r.condition ?? null,
      imageUrl: r.image_url ?? null,
      candidates: (r.candidates ?? [])
        .map(asCandidate)
        .filter((c): c is PedidoQuoteCandidate => c != null),
      resolvedBlueprintId: blueprintId > 0 ? blueprintId : undefined,
    };
  });
}

export function applyPedidoQuoteCandidate(
  line: ParsedPedidoLine,
  candidate: PedidoQuoteCandidate,
): ParsedPedidoLine {
  return {
    ...line,
    blueprintId: candidate.blueprintId,
    expansionId: candidate.expansionId,
    expansionName: candidate.expansionName || line.expansionName,
    displayName: candidate.name || line.displayName,
    collectorNumber: candidate.collectorNumber || line.collectorNumber,
    imageUrl: candidate.imageUrl ?? line.imageUrl,
    selectedCandidate: candidate,
  };
}

export function clearPedidoQuotePick(line: ParsedPedidoLine): ParsedPedidoLine {
  const restored =
    line.resolveStatus === "matched" && (line.resolvedBlueprintId ?? 0) > 0
      ? line.resolvedBlueprintId!
      : 0;
  return {
    ...line,
    selectedCandidate: null,
    blueprintId: restored,
    expansionId: restored ? line.expansionId : line.resolveStatus === "ambiguous" ? undefined : line.expansionId,
  };
}

export function pedidoLineCanLoadOffers(line: ParsedPedidoLine): boolean {
  if ((line.selectedCandidate?.blueprintId ?? 0) > 0) return true;
  if (line.resolveStatus === "not_found" || line.resolveStatus === "ambiguous") {
    return false;
  }
  return line.blueprintId > 0;
}

export function pedidoLineShowsCandidates(line: ParsedPedidoLine): boolean {
  if ((line.selectedCandidate?.blueprintId ?? 0) > 0) return false;
  return (line.candidates?.length ?? 0) > 0 && line.resolveStatus === "ambiguous";
}
