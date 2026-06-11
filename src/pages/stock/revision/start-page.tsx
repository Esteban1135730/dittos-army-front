import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, Button } from "@mui/material";
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

export default function StockReviewStartPage() {
  const navigate = useNavigate();
  const [tag, setTag] = useState<StockTagId>("vintage");
  const [error, setError] = useState<string | null>(null);

  const { data: activeData, isLoading } = useStockReviewActive();
  const { createSession } = useStockReviewMutations();

  const active = activeData?.session ?? null;

  const handleStart = async () => {
    setError(null);
    try {
      const session = await createSession.mutateAsync(tag);
      navigate(`/stock/revision/${session.id}`);
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err)
        ? (err.response?.data?.message as string) ??
          "No se pudo iniciar la revisión."
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
      <h1 className="text-2xl font-bold text-gray-800 mb-2">Revisión de stock</h1>
      <p className="text-sm text-gray-600 mb-6">
        Audita inventario físico por tag. Marca las cartas que tienes y clasifica
        las que falten al finalizar.
      </p>

      {active && (
        <Alert severity="info" className="mb-4">
          Hay una revisión activa ({STOCK_TAG_LABEL[active.tag]},{" "}
          {active.summary.verified}/{active.summary.total} verificadas).
          <div className="mt-2 flex gap-2 flex-wrap">
            <Button size="small" variant="contained" onClick={handleContinue}>
              Continuar
            </Button>
          </div>
        </Alert>
      )}

      <div className="bg-white rounded-lg shadow border border-gray-200 p-4 space-y-4">
        <label className="block text-sm font-medium text-gray-700">
          Tag a revisar
        </label>
        <select
          value={tag}
          onChange={(e) => setTag(e.target.value as StockTagId)}
          disabled={Boolean(active) || createSession.isPending}
          className="w-full border border-gray-300 rounded px-3 py-2"
        >
          {STOCK_TAG_VALUES.map((t) => (
            <option key={t} value={t}>
              {STOCK_TAG_LABEL[t]}
            </option>
          ))}
        </select>

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
        >
          {createSession.isPending ? "Iniciando..." : "Iniciar revisión"}
        </Button>
      </div>
    </div>
  );
}
