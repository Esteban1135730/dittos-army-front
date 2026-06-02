import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import {
  OPERATIONAL_RAREZA_VALUES,
  operationalRarezaLabel,
} from "../../../constants/item-rareza";

import { API_BASE as API } from "../../../config/api";

export type CartaBusquedaDirecta = {
  id: string;
  localId: string;
  name: string;
  image: string;
};

type LoteLine = {
  key: string;
  card_id: string;
  card_name: string;
  image_url: string;
  language: string;
  operationalRareza: string;
  /** Ejemplares idénticos (≥ 1). */
  quantity: number;
};

/** Vacío o inválido → defaultVal; máximo razonable para no disparar payloads enormes. */
function parsePositiveInt(raw: string, defaultVal: number): number {
  const t = String(raw).trim();
  if (t === "") return defaultVal;
  const n = parseInt(t, 10);
  if (!Number.isFinite(n) || n < 1) return defaultVal;
  return Math.min(n, 9999);
}

function allocatePreview(assignableCop: number, n: number): number[] {
  if (n <= 0) return [];
  const base = Math.floor(assignableCop / n);
  const remainder = assignableCop - base * n;
  return Array.from(
    { length: n },
    (_, i) => base + (i < remainder ? 1 : 0),
  );
}

export default function AperturaSelladoPage() {
  const [productCost, setProductCost] = useState<number>(0);
  const [sourceLabel, setSourceLabel] = useState("");
  const [nonStockPercent, setNonStockPercent] = useState(30);
  const [lote, setLote] = useState<LoteLine[]>([]);

  const [nombreCarta, setNombreCarta] = useState("");
  const [resultadosCarta, setResultadosCarta] = useState<CartaBusquedaDirecta[]>(
    [],
  );
  const [buscando, setBuscando] = useState(false);
  const [errorBusqueda, setErrorBusqueda] = useState("");

  const [pickCarta, setPickCarta] = useState<CartaBusquedaDirecta | null>(
    null,
  );
  const [pickLang, setPickLang] = useState("");
  const [pickRareza, setPickRareza] = useState("");
  const [pickQty, setPickQty] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  const nonStockFraction = nonStockPercent / 100;
  const assignablePreview = useMemo(() => {
    const pc = Math.max(0, Math.floor(productCost));
    return Math.round(pc * (1 - nonStockFraction));
  }, [productCost, nonStockFraction]);

  const totalCartasFisicas = useMemo(
    () =>
      lote.reduce(
        (sum, line) =>
          sum + Math.max(1, Math.floor(line.quantity) || 1),
        0,
      ),
    [lote],
  );

  const previewCosts = useMemo(
    () => allocatePreview(assignablePreview, totalCartasFisicas),
    [assignablePreview, totalCartasFisicas],
  );

  const previewCostsPorLinea = useMemo(() => {
    let offset = 0;
    return lote.map((line) => {
      const qty = Math.max(1, Math.floor(line.quantity) || 1);
      const slice = previewCosts.slice(offset, offset + qty);
      offset += qty;
      return slice;
    });
  }, [lote, previewCosts]);

  const buscarCartaPorNombre = async () => {
    if (!nombreCarta.trim()) return;
    setBuscando(true);
    setErrorBusqueda("");
    try {
      const res = await axios.get<CartaBusquedaDirecta[]>(
        `${API}/tcg-dex/card/search/${encodeURIComponent(nombreCarta)}`,
      );
      const data = res.data;
      if (Array.isArray(data) && data.length > 0) {
        setResultadosCarta(data);
      } else {
        setResultadosCarta([]);
        setErrorBusqueda("No se encontraron cartas.");
      }
    } catch {
      setErrorBusqueda("Error al buscar la carta.");
      setResultadosCarta([]);
    } finally {
      setBuscando(false);
    }
  };

  const abrirModal = (carta: CartaBusquedaDirecta) => {
    setPickCarta(carta);
    setPickLang("");
    setPickRareza("");
    setPickQty("");
    setModalOpen(true);
  };

  const agregarAlLote = () => {
    if (!pickCarta || !pickLang) return;
    const quantity = parsePositiveInt(pickQty, 1);
    const key = `${pickCarta.id}-${crypto.randomUUID()}`;
    setLote((prev) => [
      ...prev,
      {
        key,
        card_id: pickCarta.id,
        card_name: pickCarta.name,
        image_url: pickCarta.image ?? "",
        language: pickLang,
        operationalRareza: pickRareza,
        quantity,
      },
    ]);
    setModalOpen(false);
    setPickCarta(null);
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const pc = Math.floor(productCost);
      if (pc <= 0) {
        throw new Error("Indica un costo del producto entero mayor a 0 (COP).");
      }
      if (lote.length === 0) {
        throw new Error("Añade al menos una carta al lote.");
      }
      const body = {
        product_cost_cop: pc,
        non_stock_fraction: nonStockFraction,
        source_label: sourceLabel.trim() || undefined,
        lines: lote.flatMap((line) => {
          const qty = Math.max(1, Math.floor(line.quantity) || 1);
          const rz = line.operationalRareza.trim();
          const build = (): Record<string, unknown> => {
            const base: Record<string, unknown> = {
              card_id: line.card_id,
              card_name: line.card_name,
              language: line.language,
              image_url: line.image_url,
            };
            if (rz !== "") {
              base.rareza = rz;
              base.holofoil = rz === "holofoil";
              base.league_card = rz === "league card";
            }
            return base;
          };
          return Array.from({ length: qty }, () => build());
        }),
      };
      try {
        const res = await axios.post(`${API}/stock/from-opened-sealed`, body);
        return res.data as {
          created_count: number;
          allocatable_total_cop: number;
          lines: { card_id: string; unity_cost_cop: number }[];
        };
      } catch (err: unknown) {
        if (axios.isAxiosError(err) && err.response?.data) {
          const d = err.response.data as { message?: string | string[] };
          const m = Array.isArray(d.message) ? d.message.join(", ") : d.message;
          throw new Error(m || err.message);
        }
        throw err;
      }
    },
  });

  const quitarLinea = (key: string) => {
    setLote((prev) => prev.filter((x) => x.key !== key));
  };

  return (
    <div className="max-w-4xl mx-auto mt-10 bg-white shadow-lg rounded-xl p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-2">
        Apertura producto sellado
      </h1>
      <p className="text-gray-600 text-sm mb-6">
        El costo del producto se reparte en el{" "}
        <strong>{100 - nonStockPercent}%</strong> entre todas las cartas del
        lote (el resto no entra como costo de inventario). Las líneas se crean
        en COP con estado disponible.
      </p>

      <div className="grid gap-4 md:grid-cols-2 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Costo del producto (COP, entero)
          </label>
          <input
            type="number"
            min={0}
            step={1}
            value={productCost || ""}
            onChange={(e) => setProductCost(parseInt(e.target.value, 10) || 0)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            % no inventariable (personal / merma)
          </label>
          <input
            type="number"
            min={0}
            max={99}
            step={1}
            value={nonStockPercent}
            onChange={(e) =>
              setNonStockPercent(
                Math.min(99, Math.max(0, parseInt(e.target.value, 10) || 0)),
              )
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Etiqueta opcional (referencia del sobre, set…)
          </label>
          <input
            type="text"
            value={sourceLabel}
            onChange={(e) => setSourceLabel(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            placeholder="Ej. SV4 — caja 12 sobres"
          />
        </div>
      </div>

      {lote.length > 0 && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-100 rounded-lg">
          <p className="font-medium text-blue-900">
            Total asignable al stock:{" "}
            <strong>{assignablePreview.toLocaleString("es-CO")} COP</strong> ·{" "}
            {totalCartasFisicas} cartas · costo por carta (orden):{" "}
            {previewCosts.join(", ")}{" "}
            COP
          </p>
        </div>
      )}

      <h2 className="text-lg font-semibold text-gray-800 mb-3">
        Buscar cartas (nombre)
      </h2>
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={nombreCarta}
          onChange={(e) => setNombreCarta(e.target.value)}
          placeholder="Ej. Pikachu"
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
          onKeyDown={(e) => e.key === "Enter" && buscarCartaPorNombre()}
        />
        <button
          type="button"
          onClick={buscarCartaPorNombre}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
          disabled={buscando}
        >
          {buscando ? "Buscando…" : "Buscar"}
        </button>
      </div>
      {errorBusqueda && (
        <p className="text-red-600 text-sm mb-4">{errorBusqueda}</p>
      )}

      {resultadosCarta.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {resultadosCarta.map((carta) => (
            <button
              type="button"
              key={carta.id}
              onClick={() => abrirModal(carta)}
              className="border rounded-lg p-2 text-left hover:shadow-md transition border-gray-200"
            >
              <img
                src={carta.image}
                alt={carta.name}
                className="w-full h-32 object-contain mb-2"
              />
              <p className="text-xs font-medium line-clamp-2">{carta.name}</p>
            </button>
          ))}
        </div>
      )}

      <h2 className="text-lg font-semibold text-gray-800 mb-3">
        Lote ({lote.length} ítems · {totalCartasFisicas} cartas)
      </h2>
      {lote.length === 0 ? (
        <p className="text-gray-500 text-sm mb-4">
          Aún no hay cartas. Busca y añade cada carta con idioma y variante.
        </p>
      ) : (
        <ul className="divide-y border rounded-lg mb-6">
          {lote.map((line, idx) => (
            <li
              key={line.key}
              className="flex items-center gap-3 p-3 text-sm"
            >
              <span className="text-gray-400 w-6">{idx + 1}</span>
              {line.image_url ? (
                <img
                  src={line.image_url}
                  alt=""
                  className="w-10 h-14 object-contain"
                />
              ) : (
                <div className="w-10 h-14 bg-gray-100 rounded shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">
                  {line.card_name}
                  {line.quantity > 1 ? (
                    <span className="text-gray-600 font-normal">
                      {" "}
                      ×{line.quantity}
                    </span>
                  ) : null}
                </div>
                <div className="text-gray-600">
                  {line.language}
                  {line.operationalRareza
                    ? ` · ${operationalRarezaLabel(line.operationalRareza)}`
                    : ""}
                </div>
              </div>
              <div className="text-right tabular-nums text-gray-700 max-w-[min(100%,14rem)]">
                {previewCostsPorLinea[idx]?.length
                  ? previewCostsPorLinea[idx].join(", ") + " COP"
                  : "—"}
              </div>
              <button
                type="button"
                onClick={() => quitarLinea(line.key)}
                className="text-red-600 hover:underline"
              >
                Quitar
              </button>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending || lote.length === 0}
        className="px-6 py-3 bg-green-600 text-white rounded-lg font-medium disabled:opacity-50"
      >
        {mutation.isPending ? "Guardando…" : "Crear líneas de stock"}
      </button>

      {mutation.isError && (
        <p className="mt-4 text-red-600 text-sm">
          {(mutation.error as Error)?.message ||
            "Error al crear stock. Revisa datos o consola."}
        </p>
      )}
      {mutation.isSuccess && mutation.data && (
        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-900">
          <p className="font-medium">
            Creadas {mutation.data.created_count} líneas. Total asignado:{" "}
            {mutation.data.allocatable_total_cop.toLocaleString("es-CO")} COP.
          </p>
          <ul className="mt-2 text-sm list-disc list-inside">
            {mutation.data.lines.map((row, i) => (
              <li key={`${row.card_id}-${i}-${row.unity_cost_cop}`}>
                {row.card_id}: {row.unity_cost_cop} COP
              </li>
            ))}
          </ul>
        </div>
      )}

      {modalOpen && pickCarta && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={(e) => e.target === e.currentTarget && setModalOpen(false)}
        >
          <div
            className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold mb-4">{pickCarta.name}</h3>
            <img
              src={pickCarta.image}
              alt=""
              className="w-48 mx-auto object-contain mb-4"
            />
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Idioma *
            </label>
            <select
              value={pickLang}
              onChange={(e) => setPickLang(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg mb-4"
            >
              <option value="">Selecciona</option>
              <option value="es">Español</option>
              <option value="en">Inglés</option>
              <option value="fr">Francés</option>
              <option value="de">Alemán</option>
              <option value="it">Italiano</option>
              <option value="pt">Portugués</option>
              <option value="ja">Japonés</option>
              <option value="ko">Coreano</option>
              <option value="zh">Chino</option>
              <option value="otro">Otro</option>
            </select>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Variante (rareza)
            </label>
            <select
              value={pickRareza}
              onChange={(e) => setPickRareza(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg mb-4"
            >
              <option value="">Sin variante</option>
              {OPERATIONAL_RAREZA_VALUES.map((v) => (
                <option key={v} value={v}>
                  {operationalRarezaLabel(v)}
                </option>
              ))}
            </select>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cantidad
            </label>
            <input
              type="number"
              min={1}
              step={1}
              inputMode="numeric"
              value={pickQty}
              onChange={(e) => setPickQty(e.target.value)}
              placeholder="1"
              className="w-full px-3 py-2 border rounded-lg mb-6"
            />
            <p className="text-xs text-gray-500 mb-4 -mt-2">
              Cantidad de ejemplares iguales (idioma y variante). Vacío = 1.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                className="px-4 py-2 rounded-lg bg-gray-200"
                onClick={() => setModalOpen(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="px-4 py-2 rounded-lg bg-blue-600 text-white disabled:opacity-50"
                onClick={agregarAlLote}
                disabled={!pickLang}
              >
                Añadir al lote
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
