import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from "@mui/material";
import axios from "axios";
import {
  useStockReviewMutations,
  useStockReviewSession,
} from "./use-stock-review";
import { ReviewItemMeta } from "./review-item-meta";
import type { StockReviewItem } from "./types";

type DisplayItem = StockReviewItem & {
  pendingSync: boolean;
};

function axiosErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const msg = err.response?.data?.message;
    if (typeof msg === "string") return msg;
    if (Array.isArray(msg) && typeof msg[0] === "string") return msg[0];
  }
  return "Error al verificar.";
}

export default function StockReviewVerifyPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [onlyPending, setOnlyPending] = useState(false);
  const [confirmFinalize, setConfirmFinalize] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localVerifiedIds, setLocalVerifiedIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [syncFailures, setSyncFailures] = useState<Record<string, string>>(
    {},
  );
  const [finalizeSyncErrors, setFinalizeSyncErrors] = useState<
    Array<{ stockId: string; name: string; error: string }>
  >([]);
  const [syncingFinalize, setSyncingFinalize] = useState(false);

  const { data, isLoading } = useStockReviewSession(sessionId);
  const { verifyItem, finalizeVerification, cancelSession } =
    useStockReviewMutations();

  const session = data?.session;

  const displayItems = useMemo((): DisplayItem[] => {
    if (!session) return [];
    return session.items.map((item) => {
      const verified =
        item.verified || localVerifiedIds.has(item.stock_id);
      const pendingSync =
        !item.verified &&
        (localVerifiedIds.has(item.stock_id) ||
          Boolean(syncFailures[item.stock_id]));
      return { ...item, verified, pendingSync };
    });
  }, [session, localVerifiedIds, syncFailures]);

  const summary = useMemo(() => {
    const active = displayItems.filter((i) => !i.obsolete);
    const verified = active.filter((i) => i.verified).length;
    return {
      verified,
      total: active.length,
      pending: active.length - verified,
    };
  }, [displayItems]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return displayItems.filter((item) => {
      if (onlyPending && (item.verified || item.obsolete)) return false;
      if (!q) return true;
      return (item.card_name ?? "").toLowerCase().includes(q);
    });
  }, [displayItems, search, onlyPending]);

  const handleVerify = (item: StockReviewItem) => {
    if (!sessionId || item.obsolete || item.verified) return;
    if (localVerifiedIds.has(item.stock_id)) return;

    setLocalVerifiedIds((prev) => new Set(prev).add(item.stock_id));
    setSyncFailures((prev) => {
      const next = { ...prev };
      delete next[item.stock_id];
      return next;
    });

    verifyItem.mutate(
      { sessionId, stockId: item.stock_id },
      {
        onSuccess: () => {
          setLocalVerifiedIds((prev) => {
            const next = new Set(prev);
            next.delete(item.stock_id);
            return next;
          });
          setSyncFailures((prev) => {
            const next = { ...prev };
            delete next[item.stock_id];
            return next;
          });
        },
        onError: (err) => {
          setSyncFailures((prev) => ({
            ...prev,
            [item.stock_id]: axiosErrorMessage(err),
          }));
        },
      },
    );
  };

  const syncPendingVerifications = async (): Promise<
    Array<{ stockId: string; name: string; error: string }>
  > => {
    if (!sessionId || !session) return [];

    const idsToSync = new Set<string>([
      ...localVerifiedIds,
      ...Object.keys(syncFailures),
    ]);

    const failures: Array<{ stockId: string; name: string; error: string }> =
      [];

    for (const stockId of idsToSync) {
      const item = session.items.find((i) => i.stock_id === stockId);
      if (!item || item.obsolete || item.verified) continue;

      try {
        await verifyItem.mutateAsync({ sessionId, stockId });
        setLocalVerifiedIds((prev) => {
          const next = new Set(prev);
          next.delete(stockId);
          return next;
        });
        setSyncFailures((prev) => {
          const next = { ...prev };
          delete next[stockId];
          return next;
        });
      } catch (err) {
        const message = axiosErrorMessage(err);
        failures.push({
          stockId,
          name: item.card_name || item.card_id,
          error: message,
        });
      }
    }

    return failures;
  };

  const handleFinalize = async () => {
    if (!sessionId) return;
    setError(null);
    setFinalizeSyncErrors([]);
    setSyncingFinalize(true);

    try {
      const failures = await syncPendingVerifications();
      if (failures.length > 0) {
        setFinalizeSyncErrors(failures);
        setSyncFailures((prev) => {
          const next = { ...prev };
          for (const f of failures) next[f.stockId] = f.error;
          return next;
        });
        setError(
          `No se pudieron guardar ${failures.length} verificación(es). Revisa la lista e inténtalo de nuevo.`,
        );
        return;
      }

      const updated = await finalizeVerification.mutateAsync(sessionId);
      setConfirmFinalize(false);
      if (updated.status === "pendiente_resolucion") {
        navigate(`/stock/revision/${sessionId}/resolucion`);
      } else {
        navigate("/stock/revision");
      }
    } catch (err: unknown) {
      setError(
        axios.isAxiosError(err)
          ? ((err.response?.data?.message as string) ?? "Error al finalizar.")
          : "Error al finalizar.",
      );
    } finally {
      setSyncingFinalize(false);
    }
  };

  const handleCancel = async () => {
    if (!sessionId || !window.confirm("¿Cancelar esta revisión?")) return;
    await cancelSession.mutateAsync(sessionId);
    navigate("/stock/revision");
  };

  if (isLoading || !session) {
    return (
      <p className="text-center text-gray-500 p-6">Cargando sesión...</p>
    );
  }

  if (session.status === "pendiente_resolucion") {
    navigate(`/stock/revision/${session.id}/resolucion`, { replace: true });
    return null;
  }

  if (session.status === "completada") {
    return (
      <div className="max-w-xl mx-auto p-6 text-center space-y-4">
        <Alert severity="success">Esta revisión ya está completada.</Alert>
        <Button component={Link} to="/stock/revision" variant="contained">
          Volver
        </Button>
      </div>
    );
  }

  const pendingCount = summary.pending;
  const unsyncedCount =
    localVerifiedIds.size + Object.keys(syncFailures).length;

  return (
    <div className="w-full max-w-5xl mx-auto p-6">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            Revisión — {session.tag}
          </h1>
          <p className="text-sm text-gray-600">
            {summary.verified} / {summary.total} verificadas
            {pendingCount > 0 && ` · ${pendingCount} pendientes`}
            {unsyncedCount > 0 &&
              ` · ${unsyncedCount} por sincronizar con el servidor`}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button color="inherit" onClick={handleCancel}>
            Cancelar sesión
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={() => {
              setFinalizeSyncErrors([]);
              setConfirmFinalize(true);
            }}
            disabled={finalizeVerification.isPending || syncingFinalize}
          >
            Finalizar revisión
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <input
          type="search"
          placeholder="Buscar por nombre..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] border border-gray-300 rounded px-3 py-2"
        />
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={onlyPending}
            onChange={(e) => setOnlyPending(e.target.checked)}
          />
          Solo pendientes
        </label>
      </div>

      {error && (
        <Alert severity="error" className="mb-4" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <div className="space-y-2">
        {filteredItems.length === 0 && (
          <p className="text-gray-500 text-center py-8">
            No hay cartas que coincidan con el filtro.
          </p>
        )}
        {filteredItems.map((item) => (
          <div
            key={item.stock_id}
            className={`flex flex-wrap items-center gap-3 p-3 rounded-lg border ${
              item.verified
                ? "bg-green-50 border-green-200 opacity-80"
                : item.obsolete
                  ? "bg-gray-100 border-gray-300"
                  : "bg-white border-gray-200"
            }`}
          >
            {item.image_url ? (
              <img
                src={item.image_url}
                alt=""
                className="w-12 h-auto rounded"
              />
            ) : (
              <div className="w-12 h-16 bg-gray-200 rounded" />
            )}
            <div className="flex-1 min-w-[180px]">
              <p className="font-medium text-gray-900">
                {item.card_name || item.card_id}
              </p>
              <ReviewItemMeta
                language={item.language}
                rareza={item.rareza}
                cardState={item.card_state}
                extra={item.obsolete ? "obsoleta" : undefined}
              />
            </div>
            {item.verified ? (
              <div className="flex flex-col items-end gap-0.5">
                <span className="text-sm text-green-700 font-medium">
                  En stock ✓
                </span>
                {item.pendingSync && (
                  <span
                    className={`text-xs ${
                      syncFailures[item.stock_id]
                        ? "text-red-600"
                        : "text-amber-700"
                    }`}
                  >
                    {syncFailures[item.stock_id]
                      ? "Sin guardar en servidor"
                      : "Guardando…"}
                  </span>
                )}
              </div>
            ) : (
              <Button
                variant="outlined"
                size="small"
                disabled={item.obsolete}
                onClick={() => handleVerify(item)}
              >
                Existe en stock
              </Button>
            )}
          </div>
        ))}
      </div>

      <Dialog
        open={confirmFinalize}
        onClose={() => !syncingFinalize && setConfirmFinalize(false)}
      >
        <DialogTitle>Finalizar revisión física</DialogTitle>
        <DialogContent>
          <DialogContentText component="div">
            {unsyncedCount > 0 && (
              <p className="mb-3">
                Se sincronizarán {unsyncedCount} verificación(es) pendientes con
                el servidor antes de cerrar la fase.
              </p>
            )}
            {pendingCount === 0 ? (
              <p>
                Todas las cartas fueron verificadas. Se cerrará la sesión o
                pasará a resolución según corresponda.
              </p>
            ) : (
              <p>
                Quedan {pendingCount} cartas sin verificar. En la pantalla de
                resolución verás <strong>cada carta</strong> para indicar si
                quedó en stock (sin cambios), perdida, propiedad o vendida.
              </p>
            )}
            {finalizeSyncErrors.length > 0 && (
              <Alert severity="error" sx={{ mt: 2 }}>
                <p className="font-medium mb-1">
                  Estas cartas no se guardaron en el servidor:
                </p>
                <ul className="list-disc pl-4 text-sm space-y-1">
                  {finalizeSyncErrors.map((f) => (
                    <li key={f.stockId}>
                      {f.name}: {f.error}
                    </li>
                  ))}
                </ul>
              </Alert>
            )}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setConfirmFinalize(false)}
            disabled={syncingFinalize}
          >
            Volver
          </Button>
          <Button
            variant="contained"
            onClick={handleFinalize}
            disabled={syncingFinalize || finalizeVerification.isPending}
          >
            {syncingFinalize ? "Sincronizando…" : "Confirmar"}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
