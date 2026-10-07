import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import Pagination from "@mui/material/Pagination";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CardThumb } from "../../components/card-thumb";
import { apiBase } from "../../config/api";
import { OWNERS_CONFIG, isOwnerKey } from "../../config/owners";
import { useTcgdexCardDetails } from "../../pokemon";
import { formatCOP } from "../../utils/convert";
import {
  filterTransitCatalogGroups,
  groupTransitCatalogByCard,
  totalCostCop,
  totalRemainingQty,
  uniqueLanguagesFromGroups,
  uniqueRarezasFromGroups,
} from "./cardtrader-transit-catalog-group";
import { resolveTransitCatalogImageSrc } from "./cardtrader-transit-catalog-image";
import { downloadTransitCatalogPdf } from "./cardtrader-transit-catalog-pdf";
import type { CardtraderTransitCatalogLine } from "./cardtrader-transit-types";
import {
  fetchOpenTransitCatalog,
  type TransitOwnerFilter,
} from "./transit-owner-filter";

const PAGE_SIZE = 24;

type Props = {
  ownerFilter?: TransitOwnerFilter;
};

export function CardtraderTransitByCardPanel({ ownerFilter = "all" }: Props) {
  const [text, setText] = useState("");
  const [language, setLanguage] = useState("");
  const [rareza, setRareza] = useState("");
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [exporting, setExporting] = useState(false);
  const [mensaje, setMensaje] = useState("");

  const { data, isLoading, error } = useQuery<CardtraderTransitCatalogLine[]>({
    queryKey: ["cardtrader-transit-open-catalog", ownerFilter],
    queryFn: () => fetchOpenTransitCatalog(ownerFilter),
  });

  const lines = useMemo(() => data ?? [], [data]);
  const allGroups = useMemo(() => groupTransitCatalogByCard(lines), [lines]);
  const cardIds = useMemo(() => allGroups.map((g) => g.card_id), [allGroups]);
  const { detailsByCardId } = useTcgdexCardDetails(cardIds);
  const filtered = useMemo(
    () => filterTransitCatalogGroups(allGroups, { text, language, rareza }),
    [allGroups, text, language, rareza],
  );
  const languages = useMemo(() => uniqueLanguagesFromGroups(allGroups), [allGroups]);
  const rarezas = useMemo(() => uniqueRarezasFromGroups(allGroups), [allGroups]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageSafe = Math.min(page, pageCount);
  const pageItems = useMemo(() => {
    const start = (pageSafe - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, pageSafe]);

  useEffect(() => {
    setPage(1);
  }, [text, language, rareza]);

  const toggle = (key: string) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleExportPdf = async () => {
    if (filtered.length === 0) return;
    setExporting(true);
    setMensaje("");
    try {
      const groupsWithImages = filtered.map((g) => ({
        ...g,
        image_url: resolveTransitCatalogImageSrc(
          g.card_id,
          g.image_url,
          detailsByCardId,
          g.language,
        ),
      }));
      const { imageFailures } = await downloadTransitCatalogPdf({
        groups: groupsWithImages,
        apiBase: apiBase(),
        title: "Cartas en tránsito",
      });
      setMensaje(
        imageFailures > 0
          ? `✅ PDF descargado (${imageFailures} imagen${imageFailures === 1 ? "" : "es"} sin cargar).`
          : "✅ PDF descargado.",
      );
    } catch (e: unknown) {
      setMensaje(e instanceof Error ? e.message : "No se pudo generar el PDF.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <label className="flex flex-col gap-1 text-sm text-gray-700 flex-1 min-w-[12rem]">
          <span className="font-medium">Buscar</span>
          <input
            type="search"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Nombre, set, #, card id…"
            className="border border-gray-300 rounded-md px-3 py-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-gray-700 w-full sm:w-36">
          <span className="font-medium">Idioma</span>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="">Todos</option>
            {languages.map((lang) => (
              <option key={lang} value={lang}>
                {lang.toUpperCase()}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-gray-700 w-full sm:w-40">
          <span className="font-medium">Rareza</span>
          <select
            value={rareza}
            onChange={(e) => setRareza(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm"
            disabled={rarezas.length === 0}
          >
            <option value="">Todas</option>
            {rarezas.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => void handleExportPdf()}
          disabled={exporting || filtered.length === 0}
          className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {exporting ? "Generando PDF…" : "Exportar PDF"}
        </button>
      </div>

      <p className="text-sm text-gray-600">
        {filtered.length} carta{filtered.length === 1 ? "" : "s"} ·{" "}
        {totalRemainingQty(filtered)} unidad{totalRemainingQty(filtered) === 1 ? "" : "es"} restante
        {totalRemainingQty(filtered) === 1 ? "" : "s"} · costo {formatCOP(totalCostCop(filtered))}
        {filtered.length > 0 ? (
          <span className="text-gray-500">
            {" "}
            · página {pageSafe}/{pageCount}
          </span>
        ) : null}
      </p>

      {mensaje ? (
        <p
          className="text-sm"
          style={{ color: mensaje.startsWith("✅") ? "#0f766e" : "#b91c1c" }}
        >
          {mensaje}
        </p>
      ) : null}

      {isLoading && <p className="text-gray-600">Cargando cartas en tránsito…</p>}
      {!isLoading && error && (
        <p className="text-red-600">Error cargando catálogo. Intenta más tarde.</p>
      )}
      {!isLoading && !error && allGroups.length === 0 && (
        <p className="text-gray-600">
          No hay unidades restantes en tránsito. Lo ya recibido no aparece aquí.
        </p>
      )}
      {!isLoading && !error && allGroups.length > 0 && filtered.length === 0 && (
        <p className="text-gray-600">Ninguna carta coincide con los filtros.</p>
      )}

      {pageItems.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {pageItems.map((group) => {
            const open = !!expanded[group.key];
            const imageSrc = resolveTransitCatalogImageSrc(
              group.card_id,
              group.image_url,
              detailsByCardId,
              group.language,
            );
            return (
              <div
                key={group.key}
                className="bg-white rounded-lg border border-gray-200 p-3 flex flex-col items-center text-center gap-2 min-w-0"
              >
                <CardThumb
                  src={imageSrc || undefined}
                  alt={group.card_name}
                  size="xl"
                  enlargeOnHover={!!imageSrc}
                />
                <div className="w-full min-w-0 space-y-1">
                  <p className="font-medium text-gray-900 text-sm leading-snug line-clamp-2">
                    {group.card_name}
                  </p>
                  <p className="text-[11px] text-gray-500 truncate" title={group.card_id}>
                    {group.card_id}
                  </p>
                  <p className="text-xs text-gray-600 line-clamp-2">
                    {[
                      group.expansion,
                      group.collector_number ? `#${group.collector_number}` : null,
                      group.language?.toUpperCase(),
                      group.rareza,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  <p className="text-sm text-gray-800">
                    <span className="font-semibold">{group.remaining_quantity}</span> restante
                    {group.remaining_quantity === 1 ? "" : "s"}
                  </p>
                  <p className="text-xs text-gray-600">
                    {formatCOP(group.unit_cost_cop)} / u
                    <span className="block">{formatCOP(group.total_cost_cop)} total</span>
                  </p>
                  <button
                    type="button"
                    onClick={() => toggle(group.key)}
                    className="mt-1 text-xs text-blue-600 hover:underline"
                  >
                    {open
                      ? "Ocultar lotes"
                      : `${group.lots.length} lote${group.lots.length === 1 ? "" : "s"}`}
                  </button>
                  {open ? (
                    <ul className="mt-1 space-y-1.5 text-left text-xs text-gray-700 border-t border-gray-100 pt-2 w-full">
                      {group.lots.map((lot) => {
                        const ownerKey = isOwnerKey(lot.owner) ? lot.owner : "pablo";
                        return (
                          <li key={lot.transit_line_id} className="space-y-0.5">
                            <Link
                              to={`/cardtrader-transit/lot/${lot.transit_lot_id}?owner=${encodeURIComponent(ownerKey)}`}
                              className="text-blue-600 hover:underline font-medium"
                            >
                              {new Date(lot.purchase_date).toLocaleDateString("es-CO")}
                            </Link>
                            <div>
                              {lot.remaining_quantity} u · {formatCOP(lot.unit_cost_cop)}
                            </div>
                            <span
                              className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                                ownerKey === "esteban"
                                  ? "bg-indigo-100 text-indigo-800"
                                  : "bg-slate-100 text-slate-800"
                              }`}
                            >
                              {OWNERS_CONFIG.owners[ownerKey].label}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {filtered.length > PAGE_SIZE ? (
        <div className="flex justify-center pt-2">
          <Pagination
            count={pageCount}
            page={pageSafe}
            onChange={(_e, value) => setPage(value)}
            color="primary"
            size="medium"
            showFirstButton
            showLastButton
          />
        </div>
      ) : null}
    </div>
  );
}
