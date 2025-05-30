import { useEffect, useState } from "react";

type EuroToCOPConverterProps = {
  euros: number;
};

// ✅ Hook reutilizable para obtener y usar la tasa del euro
export function useEuroRate() {
  const [euroRate, setEuroRate] = useState<number | null>(null);
  const [isPrompting, setIsPrompting] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("euro-cop-rate");
    const savedAt = localStorage.getItem("euro-cop-rate-date");

    if (saved && savedAt) {
      const savedDate = new Date(savedAt);
      const now = new Date();
      const diff = now.getTime() - savedDate.getTime();

      if (diff < 24 * 60 * 60 * 1000) {
        setEuroRate(parseFloat(saved));
        return;
      }
    }

    setIsPrompting(true);
  }, []);

  const handleSaveRate = (value: string) => {
    const rate = parseFloat(value);
    if (!isNaN(rate) && rate > 0) {
      localStorage.setItem("euro-cop-rate", rate.toString());
      localStorage.setItem("euro-cop-rate-date", new Date().toISOString());
      setEuroRate(rate);
      setIsPrompting(false);
    }
  };

  const convertToCOP = (euros: number) =>
    euroRate !== null ? euros * euroRate : null;

  const convertToEUR = (pesos: number) =>
    euroRate !== null && euroRate > 0 ? pesos / euroRate : null;

  return {
    euroRate,
    isPrompting,
    handleSaveRate,
    convertToCOP,
    convertToEUR,
  };
}

// 💰 Componente visual de conversión simple
export default function EuroToCOPConverter({ euros }: EuroToCOPConverterProps) {
  const { euroRate, isPrompting, handleSaveRate, convertToCOP } = useEuroRate();

  if (isPrompting || euroRate === null) {
    return (
      <div className="p-4 border rounded shadow bg-yellow-50">
        <label className="block mb-2 text-sm font-medium text-gray-700">
          Ingresa el valor actual del euro en COP:
        </label>
        <input
          type="number"
          inputMode="decimal"
          step="0.01"
          className="w-full px-3 py-2 border border-gray-300 rounded"
          onBlur={(e) => handleSaveRate(e.target.value)}
        />
        <p className="text-xs text-gray-600 mt-1">
          Este valor se guardará por 24 horas.
        </p>
      </div>
    );
  }

  const cop = convertToCOP(euros);

  return (
    <>{cop?.toLocaleString("es-CO", { style: "currency", currency: "COP" })}</>
  );
}
