import { Button } from "@mui/material";
import { ReviewItemMeta } from "./review-item-meta";
import type { StockReviewItem, StockReviewOutcome } from "./types";

const OUTCOME_LABELS: Record<StockReviewOutcome, string> = {
  en_stock: "Aún en stock",
  perdida: "Perdida",
  propiedad: "Propiedad",
  vendida: "Vendida",
};

type ResolutionItemRowProps = {
  item: StockReviewItem;
  busy: boolean;
  onResolve: (outcome: StockReviewOutcome) => void;
  onPropiedad: () => void;
};

export function outcomeLabel(outcome: StockReviewOutcome): string {
  return OUTCOME_LABELS[outcome];
}

export function ResolutionItemRow({
  item,
  busy,
  onResolve,
  onPropiedad,
}: ResolutionItemRowProps) {
  const resolved = item.outcome != null;
  const verifiedOnly = item.verified && !resolved;

  let rowClass = "bg-white border-gray-200";
  let outcomeClass = "text-gray-800";
  if (verifiedOnly) rowClass = "bg-green-50 border-green-200";
  else if (resolved && item.outcome) {
    switch (item.outcome) {
      case "perdida":
        rowClass = "bg-amber-50 border-amber-300";
        outcomeClass = "text-amber-900";
        break;
      case "vendida":
        rowClass = "bg-blue-50 border-blue-300";
        outcomeClass = "text-blue-900";
        break;
      case "propiedad":
        rowClass = "bg-indigo-50 border-indigo-300";
        outcomeClass = "text-indigo-900";
        break;
      case "en_stock":
        rowClass = "bg-slate-50 border-slate-300";
        outcomeClass = "text-slate-800";
        break;
      default:
        rowClass = "bg-gray-50 border-gray-200";
    }
  }

  return (
    <div
      className={`flex flex-wrap items-center gap-3 p-3 rounded-lg border ${rowClass}`}
    >
      {item.image_url ? (
        <img src={item.image_url} alt="" className="w-12 h-auto rounded" />
      ) : (
        <div className="w-12 h-16 bg-gray-200 rounded" />
      )}
      <div className="flex-1 min-w-[160px]">
        <p className="font-medium text-gray-900">
          {item.card_name || item.card_id}
        </p>
        <ReviewItemMeta
          language={item.language}
          rareza={item.rareza}
          cardState={item.card_state}
        />
      </div>
      <div className="flex gap-2 flex-wrap justify-end">
        {verifiedOnly && (
          <span className="text-sm text-green-700 font-medium self-center">
            Verificada en stock ✓
          </span>
        )}
        {busy && !resolved && (
          <span className="text-sm text-gray-500 self-center">Guardando…</span>
        )}
        {resolved && item.outcome && (
          <span
            className={`text-sm font-semibold self-center px-2 py-1 rounded border ${outcomeClass}`}
          >
            {outcomeLabel(item.outcome)}
          </span>
        )}
        {!verifiedOnly && !resolved && !busy && (
          <>
            <Button
              size="small"
              color="inherit"
              variant="outlined"
              disabled={busy}
              onClick={() => onResolve("en_stock")}
            >
              Aún en stock
            </Button>
            <Button
              size="small"
              color="warning"
              variant="outlined"
              disabled={busy}
              onClick={() => onResolve("perdida")}
            >
              Perdida
            </Button>
            <Button
              size="small"
              color="info"
              variant="outlined"
              disabled={busy}
              onClick={onPropiedad}
            >
              Propiedad
            </Button>
            <Button
              size="small"
              color="success"
              variant="contained"
              disabled={busy}
              onClick={() => onResolve("vendida")}
            >
              Vendida
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
