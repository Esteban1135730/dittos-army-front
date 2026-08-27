import type {
  ParsedPedidoLine,
  PedidoQuoteCandidate,
} from "./parse-cardtrader-pedido";
import type { ParsedWhatsappQuoteLine } from "./parse-whatsapp-quote";
import type { QuoteResolveApiResult } from "./map-whatsapp-quote-to-pedido";

export type QuoteSessionSource = "whatsapp" | "urls";

type BlueprintRefApi = {
  blueprint_id?: number;
  expansion_id?: number;
  expansion_name?: string;
  name?: string;
  collector_number?: string;
  image_url?: string | null;
};

export type QuoteSessionLineApi = {
  index?: number;
  name?: string;
  expansion?: string;
  collector_number?: string;
  language_label?: string | null;
  condition_label?: string | null;
  resolve?: QuoteResolveApiResult;
  selected_blueprint?: BlueprintRefApi | null;
  line_status?: "pending" | "picked" | "skipped";
};

export type QuoteSessionDetail = {
  id: string;
  status: string;
  source: QuoteSessionSource | string;
  raw_paste?: string;
  active_index: number;
  lines: QuoteSessionLineApi[];
};

export type QuoteSessionListItem = {
  id: string;
  status: string;
  source: string;
  active_index: number;
  line_count: number;
  created_at?: string | null;
};

function asCandidate(raw: BlueprintRefApi | null | undefined): PedidoQuoteCandidate | null {
  if (!raw) return null;
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

export function buildQuoteSessionCreateBody(args: {
  source: QuoteSessionSource;
  rawPaste: string;
  quoteLines?: ParsedWhatsappQuoteLine[];
  results?: QuoteResolveApiResult[];
  urlLines?: ParsedPedidoLine[];
}): {
  source: QuoteSessionSource;
  raw_paste: string;
  lines: Array<{
    name: string;
    expansion: string;
    collector_number: string;
    language_label?: string;
    condition_label?: string;
    resolve: QuoteResolveApiResult;
  }>;
} {
  if (args.source === "urls") {
    const urlLines = args.urlLines ?? [];
    return {
      source: "urls",
      raw_paste: args.rawPaste,
      lines: urlLines.map((line) => ({
        name: line.displayName || `Blueprint ${line.blueprintId}`,
        expansion: line.expansionName || line.slug || "url",
        collector_number: line.collectorNumber || String(line.blueprintId || "0"),
        resolve: {
          status: line.blueprintId > 0 ? "matched" : "not_found",
          blueprint_id: line.blueprintId > 0 ? line.blueprintId : null,
          expansion_id: line.expansionId ?? null,
          expansion_name: line.expansionName ?? null,
          name: line.displayName,
          collector_number: line.collectorNumber,
          image_url: line.imageUrl ?? null,
          candidates: [],
        },
      })),
    };
  }
  const quoteLines = args.quoteLines ?? [];
  const results = args.results ?? [];
  return {
    source: "whatsapp",
    raw_paste: args.rawPaste,
    lines: quoteLines.map((q, i) => ({
      name: q.name,
      expansion: q.expansion,
      collector_number: q.collectorNumber,
      language_label: q.languageLabel,
      condition_label: q.conditionLabel,
      resolve: results[i] ?? { status: "not_found" },
    })),
  };
}

export function mapQuoteSessionToPedidoLines(
  session: QuoteSessionDetail,
): ParsedPedidoLine[] {
  return (session.lines ?? []).map((row, i) => {
    const index = typeof row.index === "number" ? row.index : i;
    const resolve = row.resolve ?? {};
    const status =
      resolve.status === "matched" ||
      resolve.status === "ambiguous" ||
      resolve.status === "not_found"
        ? resolve.status
        : "not_found";
    const selected = asCandidate(row.selected_blueprint);
    const resolvedId =
      typeof resolve.blueprint_id === "number" && resolve.blueprint_id > 0
        ? resolve.blueprint_id
        : 0;
    const blueprintId = selected?.blueprintId ?? (status === "matched" ? resolvedId : 0);
    const candidates = (resolve.candidates ?? [])
      .map((c) => asCandidate(c))
      .filter((c): c is PedidoQuoteCandidate => c != null);
    const notes = [
      row.expansion,
      row.collector_number ? `#${row.collector_number}` : "",
      row.language_label,
      row.condition_label,
    ]
      .filter(Boolean)
      .join(" · ");
    return {
      id: `session-${session.id}-${index}`,
      lineNumber: index + 1,
      quantity: 1,
      blueprintId,
      slug: "",
      displayName: String(selected?.name || resolve.name || row.name || "").trim(),
      url: "",
      clientNotes: notes,
      maxUsdHint: null,
      source: session.source === "urls" ? "url" : "quote",
      resolveStatus: status,
      expansionId:
        selected?.expansionId ??
        (typeof resolve.expansion_id === "number" ? resolve.expansion_id : undefined),
      expansionName: String(
        selected?.expansionName || resolve.expansion_name || row.expansion || "",
      ).trim(),
      collectorNumber: String(
        selected?.collectorNumber || resolve.collector_number || row.collector_number || "",
      ).trim(),
      pokemonLanguage: resolve.pokemon_language ?? null,
      conditionFilter: resolve.condition ?? null,
      imageUrl: selected?.imageUrl ?? resolve.image_url ?? null,
      candidates,
      selectedCandidate: selected,
      resolvedBlueprintId: resolvedId > 0 ? resolvedId : undefined,
    };
  });
}
