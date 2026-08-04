import { useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from "@mui/material";
import { formatCOP } from "../../../utils/convert";
import { useExchangeRates } from "../../../utils/tasa";
import type { StockListItem } from "../../../types/stock";
import { API_BASE, apiUrl } from "../../../config/api";

type KeepSale = {
  _id: string;
  stock_id: string;
  card_id: string;
  amount_cop: number;
  notes?: string;
  created_at: string;
};

type StockItem = Pick<
  StockListItem,
  "_id" | "card_name" | "image_url" | "card_cost" | "currency" | "card_state"
>;

type SortKey = "fecha" | "nombre" | "costo";

function costInCop(
  stock: StockItem | undefined,
  convert: {
    toCopFromEur: (n: number) => number | null;
    toCopFromUsd: (n: number) => number | null;
  },
): number {
  if (!stock?.card_cost) return 0;
  const moneda = stock.currency;
  if (moneda === "COP") return stock.card_cost;
  if (moneda === "EUR") return convert.toCopFromEur(stock.card_cost) ?? 0;
  if (moneda === "USD") return convert.toCopFromUsd(stock.card_cost) ?? 0;
  return 0;
}

export default function PropertyList() {
  const { convert } = useExchangeRates();
  const queryClient = useQueryClient();
  const [stockData, setStockData] = useState<Record<string, StockItem>>({});
  const [busqueda, setBusqueda] = useState("");
  const [orden, setOrden] = useState<SortKey>("fecha");

  const [deshaciendoId, setDeshaciendoId] = useState<string | null>(null);
  const [errorAccion, setErrorAccion] = useState("");

  const [deleteTarget, setDeleteTarget] = useState<KeepSale | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [deleteDeleting, setDeleteDeleting] = useState(false);

  const [notasTarget, setNotasTarget] = useState<KeepSale | null>(null);
  const [notasEditadas, setNotasEditadas] = useState("");
  const [notasError, setNotasError] = useState("");
  const [notasGuardando, setNotasGuardando] = useState(false);

  const { data: keepCards = [], isLoading } = useQuery<KeepSale[]>({
    queryKey: ["property-cards"],
    queryFn: async () => {
      const res = await axios.get(apiUrl("/sales/keep"));
      return res.data;
    },
  });

  useEffect(() => {
    const fetchStocks = async () => {
      const pendingIds = keepCards
        .map((sale) => sale.stock_id)
        .filter((id) => !stockData[id]);

      if (pendingIds.length === 0) return;

      try {
        const requests = pendingIds.map((id) =>
          axios.get(`${API_BASE}/stock/${id}`),
        );
        const responses = await Promise.allSettled(requests);
        const updated: Record<string, StockItem> = {};
        responses.forEach((res) => {
          if (res.status === "fulfilled" && res.value?.data?._id) {
            updated[res.value.data._id] = res.value.data;
          }
        });
        if (Object.keys(updated).length > 0) {
          setStockData((prev) => ({ ...prev, ...updated }));
        }
      } catch {
        console.log("No se pudo cargar información de algunas cartas.");
      }
    };

    if (keepCards.length > 0) {
      void fetchStocks();
    }
    // stockData omitido a propósito: solo cargar ids pendientes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keepCards]);

  const filasFiltradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    let rows = keepCards.filter((sale) => {
      if (!q) return true;
      const name =
        stockData[sale.stock_id]?.card_name?.toLowerCase() ??
        sale.card_id.toLowerCase();
      return name.includes(q);
    });

    rows = [...rows].sort((a, b) => {
      if (orden === "fecha") {
        return (
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      }
      if (orden === "nombre") {
        const na =
          stockData[a.stock_id]?.card_name?.toLowerCase() ?? a.card_id;
        const nb =
          stockData[b.stock_id]?.card_name?.toLowerCase() ?? b.card_id;
        return na.localeCompare(nb, "es");
      }
      // costo en COP convertido
      const ca = costInCop(stockData[a.stock_id], convert);
      const cb = costInCop(stockData[b.stock_id], convert);
      return cb - ca;
    });

    return rows;
  }, [keepCards, stockData, busqueda, orden, convert]);

  const valorInvertidoCOP = useMemo(() => {
    let total = 0;
    filasFiltradas.forEach((sale) => {
      total += costInCop(stockData[sale.stock_id], convert);
    });
    return total;
  }, [filasFiltradas, stockData, convert]);

  const invalidateProperty = async () => {
    await queryClient.invalidateQueries({ queryKey: ["property-cards"] });
    await queryClient.invalidateQueries({ queryKey: ["stock"] });
  };

  const handleDeshacer = async (sale: KeepSale) => {
    const name =
      stockData[sale.stock_id]?.card_name || sale.card_id;
    const confirmar = window.confirm(
      `¿Devolver «${name}» al inventario?\n\nLa carta saldrá de propiedad y quedará disponible en stock.`,
    );
    if (!confirmar) return;

    try {
      setDeshaciendoId(sale._id);
      setErrorAccion("");
      const res = await axios.delete<{ success: boolean; message?: string }>(
        apiUrl(`/sales/${sale._id}`),
      );
      if (res.data?.success === false) {
        setErrorAccion(
          res.data.message || "No se pudo devolver la carta al stock.",
        );
        return;
      }
      await invalidateProperty();
    } catch (error: unknown) {
      const msg =
        (error as { response?: { data?: { message?: string } } })?.response
          ?.data?.message ||
        "No se pudo devolver la carta al stock. Intenta más tarde.";
      setErrorAccion(msg);
    } finally {
      setDeshaciendoId(null);
    }
  };

  const handleOpenDelete = (sale: KeepSale) => {
    setDeleteTarget(sale);
    setDeleteError("");
  };

  const handleCloseDelete = () => {
    if (deleteDeleting) return;
    setDeleteTarget(null);
    setDeleteError("");
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleteDeleting(true);
      setDeleteError("");
      const res = await axios.delete<{ success: boolean; message?: string }>(
        apiUrl(`/sales/keep/${deleteTarget._id}`),
      );
      if (res.data?.success === false) {
        setDeleteError(
          res.data.message || "No se pudo eliminar la carta.",
        );
        return;
      }
      setDeleteTarget(null);
      await invalidateProperty();
    } catch (error: unknown) {
      const msg =
        (error as { response?: { data?: { message?: string } } })?.response
          ?.data?.message ||
        "No se pudo eliminar la carta. Intenta más tarde.";
      setDeleteError(msg);
    } finally {
      setDeleteDeleting(false);
    }
  };

  const handleOpenNotas = (sale: KeepSale) => {
    setNotasTarget(sale);
    setNotasEditadas(sale.notes ?? "");
    setNotasError("");
  };

  const handleCloseNotas = () => {
    if (notasGuardando) return;
    setNotasTarget(null);
    setNotasEditadas("");
    setNotasError("");
  };

  const handleGuardarNotas = async () => {
    if (!notasTarget) return;
    try {
      setNotasGuardando(true);
      setNotasError("");
      const res = await axios.put<{ success: boolean; message?: string }>(
        apiUrl(`/sales/${notasTarget._id}`),
        { notes: notasEditadas },
      );
      if (res.data?.success === false) {
        setNotasError(res.data.message || "No se pudieron guardar las notas.");
        return;
      }
      setNotasTarget(null);
      await invalidateProperty();
    } catch (error: unknown) {
      const msg =
        (error as { response?: { data?: { message?: string } } })?.response
          ?.data?.message ||
        "No se pudieron guardar las notas. Intenta más tarde.";
      setNotasError(msg);
    } finally {
      setNotasGuardando(false);
    }
  };

  if (isLoading) {
    return <p className="text-center text-gray-500">Cargando cartas...</p>;
  }

  const hayKeeps = keepCards.length > 0;
  const sinCoincidencias = hayKeeps && filasFiltradas.length === 0;

  return (
    <div className="max-w-5xl mx-auto mt-10 bg-white shadow rounded-lg p-6">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h1 className="text-2xl font-bold text-gray-800">
          Cartas marcadas como propiedad
        </h1>
        <p className="text-sm text-gray-500">
          {hayKeeps
            ? `Mostrando ${filasFiltradas.length} de ${keepCards.length} ${
                keepCards.length === 1 ? "carta" : "cartas"
              }`
            : "Total: 0 cartas"}
        </p>
      </div>

      {hayKeeps && (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[220px] max-w-md">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Buscar por nombre de carta…"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <svg
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                {busqueda && (
                  <button
                    type="button"
                    onClick={() => setBusqueda("")}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    aria-label="Limpiar búsqueda"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="orden-propiedad" className="text-sm text-gray-600">
                Orden:
              </label>
              <select
                id="orden-propiedad"
                value={orden}
                onChange={(e) => setOrden(e.target.value as SortKey)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="fecha">Fecha (más reciente)</option>
                <option value="nombre">Nombre (A–Z)</option>
                <option value="costo">Costo (mayor → menor)</option>
              </select>
            </div>
          </div>

          <div className="mb-6 p-4 rounded-lg border border-gray-200 bg-gray-50 shadow-sm">
            <p className="text-sm text-gray-600 mb-1">
              Valor invertido (filas visibles)
            </p>
            <p className="text-xl font-bold text-gray-800">
              {sinCoincidencias
                ? "—"
                : `COP ${formatCOP(valorInvertidoCOP.toFixed(0))}`}
            </p>
            {!sinCoincidencias && (
              <p className="text-xs text-gray-500 mt-1">
                EUR{" "}
                {convert.toEurFromCop(valorInvertidoCOP)?.toFixed(2) ?? "0.00"}{" "}
                / USD{" "}
                {convert.toUsdFromCop(valorInvertidoCOP)?.toFixed(2) ?? "0.00"}
              </p>
            )}
          </div>
        </>
      )}

      {errorAccion && (
        <p className="mb-4 text-sm text-red-600 text-center">{errorAccion}</p>
      )}

      {!hayKeeps ? (
        <p className="text-center text-gray-500">
          No tienes cartas marcadas como propiedad.
        </p>
      ) : sinCoincidencias ? (
        <p className="text-center text-gray-500">
          Ninguna carta coincide con «{busqueda.trim()}»
        </p>
      ) : (
        <div className="space-y-4">
          {filasFiltradas.map((sale) => {
            const stock = stockData[sale.stock_id];
            const cardName = stock?.card_name || sale.card_id;
            const busy =
              deshaciendoId === sale._id ||
              (deleteDeleting && deleteTarget?._id === sale._id);

            return (
              <div
                key={sale._id}
                className="flex flex-wrap items-center gap-4 border rounded-lg p-4 shadow-sm bg-rose-50"
              >
                <img
                  src={stock?.image_url}
                  alt={cardName}
                  className="w-20 h-28 object-contain rounded border bg-white"
                />
                <div className="flex-1 min-w-[180px]">
                  <h2 className="text-lg font-semibold text-gray-800">
                    {cardName}
                  </h2>
                  <p className="text-sm text-gray-600">
                    Precio compra:{" "}
                    {stock
                      ? `${stock.currency} ${stock.card_cost.toFixed(2)}`
                      : "N/A"}
                  </p>
                  <p className="text-sm text-gray-600">
                    Nota: {sale.notes?.trim() ? sale.notes : "—"}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    Fecha: {new Date(sale.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex flex-col gap-2 min-w-[160px]">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleDeshacer(sale)}
                    className="px-3 py-1.5 text-sm rounded border border-amber-600 text-amber-800 bg-amber-50 hover:bg-amber-100 disabled:opacity-50"
                  >
                    {deshaciendoId === sale._id
                      ? "Devolviendo…"
                      : "Devolver a stock"}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleOpenDelete(sale)}
                    className="px-3 py-1.5 text-sm rounded border border-red-600 text-red-700 bg-red-50 hover:bg-red-100 disabled:opacity-50"
                  >
                    Eliminar definitivamente
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleOpenNotas(sale)}
                    className="px-3 py-1.5 text-sm rounded border border-gray-400 text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                  >
                    Editar notas
                  </button>
                  <Link
                    to={`/stock/update/${sale.stock_id}`}
                    className="px-3 py-1.5 text-sm text-center rounded border border-blue-500 text-blue-700 bg-blue-50 hover:bg-blue-100"
                  >
                    Editar stock
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog
        open={deleteTarget !== null}
        onClose={handleCloseDelete}
        aria-labelledby="delete-keep-title"
      >
        <DialogTitle id="delete-keep-title">
          Eliminar definitivamente
        </DialogTitle>
        <DialogContent>
          <DialogContentText component="div">
            {deleteTarget && (
              <>
                <p className="mb-2">
                  Vas a eliminar de forma irreversible esta carta de propiedad y
                  del inventario:
                </p>
                <p className="font-medium text-gray-900">
                  {stockData[deleteTarget.stock_id]?.card_name ||
                    deleteTarget.card_id}
                </p>
                <p className="mt-3 text-sm text-gray-600">
                  No podrás deshacer esta acción. La carta no volverá a stock ni
                  a propiedad.
                </p>
              </>
            )}
            {deleteError ? (
              <p className="mt-3 text-sm text-red-600">{deleteError}</p>
            ) : null}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDelete} disabled={deleteDeleting}>
            Cancelar
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => void handleConfirmDelete()}
            disabled={deleteDeleting || !deleteTarget}
          >
            {deleteDeleting ? "Eliminando…" : "Eliminar definitivamente"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={notasTarget !== null}
        onClose={handleCloseNotas}
        aria-labelledby="edit-notes-title"
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle id="edit-notes-title">Editar notas</DialogTitle>
        <DialogContent>
          {notasTarget && (
            <p className="mb-3 text-sm text-gray-600">
              {stockData[notasTarget.stock_id]?.card_name ||
                notasTarget.card_id}
            </p>
          )}
          <textarea
            value={notasEditadas}
            onChange={(e) => setNotasEditadas(e.target.value)}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Notas del keep…"
            disabled={notasGuardando}
          />
          {notasError ? (
            <p className="mt-2 text-sm text-red-600">{notasError}</p>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseNotas} disabled={notasGuardando}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={() => void handleGuardarNotas()}
            disabled={notasGuardando || !notasTarget}
          >
            {notasGuardando ? "Guardando…" : "Guardar"}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
