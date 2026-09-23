import type { ReactNode } from "react";

type StockEntryModalProps = {
  open: boolean;
  saving: boolean;
  message: string;
  currency: "EUR" | "COP";
  onCurrency: (currency: "EUR" | "COP") => void;
  onClose: () => void;
  onSave: () => void;
  children: ReactNode;
};

export function StockEntryModal({
  open,
  saving,
  message,
  currency,
  onCurrency,
  onClose,
  onSave,
  children,
}: StockEntryModalProps) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 rounded-t-xl flex justify-between items-center z-10">
          <h2 className="text-xl font-bold">Detalles de la carta</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition-colors"
            aria-label="Cerrar"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        <div className="p-6">
          {children}
          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Moneda</label>
            <select
              value={currency}
              onChange={(e) => onCurrency(e.target.value as "EUR" | "COP")}
              className="w-full px-3 py-2 border rounded-lg border-gray-300 focus:ring-blue-500 focus:outline-none focus:border-blue-500"
            >
              <option value="EUR">EUR</option>
              <option value="COP">COP</option>
            </select>
          </div>
          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors shadow-md hover:shadow-lg"
            >
              {saving ? "Guardando..." : "Guardar stock"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium transition-colors"
            >
              Cancelar
            </button>
          </div>
          {message ? (
            <div
              className={`mt-4 p-3 rounded-lg text-sm text-center ${
                message.includes("✅")
                  ? "bg-green-50 text-green-800 border border-green-200"
                  : "bg-red-50 text-red-800 border border-red-200"
              }`}
            >
              {message}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
