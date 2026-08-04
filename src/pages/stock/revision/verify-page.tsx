import { useCallback, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Tab,
  Tabs,
  TextField,
} from "@mui/material";
import axios from "axios";
import { useLaserBarcodeInput } from "../../../components/barcode-scanner/use-laser-barcode-input";
import { parseStockQrPayload } from "../../../modules/stock-barcode";
import {
  useStockReviewMutations,
  useStockReviewSession,
} from "./use-stock-review";
import { ReviewItemMeta } from "./review-item-meta";
import { sessionScopeLabel, type StockReviewItem } from "./types";
import { CardThumb } from "../../../components/card-thumb";

type DisplayItem = StockReviewItem & {
  pendingSync: boolean;
};

type VerifyTab = "verified" | "pending";

function axiosErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const msg = err.response?.data?.message;
    if (typeof msg === "string") return msg;
    if (Array.isArray(msg) && typeof msg[0] === "string") return msg[0];
  }
  return "Error al verificar.";
}

/** Milisegundos de verificación; `null` cuando aún no hay marca del servidor. */
function verifiedAtMs(item: DisplayItem): number | null {
  // Verificación optimista aún sin confirmar: siempre lo más reciente.
  if (item.pendingSync) return Number.POSITIVE_INFINITY;
  if (!item.verified_at) return null;
  const ms = Date.parse(item.verified_at);
  return Number.isNaN(ms) ? null : ms;
}

function matchesSearch(item: DisplayItem, query: string): boolean {
  if (!query) return true;
  return (item.card_name ?? "").toLowerCase().includes(query);
}

