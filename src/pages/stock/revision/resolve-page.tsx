import { useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  TextField,
} from "@mui/material";
import axios from "axios";
import { useExchangeRates } from "../../../utils/tasa";
import {
  useStockReviewMutations,
  useStockReviewSession,
  writeStockReviewSessionCache,
} from "./use-stock-review";
import { ResolutionItemRow } from "./resolution-item-row";
import type { StockReviewItem, StockReviewOutcome } from "./types";
import { sessionScopeLabel } from "./types";

export default function StockReviewResolvePage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const queryClient = useQueryClient();
  const { convert } = useExchangeRates();
  const [search, setSearch] = useState("");
  const [onlyPending, setOnlyPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [manualItem, setManualItem] = useState<StockReviewItem | null>(null);
  const [precioManual, setPrecioManual] = useState("");
  const [monedaManual, setMonedaManual] = useState<"COP" | "EUR" | "USD">("COP");
  const [manualError, setManualError] = useState<string | null>(null);
  const [localOutcomes, setLocalOutcomes] = useState<
    Record<string, StockReviewOutcome>
  >({});

  const { data, isLoading } = useStockReviewSession(sessionId);
  const { resolveItem } = useStockReviewMutations();

  const session = data?.session;

  const notVerifiedInStock = (item: StockReviewItem) =>
    !item.obsolete && !item.verified;

  const resolutionItems = useMemo(() => {
    return (session?.items.filter(notVerifiedInStock) ?? []).map((item) => ({
      ...item,
      outcome: localOutcomes[item.stock_id] ?? item.outcome ?? null,
    }));
  }, [session, localOutcomes]);

  const needsResolution = (item: StockReviewItem) => item.outcome == null;

  const pendingItems = useMemo(
    () => resolutionItems.filter(needsResolution),
    [resolutionItems],
  );

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return resolutionItems.filter((item) => {
      if (onlyPending && !needsResolution(item)) return false;
      if (!q) return true;
      return (item.card_name ?? "").toLowerCase().includes(q);
    });
  }, [resolutionItems, search, onlyPending]);

  if (isLoading || !session) {
    return (
      <p className="text-center text-gray-500 p-6">Cargando resolución...</p>
    );
  }

  if (session.status === "completada") {
    return (
      <div className="w-full max-w-5xl mx-auto p-6 space-y-4">
        <Alert severity="success">Revisión completada.</Alert>
        <div className="space-y-2">
          {resolutionItems.map((item) => (
            <ResolutionItemRow
              key={item.stock_id}
              item={item}
              busy={false}
              onResolve={() => {}}
              onPropiedad={() => {}}
            />
          ))}
        </div>
        <div className="flex gap-2 justify-center flex-wrap pt-4">
          <Button component={Link} to="/stock/perdidas" variant="outlined">
            Ver cartas perdidas
          </Button>
          <Button component={Link} to="/stock/revision" variant="contained">
            Nueva revisión
          </Button>
        </div>
      </div>
    );
  }

  if (session.status !== "pendiente_resolucion") {
    return (
      <Navigate to={`/stock/revision/${session.id}`} replace />
    );
  }

  const runResolve = async (
    item: StockReviewItem,
    outcome: StockReviewOutcome,
    amountCop?: number,
  ) => {
    if (!sessionId) return;
    setError(null);
    setResolvingId(item.stock_id);
    setLocalOutcomes((prev) => ({ ...prev, [item.stock_id]: outcome }));
    try {
      const updated = await resolveItem.mutateAsync({
        sessionId,
        stockId: item.stock_id,
        outcome,
        amount_cop: amountCop,
      });
      writeStockReviewSessionCache(queryClient, updated, sessionId);
      setLocalOutcomes((prev) => {
        const next = { ...prev };
        delete next[item.stock_id];
        return next;
      });
    } catch (err: unknown) {
      setLocalOutcomes((prev) => {
        const next = { ...prev };
        delete next[item.stock_id];
        return next;
      });
      const msg = axios.isAxiosError(err)
        ? ((err.response?.data?.message as string) ?? "Error al resolver.")
        : "Error al resolver.";
      if (outcome === "vendida" && msg.toLowerCase().includes("pvp")) {
        setManualItem(item);
        setPrecioManual("");
        setMonedaManual("COP");
        setManualError(null);
      } else {
        setError(msg);
      }
    } finally {
      setResolvingId(null);
    }
  };

  const handleManualSale = async () => {
    if (!manualItem) return;
    const num = parseFloat(precioManual.replace(",", "."));
    if (isNaN(num) || num < 0) {
      setManualError("Ingresa un precio válido.");
      return;
    }
    let amountCop = num;
    if (monedaManual === "EUR") {
      amountCop = convert.toCopFromEur(num) ?? 0;
    } else if (monedaManual === "USD") {
      amountCop = convert.toCopFromUsd(num) ?? 0;
    }
    setManualError(null);
    await runResolve(manualItem, "vendida", Math.round(amountCop));
    setManualItem(null);
  };

  const verifiedCount = session.summary.verified;
  const resolvedCount = resolutionItems.filter((i) => i.outcome != null).length;

  return (
    <div className="w-full max-w-5xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-2">
        Resolución — {sessionScopeLabel(session)}
      </h1>
      <p className="text-sm text-gray-600 mb-4">
        Solo aparecen las cartas que <strong>no</strong> marcaste como existentes
        en stock. Clasifica cada una: <strong>Aún en stock</strong> no altera el
        sistema; el resto aplica el cambio correspondiente.
      </p>
      <p className="text-sm text-gray-600 mb-6">
        {verifiedCount} ya verificadas en stock (ocultas) · {resolvedCount}{" "}
        clasificadas aquí · {pendingItems.length} por clasificar
      </p>

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
          Solo por clasificar
        </label>
      </div>

      {error && (
        <Alert severity="error" className="mb-4" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {pendingItems.length === 0 && (
        <Alert severity="info" className="mb-4">
          No quedan cartas por clasificar. La sesión se cerrará al terminar de
          procesar.
        </Alert>
      )}

      <div className="space-y-2">
        {filteredItems.length === 0 && (
          <p className="text-gray-500 text-center py-8">
            No hay cartas que coincidan con el filtro.
          </p>
        )}
        {filteredItems.map((item) => (
          <ResolutionItemRow
            key={item.stock_id}
            item={item}
            busy={resolvingId === item.stock_id}
            onResolve={(outcome) => runResolve(item, outcome)}
            onPropiedad={() => {
              if (
                window.confirm("¿Marcar como propiedad (retener carta)?")
              ) {
                void runResolve(item, "propiedad");
              }
            }}
          />
        ))}
      </div>

      <Dialog open={Boolean(manualItem)} onClose={() => setManualItem(null)}>
        <DialogTitle>Precio manual de venta</DialogTitle>
        <DialogContent className="space-y-3 min-w-[280px]">
          <p className="text-sm text-gray-600">
            {manualItem?.card_name ?? manualItem?.card_id}
          </p>
          <TextField
            label="Precio"
            value={precioManual}
            onChange={(e) => setPrecioManual(e.target.value)}
            fullWidth
            size="small"
          />
          <TextField
            select
            label="Moneda"
            value={monedaManual}
            onChange={(e) =>
              setMonedaManual(e.target.value as "COP" | "EUR" | "USD")
            }
            fullWidth
            size="small"
          >
            <MenuItem value="COP">COP</MenuItem>
            <MenuItem value="EUR">EUR</MenuItem>
            <MenuItem value="USD">USD</MenuItem>
          </TextField>
          {manualError && (
            <Alert severity="error" className="mt-2">
              {manualError}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setManualItem(null)}>Cancelar</Button>
          <Button variant="contained" onClick={() => void handleManualSale()}>
            Registrar venta
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
