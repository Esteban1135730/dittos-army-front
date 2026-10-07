import Pagination from "@mui/material/Pagination";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CardThumb } from "../../components/card-thumb";
import { operationalRarezaLabel } from "../../constants/item-rareza";
import { collectTcgdexIdsFromLines, useTcgdexCardDetails } from "../../pokemon";
import { resolveTransitCatalogImageSrc } from "../cardtrader-transit/cardtrader-transit-catalog-image";
import type { HistorialVariantRow } from "./cardtrader-orders-historial.types";
import { extractAxiosErrorMessage } from "../clientes/extract-axios-error";
import { useOrdersHistorial, useOrdersHistorialEvents } from "./use-orders-historial";

function defaultRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to);
  from.setFullYear(from.getFullYear() - 1);
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { from: fmt(from), to: fmt(to) };
}

function formatEventDate(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return iso;
  return new Date(t).toLocaleString("es-CO", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function VariantEventsPanel(props: {
  row: HistorialVariantRow;
  from: string;
  to: string;
  orderAs: "buyer" | "seller" | "all";
  owner: string;
}) {
  const { data: events = [], isLoading } = useOrdersHistorialEvents(
    props.row.variant_key,
    {
      from: props.from,
      to: props.to,
      orderAs: props.orderAs,
      owner: props.owner,
    },
  );

  if (isLoading) {
    return <p className="text-xs text-gray-500 py-2">Cargando historial…</p>;
  }
  if (events.length === 0) {
    return <p className="text-xs text-gray-500 py-2">Sin eventos en el rango.</p>;
  }

  return (
    <ul className="mt-2 space-y-1.5 text-left text-xs text-gray-700 border-t border-gray-100 pt-2">
      {events.map((ev, i) => (
        <li key={`${ev.kind}-${ev.at}-${i}`} className="flex gap-2">
          <span className="text-gray-500 shrink-0 w-28">{formatEventDate(ev.at)}</span>
          <span className="flex-1">
            {ev.label}
            {ev.quantity > 1 ? ` ×${ev.quantity}` : ""}
          </span>
        </li>
      ))}
    </ul>
  );
}

export default function CardtraderOrdersHistorialPage() {
  const initial = useMemo(() => defaultRange(), []);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [orderAs, setOrderAs] = useState<"buyer" | "seller" | "all">("all");
  const [owner, setOwner] = useState("all");
  const [q, setQ] = useState("");
  const [appliedQ, setAppliedQ] = useState("");
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data, isLoading, error, isFetching } = useOrdersHistorial({
    from,
    to,
    orderAs,
    owner,
    q: appliedQ,
    page,
  });

  const rows = data?.rows ?? [];
  const cardIds = useMemo(
    () => collectTcgdexIdsFromLines(rows.map((r) => ({ card_id: r.card_id }))),
    [rows],
  );
  const { detailsByCardId, isLoading: tcgLoading } = useTcgdexCardDetails(cardIds);

  const pageCount = Math.max(1, Math.ceil((data?.total ?? 0) / 50));

  const applySearch = () => {
    setAppliedQ(q);
    setPage(1);
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            CardTrader — historial compras y ventas
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Consolida pedidos CT con inventario, tránsito, reservas y ventas locales (por variante
            TCGdex).
          </p>
        </div>
        <Link
          to="/cardtrader-transit"
          className="text-sm text-purple-700 hover:underline"
        >
          ← Tránsito CardTrader
        </Link>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4 flex flex-wrap gap-3 items-end">
        <label className="text-sm">
          <span className="block text-gray-600 mb-1">Desde</span>
          <input
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(1);
            }}
            className="border rounded px-2 py-1"
          />
        </label>
        <label className="text-sm">
          <span className="block text-gray-600 mb-1">Hasta</span>
          <input
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(1);
            }}
            className="border rounded px-2 py-1"
          />
        </label>
        <label className="text-sm">
          <span className="block text-gray-600 mb-1">Pedidos CT</span>
          <select
            value={orderAs}
            onChange={(e) => {
              setOrderAs(e.target.value as typeof orderAs);
              setPage(1);
            }}
            className="border rounded px-2 py-1"
          >
            <option value="all">Compras y ventas</option>
            <option value="buyer">Solo compras</option>
            <option value="seller">Solo ventas CT</option>
          </select>
        </label>
        <div className="text-sm">
          <span className="block text-gray-600 mb-1">Dueño (inventario / tránsito)</span>
          <div className="flex flex-wrap gap-1">
            {(
              [
                { value: "all", label: "Todos" },
                { value: "pablo", label: "Pablo" },
                { value: "esteban", label: "Esteban" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  setOwner(opt.value);
                  setPage(1);
                }}
                className={`px-3 py-1 rounded-full text-sm border ${
                  owner === opt.value
                    ? "bg-purple-700 text-white border-purple-700"
                    : "bg-white border-gray-300"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <label className="text-sm flex-1 min-w-[200px]">
          <span className="block text-gray-600 mb-1">Buscar</span>
          <div className="flex gap-2">
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applySearch()}
              placeholder="Nombre o card_id"
              className="border rounded px-2 py-1 flex-1"
            />
            <button
              type="button"
              onClick={applySearch}
              className="bg-purple-700 text-white px-3 py-1 rounded text-sm"
            >
              Buscar
            </button>
          </div>
        </label>
      </div>

      {data?.meta ? (
        <div className="text-xs text-gray-600 mb-3 space-y-1">
          <p>
            Pedidos CT leídos: compras {data.meta.ct_orders_scanned.buyer}, ventas{" "}
            {data.meta.ct_orders_scanned.seller}.
            {data.meta.unresolved_ct_items > 0
              ? ` ${data.meta.unresolved_ct_items} uds sin TCGdex.`
              : null}
          </p>
          {data.meta.partial_ct_fetch ? (
            <p className="text-amber-700">
              No se pudieron leer todos los pedidos CardTrader; los totales CT pueden estar
              incompletos. Datos locales siguen visibles.
            </p>
          ) : null}
          {data.meta.tcgdex_resolve_capped ? (
            <p className="text-amber-700">
              Homologación TCGdex limitada por volumen; algunas líneas CT pueden aparecer sin
              agrupar por carta.
            </p>
          ) : null}
        </div>
      ) : null}

      {isLoading ? (
        <p className="text-gray-600">Construyendo historial… (puede tardar la primera vez)</p>
      ) : null}
      {error ? (
        <p className="text-red-600">
          {extractAxiosErrorMessage(
            error,
            "Error cargando historial. Comprueba que el backend esté en marcha (puerto 3000), recarga tras ~2 min si es la primera carga, y revisa el token CardTrader en el servidor.",
          )}
        </p>
      ) : null}

      {!isLoading && !error && rows.length === 0 ? (
        <p className="text-gray-600">No hay variantes en el rango / filtros.</p>
      ) : null}

      {rows.length > 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-gray-50 text-[10px] font-semibold text-gray-600 uppercase">
            <div className="col-span-4">Carta</div>
            <div className="col-span-1 text-center">CT+</div>
            <div className="col-span-1 text-center">CT−</div>
            <div className="col-span-1 text-center">Tráns.</div>
            <div className="col-span-1 text-center">Stock</div>
            <div className="col-span-1 text-center">Res.</div>
            <div className="col-span-2">Vendido local</div>
            <div className="col-span-1" />
          </div>
          <div className="divide-y divide-gray-100">
            {rows.map((row) => {
              const imageSrc = resolveTransitCatalogImageSrc(
                row.card_id,
                row.image_url,
                detailsByCardId,
                row.language,
              );
              const open = expanded === row.variant_key;
              return (
                <div key={row.variant_key} className="px-3 py-2">
                  <div className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-4 flex gap-2 min-w-0 items-center">
                      <CardThumb
                        src={imageSrc || undefined}
                        alt={row.card_name}
                        size="sm"
                        pending={tcgLoading && !imageSrc}
                      />
                      <div className="min-w-0">
                        <p className="font-medium text-sm text-gray-900 truncate">
                          {row.card_name}
                          {row.flags.in_reserva_now ? (
                            <span className="ml-2 inline-flex rounded-full bg-amber-100 text-amber-900 px-2 py-0.5 text-[10px] font-semibold">
                              En reserva
                            </span>
                          ) : null}
                        </p>
                        <p className="text-[11px] text-gray-500 truncate">
                          {row.card_id} · {row.language.toUpperCase()}
                          {row.rareza
                            ? ` · ${operationalRarezaLabel(row.rareza) ?? row.rareza}`
                            : ""}
                        </p>
                      </div>
                    </div>
                    <div className="col-span-1 text-center text-sm">{row.qty_ct_buy}</div>
                    <div className="col-span-1 text-center text-sm">{row.qty_ct_sell}</div>
                    <div className="col-span-1 text-center text-sm">{row.qty_transit}</div>
                    <div className="col-span-1 text-center text-sm">
                      {row.qty_stock_sellable}
                    </div>
                    <div className="col-span-1 text-center text-sm">{row.qty_reserved}</div>
                    <div className="col-span-2 text-xs text-gray-700">
                      <span className="font-semibold">{row.qty_sold_local}</span> uds
                      {row.last_sold_local_at ? (
                        <span className="block text-gray-500">
                          Última: {formatEventDate(row.last_sold_local_at)}
                        </span>
                      ) : null}
                    </div>
                    <div className="col-span-1 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          setExpanded(open ? null : row.variant_key)
                        }
                        className="text-xs text-blue-600 hover:underline"
                      >
                        {open ? "Ocultar" : "Historial"}
                      </button>
                    </div>
                  </div>
                  {open ? (
                    <VariantEventsPanel
                      row={row}
                      from={from}
                      to={to}
                      orderAs={orderAs}
                      owner={owner}
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {pageCount > 1 ? (
        <div className="flex justify-center pt-4">
          <Pagination
            count={pageCount}
            page={page}
            onChange={(_e, v) => setPage(v)}
            color="primary"
            disabled={isFetching}
          />
        </div>
      ) : null}
    </div>
  );
}