export default function StockReviewVerifyPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<VerifyTab>("verified");
  const [confirmFinalize, setConfirmFinalize] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanFeedback, setScanFeedback] = useState<{
    severity: "success" | "error" | "info";
    message: string;
  } | null>(null);
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
  const laserFocusRef = useRef<(() => void) | null>(null);
  const scanQueueRef = useRef<Promise<unknown>>(Promise.resolve());

  const { data, isLoading, isError } = useStockReviewSession(sessionId);
  const { verifyItem, scanItem, finalizeVerification, cancelSession } =
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

  const verifiedItems = useMemo(() => {
    return displayItems
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => item.verified)
      .sort((a, b) => {
        const ta = verifiedAtMs(a.item);
        const tb = verifiedAtMs(b.item);
        if (ta == null && tb == null) return a.index - b.index;
        if (ta == null) return 1;
        if (tb == null) return -1;
        if (ta === tb) return a.index - b.index;
        return tb - ta;
      })
      .map(({ item }) => item);
  }, [displayItems]);

  // Las obsoletas no cuentan para finalizar: van al final de la lista.
  const pendingItems = useMemo(() => {
    const pending = displayItems.filter((item) => !item.verified);
    return [
      ...pending.filter((item) => !item.obsolete),
      ...pending.filter((item) => item.obsolete),
    ];
  }, [displayItems]);

  const visibleItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    const source = tab === "verified" ? verifiedItems : pendingItems;
    return source.filter((item) => matchesSearch(item, q));
  }, [tab, search, verifiedItems, pendingItems]);

  const handleVerify = useCallback(
    (item: StockReviewItem) => {
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
    },
    [sessionId, localVerifiedIds, verifyItem],
  );

  /**
   * El grupo carta + idioma lo resuelve el servidor: la etiqueta puede
   * pertenecer a una línea ya vendida o compartirse entre unidades iguales.
   */
  const handleQrScan = useCallback(
    (raw: string) => {
      const refocus = () =>
        window.setTimeout(() => laserFocusRef.current?.(), 80);

      setScanFeedback(null);
      const stockId = parseStockQrPayload(raw);
      if (!stockId) {
        setScanFeedback({
          severity: "error",
          message:
            "QR no reconocido. Usa etiquetas DA-STOCK:… exportadas desde Stock.",
        });
        refocus();
        return;
      }
      if (!sessionId) {
        refocus();
        return;
      }

      // En serie: dos peticiones simultáneas resolverían la misma unidad.
      scanQueueRef.current = scanQueueRef.current
        .catch(() => undefined)
        .then(() => scanItem.mutateAsync({ sessionId, stockId }))
        .then(({ scan }) => {
          const language = scan.language?.trim()
            ? ` (${scan.language.trim().toUpperCase()})`
            : "";
          const remaining =
            scan.group_pending_after > 0
              ? `Quedan ${scan.group_pending_after} unidad(es) de esta carta.`
              : "No quedan unidades pendientes de esta carta.";
          setScanFeedback({
            severity: "success",
            message: `Verificada: ${scan.card_name || scan.card_id}${language}. ${remaining}`,
          });
        })
        .catch((err: unknown) => {
          setScanFeedback({
            severity: "error",
            message: axiosErrorMessage(err),
          });
        })
        .finally(refocus);
      refocus();
    },
    [sessionId, scanItem],
  );

  const laser = useLaserBarcodeInput({
    enabled: Boolean(session && session.status === "en_verificacion"),
    onScan: handleQrScan,
  });
  laserFocusRef.current = laser.focus;

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
    if (!sessionId) return;
    setCancelError(null);
    try {
      await cancelSession.mutateAsync(sessionId);
      setConfirmCancel(false);
      navigate("/stock/revision", {
        state: { flash: "Revisión cancelada. Puedes iniciar otra." },
        replace: true,
      });
    } catch (err: unknown) {
      setCancelError(
        axios.isAxiosError(err)
          ? ((err.response?.data?.message as string) ??
            "No se pudo cancelar la revisión.")
          : "No se pudo cancelar la revisión.",
      );
    }
  };

  if (isLoading) {
    return (
      <p className="text-center text-gray-500 p-6">Cargando sesión...</p>
    );
  }

  if (isError || !session) {
    return (
      <div className="max-w-xl mx-auto p-6 text-center space-y-4">
        <Alert severity="warning">
          Esta sesión de verificación ya no está disponible (pudo cancelarse o
          completarse).
        </Alert>
        <Button component={Link} to="/stock/revision" variant="contained">
          Volver a Verificación de stock
        </Button>
      </div>
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
            Verificación — {sessionScopeLabel(session)}
          </h1>
          <p className="text-sm text-gray-600">
            {summary.verified} / {summary.total} verificadas
            {pendingCount > 0 && ` · ${pendingCount} pendientes`}
            {unsyncedCount > 0 &&
              ` · ${unsyncedCount} por sincronizar con el servidor`}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            color="inherit"
            onClick={() => {
              setCancelError(null);
              setConfirmCancel(true);
            }}
            disabled={cancelSession.isPending}
          >
            {cancelSession.isPending ? "Cancelando…" : "Cancelar sesión"}
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

      <div className="mb-4 bg-white border border-gray-200 rounded-lg p-3">
        <p className="text-xs text-gray-500 mb-1">
          Pistola QR: el cursor debe estar en el campo; escanea y Enter.
        </p>
        <TextField
          inputRef={laser.inputRef}
          fullWidth
          autoFocus
          size="small"
          placeholder="Escanea DA-STOCK:…"
          onBlur={(e) => {
            // Recuperar el foco salvo que el operador vaya al buscador,
            // a las pestañas o a un botón de la lista.
            const next = e.relatedTarget as HTMLElement | null;
            if (next?.closest("input, textarea, button, a, [role='tab']")) {
              return;
            }
            window.setTimeout(() => laser.focus(), 50);
          }}
          sx={{
            "& .MuiOutlinedInput-root": {
              fontFamily: "ui-monospace, monospace",
              bgcolor: "grey.50",
            },
          }}
        />
        {/* Alto reservado: el feedback no debe desplazar la lista. */}
        <div className="mt-2 min-h-[24px]">
          {scanFeedback && (
            <p
              className={`text-sm ${
                scanFeedback.severity === "success"
                  ? "text-green-700"
                  : scanFeedback.severity === "error"
                    ? "text-red-700"
                    : "text-gray-700"
              }`}
            >
              {scanFeedback.message}
            </p>
          )}
        </div>
      </div>

      {error && (
        <Alert severity="error" className="mb-4" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <div className="border-b border-gray-200 mb-3">
        <Tabs
          value={tab}
          onChange={(_e, value: VerifyTab) => setTab(value)}
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab value="verified" label={`Verificadas (${summary.verified})`} />
          <Tab value="pending" label={`Pendientes (${pendingCount})`} />
        </Tabs>
      </div>

      <div className="mb-3">
        <TextField
          size="small"
          type="search"
          placeholder={
            tab === "verified"
              ? "Buscar en verificadas..."
              : "Buscar en pendientes..."
          }
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ width: { xs: "100%", sm: 260 } }}
        />
      </div>

      <div className="space-y-2">
        {visibleItems.length === 0 && (
          <p className="text-gray-500 text-center py-8">
            {search.trim()
              ? "No hay cartas que coincidan con la búsqueda."
              : tab === "verified"
                ? "Aún no hay cartas verificadas."
                : "No quedan cartas pendientes."}
          </p>
        )}
        {visibleItems.map((item) => (
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
            <CardThumb
              src={item.image_url}
              alt={item.card_name || item.card_id}
              size="md"
              enlargeOnHover
            />
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
        open={confirmCancel}
        onClose={() => !cancelSession.isPending && setConfirmCancel(false)}
      >
        <DialogTitle>Cancelar revisión</DialogTitle>
        <DialogContent>
          <DialogContentText component="div">
            <p>
              Se descartará esta sesión y las{" "}
              <strong>{summary.verified} verificaciones</strong> registradas. El
              stock no cambia: nada de lo verificado modificó el inventario.
            </p>
            <p className="mt-2">
              Para volver a auditar tendrás que iniciar una revisión nueva.
            </p>
            {cancelError && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {cancelError}
              </Alert>
            )}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setConfirmCancel(false)}
            disabled={cancelSession.isPending}
          >
            Volver
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleCancel}
            disabled={cancelSession.isPending}
            startIcon={
              cancelSession.isPending ? (
                <CircularProgress size={16} color="inherit" />
              ) : undefined
            }
          >
            {cancelSession.isPending ? "Cancelando…" : "Sí, cancelar"}
          </Button>
        </DialogActions>
      </Dialog>

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
