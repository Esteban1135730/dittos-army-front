import { useEffect, useState } from "react";

// Hook extendido de tasas de cambio (EUR → COP, USD → COP, USD → EUR, COP → EUR)
export function useExchangeRates() {
  const [rates, setRates] = useState<{
    euroToCop: number | null;
    usdToCop: number | null;
    usdToEur: number | null;
  }>({
    euroToCop: null,
    usdToCop: null,
    usdToEur: null,
  });
  const [isPrompting, setIsPrompting] = useState(false);

  useEffect(() => {
    const stored = {
      euroToCop: localStorage.getItem("euro-cop-rate"),
      usdToCop: localStorage.getItem("usd-cop-rate"),
      usdToEur: localStorage.getItem("usd-eur-rate"),
      date: localStorage.getItem("rates-date"),
    };

    if (stored.euroToCop && stored.usdToCop && stored.usdToEur && stored.date) {
      const diff = Date.now() - new Date(stored.date).getTime();
      if (diff < 24 * 60 * 60 * 1000) {
        setRates({
          euroToCop: parseFloat(stored.euroToCop),
          usdToCop: parseFloat(stored.usdToCop),
          usdToEur: parseFloat(stored.usdToEur),
        });
        return;
      }
    }

    setIsPrompting(true);
  }, []);

  const handleSaveRates = (values: {
    euroToCop: string;
    usdToCop: string;
    usdToEur: string;
  }) => {
    const euro = parseFloat(values.euroToCop);
    const usd = parseFloat(values.usdToCop);
    const usdEur = parseFloat(values.usdToEur);

    if ([euro, usd, usdEur].every((n) => !isNaN(n) && n > 0)) {
      localStorage.setItem("euro-cop-rate", euro.toString());
      localStorage.setItem("usd-cop-rate", usd.toString());
      localStorage.setItem("usd-eur-rate", usdEur.toString());
      localStorage.setItem("rates-date", new Date().toISOString());

      setRates({ euroToCop: euro, usdToCop: usd, usdToEur: usdEur });
      setIsPrompting(false);
    }
  };

  const convert = {
    toCopFromEur: (eur: number) =>
      rates.euroToCop !== null ? eur * rates.euroToCop : null,
    toCopFromUsd: (usd: number) =>
      rates.usdToCop !== null ? usd * rates.usdToCop : null,
    toEurFromUsd: (usd: number) =>
      rates.usdToEur !== null ? usd * rates.usdToEur : null,
    toEurFromCop: (cop: number) =>
      rates.euroToCop !== null && rates.euroToCop > 0
        ? cop / rates.euroToCop
        : null,
    toUsdFromCop: (cop: number) =>
      rates.usdToCop !== null && rates.usdToCop > 0
        ? cop / rates.usdToCop
        : null,
  };

  return {
    rates,
    isPrompting,
    handleSaveRates,
    convert,
  };
}

// Componente visual extendido compatible con estado inicial
export default function ExchangeRateConverter() {
  const { rates, isPrompting, handleSaveRates, convert } = useExchangeRates();
  const [eur, setEur] = useState(0);
  const [usd, setUsd] = useState(0);
  const [cop, setCop] = useState(0);
  const [inputs, setInputs] = useState({
    euroToCop: "",
    usdToCop: "",
    usdToEur: "",
  });

  if (
    isPrompting ||
    rates.euroToCop === null ||
    rates.usdToCop === null ||
    rates.usdToEur === null
  ) {
    return (
      <div className="p-4 rounded bg-gray-800 text-white text-sm space-y-2">
        <label className="block text-sm font-semibold">Tasas de cambio:</label>
        <input
          type="number"
          placeholder="EUR → COP"
          step="0.01"
          onChange={(e) => setInputs({ ...inputs, euroToCop: e.target.value })}
          className="w-full bg-gray-900 px-2 py-1 rounded border border-gray-600"
        />
        <input
          type="number"
          placeholder="USD → COP"
          step="0.01"
          onChange={(e) => setInputs({ ...inputs, usdToCop: e.target.value })}
          className="w-full bg-gray-900 px-2 py-1 rounded border border-gray-600"
        />
        <input
          type="number"
          placeholder="USD → EUR"
          step="0.0001"
          onChange={(e) => setInputs({ ...inputs, usdToEur: e.target.value })}
          className="w-full bg-gray-900 px-2 py-1 rounded border border-gray-600"
        />
        <button
          onClick={() => handleSaveRates(inputs)}
          className="bg-blue-500 text-white px-4 py-1 rounded"
        >
          Guardar tasas
        </button>
      </div>
    );
  }

  return (
    <div className="mt-4 bg-gray-800 p-4 rounded shadow text-sm text-white space-y-4">
      <div>
        <label className="block mb-1 font-medium">Convertir EUR → COP:</label>
        <input
          type="number"
          value={eur}
          onChange={(e) => setEur(parseFloat(e.target.value) || 0)}
          className="w-full bg-gray-900 text-white border border-gray-600 px-2 py-1 rounded"
        />
        <p className="mt-1 text-green-300">
          {convert.toCopFromEur(eur)?.toLocaleString("es-CO", {
            style: "currency",
            currency: "COP",
          }) ?? "—"}
        </p>
      </div>

      <div>
        <label className="block mb-1 font-medium">Convertir USD → COP:</label>
        <input
          type="number"
          value={usd}
          onChange={(e) => setUsd(parseFloat(e.target.value) || 0)}
          className="w-full bg-gray-900 text-white border border-gray-600 px-2 py-1 rounded"
        />
        <p className="mt-1 text-blue-300">
          {convert.toCopFromUsd(usd)?.toLocaleString("es-CO", {
            style: "currency",
            currency: "COP",
          }) ?? "—"}
        </p>
      </div>

      <div>
        <label className="block mb-1 font-medium">Convertir USD → EUR:</label>
        <p className="text-purple-300">
          {convert.toEurFromUsd(usd)?.toLocaleString("es-ES", {
            style: "currency",
            currency: "EUR",
          }) ?? "—"}
        </p>
      </div>

      <div>
        <label className="block mb-1 font-medium">Convertir COP → EUR:</label>
        <input
          type="number"
          value={cop}
          onChange={(e) => setCop(parseFloat(e.target.value) || 0)}
          className="w-full bg-gray-900 text-white border border-gray-600 px-2 py-1 rounded"
        />
        <p className="mt-1 text-indigo-300">
          {convert.toEurFromCop(cop)?.toLocaleString("es-ES", {
            style: "currency",
            currency: "EUR",
          }) ?? "—"}
        </p>
      </div>
    </div>
  );
}
