import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Alert, Button, CircularProgress } from "@mui/material";
import axios from "axios";
import {
  STOCK_TAG_LABEL,
  STOCK_TAG_VALUES,
  type StockTagId,
} from "../../../constants/stock-tags";
import {
  useStockReviewActive,
  useStockReviewMutations,
} from "./use-stock-review";
import { sessionScopeLabel } from "./types";

export default function StockReviewStartPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [scopeMode, setScopeMode] = useState<"all" | "tag">("tag");
  const [tag, setTag] = useState<StockTagId>("vintage");
  const [error, setError] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(
    () => (location.state as { flash?: string } | null)?.flash ?? null,
  );

  const { data: activeData, isLoading } = useStockReviewActive();
  const { createSession, cancelSession } = useStockReviewMutations();

  const active = activeData?.session ?? null;

  // El aviso viene de una navegación puntual: no debe reaparecer al volver atrás.
  useEffect(() => {
    if ((location.state as { flash?: string } | null)?.flash) {
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.pathname, location.state, navigate]);

  const handleCancelActive = async () => {
    if (!active) return;
    setCancelError(null);
    setFlash(null);
    try {
      await cancelSession.mutateAsync(active.id);
      setFlash("Revisión cancelada. Puedes iniciar otra.");
    } catch (err: unknown) {
      setCancelError(
        axios.isAxiosError(err)
          ? ((err.response?.data?.message as string) ??
            "No se pudo cancelar la revisión.")
          : "No se pudo cancelar la revisión.",
      );
    }
  };

  const handleStart = async () => {
    setError(null);
    try {
      const body =
        scopeMode === "all"
          ? ({ scope: "all" } as const)
          : ({ scope: "tag", tag } as const);
      const session = await createSession.mutateAsync(body);
      navigate(`/stock/revision/${session.id}`);
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err)
        ? ((err.response?.data?.message as string) ??
          "No se pudo iniciar la revisión.")
        : "No se pudo iniciar la revisión.";
      setError(msg);
    }
  };

  const handleContinue = () => {
    if (!active) return;
    if (active.status === "pendiente_resolucion") {
      navigate(`/stock/revision/${active.id}/resolucion`);
    } else {
      navigate(`/stock/revision/${active.id}`);
    }
  };

  if (isLoading) {
    return (
      <p className="text-center text-gray-500 p-6">Cargando revisión...</p>
    );
  }

  return (
    <div className="w-full max-w-xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-2">
        Verificación de stock
      </h1>
      <p className="text-sm text-gray-600 mb-6">
        Audita inventario físico (todo el stock o por tag). Marca las cartas que
        tienes y clasifica las que falten al finalizar.
      </p>

      {flash && (
        <Alert severity="success" className="mb-4" onClose={() => setFlash(null)}>
          {flash}
        </Alert>
      )}

      {active && (
        <Alert severity="info" className="mb-4">
          Hay una revisión activa ({sessionScopeLabel(active)},{" "}
          {active.summary.verified}/{active.summary.total} verificadas).
          Continúa esa sesión o cancélala antes de iniciar otra con distinto
          alcance.
          <div className="mt-2 flex gap-2 flex-wrap">
            <Button
              size="small"
              variant="contained"
              onClick={handleContinue}
              disabled={cancelSession.isPending}
            >
              Continuar
            </Button>
            <Button
              size="small"
              color="error"
              onClick={handleCancelActive}
              disabled={cancelSession.isPending}
              startIcon={
                cancelSession.isPending ? (
                  <CircularProgress size={14} color="inherit" />
                ) : undefined
              }
            >
              {cancelSession.isPending ? "Cancelando…" : "Cancelar sesión"}
            </Button>
          </div>
          {cancelError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {cancelError}
            </Alert>
          )}
        </Alert>
      )}

      <div className="bg-white rounded-lg shadow border border-gray-200 p-4 space-y-4">
        <fieldset disabled={Boolean(active) || createSession.isPending}>
          <legend className="text-sm font-medium text-gray-700 mb-2">
            Alcance
          </legend>
          <div className="flex flex-col gap-2 mb-4">
            <label className="flex items-center gap-2 text-sm text-gray-800">
              <input
                type="radio"
                name="scope"
                checked={scopeMode === "all"}
                onChange={() => setScopeMode("all")}
              />
              Todo el stock
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-800">
              <input
                type="radio"
                name="scope"
                checked={scopeMode === "tag"}
                onChange={() => setScopeMode("tag")}
              />
              Por tag
            </label>
          </div>

          {scopeMode === "tag" && (
            <>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tag a revisar
              </label>
              <select
                value={tag}
                onChange={(e) => setTag(e.target.value as StockTagId)}
                className="w-full border border-gray-300 rounded px-3 py-2"
              >
                {STOCK_TAG_VALUES.map((t) => (
                  <option key={t} value={t}>
                    {STOCK_TAG_LABEL[t]}
                  </option>
                ))}
              </select>
            </>
          )}
        </fieldset>

        {error && (
          <Alert severity="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Button
          variant="contained"
          fullWidth
          disabled={Boolean(active) || createSession.isPending}
          onClick={handleStart}
          startIcon={
            createSession.isPending ? (
              <CircularProgress size={16} color="inherit" />
            ) : undefined
          }
        >
          {createSession.isPending
            ? "Iniciando… puede tardar con todo el stock"
            : "Iniciar revisión"}
        </Button>
      </div>
    </div>
  );
}
