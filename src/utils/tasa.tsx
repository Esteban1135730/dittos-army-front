import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

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

const fieldSx = {
  "& .MuiInputBase-root": {
    bgcolor: "rgba(0,0,0,0.25)",
    color: "grey.100",
    fontSize: "0.8rem",
  },
  "& .MuiInputLabel-root": { color: "grey.400", fontSize: "0.75rem" },
  "& .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255,255,255,0.2)" },
};

type ExchangeRateConverterProps = {
  /** Vista reducida para el panel lateral */
  compact?: boolean;
};

export default function ExchangeRateConverter({
  compact = false,
}: ExchangeRateConverterProps) {
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
      <Box
        sx={{
          p: compact ? 0 : 1,
          borderRadius: 1,
          bgcolor: compact ? "transparent" : "rgba(0,0,0,0.2)",
        }}
      >
        <Typography variant="caption" sx={{ color: "grey.300", fontWeight: 600, mb: 1, display: "block" }}>
          Tasas de cambio
        </Typography>
        <Stack spacing={1}>
          <TextField
            size="small"
            type="number"
            placeholder="EUR → COP"
            inputProps={{ step: "0.01" }}
            onChange={(e) => setInputs({ ...inputs, euroToCop: e.target.value })}
            fullWidth
            sx={fieldSx}
          />
          <TextField
            size="small"
            type="number"
            placeholder="USD → COP"
            inputProps={{ step: "0.01" }}
            onChange={(e) => setInputs({ ...inputs, usdToCop: e.target.value })}
            fullWidth
            sx={fieldSx}
          />
          <TextField
            size="small"
            type="number"
            placeholder="USD → EUR"
            inputProps={{ step: "0.0001" }}
            onChange={(e) => setInputs({ ...inputs, usdToEur: e.target.value })}
            fullWidth
            sx={fieldSx}
          />
          <Button
            size="small"
            variant="contained"
            color="secondary"
            onClick={() => handleSaveRates(inputs)}
            fullWidth
          >
            Guardar tasas
          </Button>
        </Stack>
      </Box>
    );
  }

  if (compact) {
    return (
      <Box>
        <Typography variant="caption" sx={{ color: "grey.400", fontWeight: 700, letterSpacing: "0.06em", display: "block", mb: 1 }}>
          CONVERSOR
        </Typography>
        <Stack spacing={1.25}>
          <TextField
            size="small"
            type="number"
            label="EUR"
            value={eur || ""}
            onChange={(e) => setEur(parseFloat(e.target.value) || 0)}
            fullWidth
            sx={fieldSx}
          />
          <Typography variant="caption" sx={{ color: "#86efac", lineHeight: 1.3 }}>
            {convert.toCopFromEur(eur)?.toLocaleString("es-CO", {
              style: "currency",
              currency: "COP",
            }) ?? "—"}
          </Typography>
          <TextField
            size="small"
            type="number"
            label="USD"
            value={usd || ""}
            onChange={(e) => setUsd(parseFloat(e.target.value) || 0)}
            fullWidth
            sx={fieldSx}
          />
          <Typography variant="caption" sx={{ color: "#93c5fd", lineHeight: 1.3 }}>
            {convert.toCopFromUsd(usd)?.toLocaleString("es-CO", {
              style: "currency",
              currency: "COP",
            }) ?? "—"}
          </Typography>
        </Stack>
      </Box>
    );
  }

  return (
    <Box sx={{ mt: 2, p: 2, borderRadius: 2, bgcolor: "rgba(0,0,0,0.2)" }}>
      <Typography variant="subtitle2" sx={{ color: "grey.200", mb: 2 }}>
        Conversor de divisas
      </Typography>
      <Stack spacing={2}>
        <Box>
          <TextField
            size="small"
            type="number"
            label="EUR → COP"
            value={eur || ""}
            onChange={(e) => setEur(parseFloat(e.target.value) || 0)}
            fullWidth
            sx={fieldSx}
          />
          <Typography variant="body2" sx={{ mt: 0.5, color: "#86efac" }}>
            {convert.toCopFromEur(eur)?.toLocaleString("es-CO", {
              style: "currency",
              currency: "COP",
            }) ?? "—"}
          </Typography>
        </Box>
        <Box>
          <TextField
            size="small"
            type="number"
            label="USD → COP"
            value={usd || ""}
            onChange={(e) => setUsd(parseFloat(e.target.value) || 0)}
            fullWidth
            sx={fieldSx}
          />
          <Typography variant="body2" sx={{ mt: 0.5, color: "#93c5fd" }}>
            {convert.toCopFromUsd(usd)?.toLocaleString("es-CO", {
              style: "currency",
              currency: "COP",
            }) ?? "—"}
          </Typography>
        </Box>
        <Box>
          <Typography variant="caption" sx={{ color: "grey.400" }}>
            USD → EUR:{" "}
            {convert.toEurFromUsd(usd)?.toLocaleString("es-ES", {
              style: "currency",
              currency: "EUR",
            }) ?? "—"}
          </Typography>
        </Box>
        <Box>
          <TextField
            size="small"
            type="number"
            label="COP → EUR"
            value={cop || ""}
            onChange={(e) => setCop(parseFloat(e.target.value) || 0)}
            fullWidth
            sx={fieldSx}
          />
          <Typography variant="body2" sx={{ mt: 0.5, color: "#a5b4fc" }}>
            {convert.toEurFromCop(cop)?.toLocaleString("es-ES", {
              style: "currency",
              currency: "EUR",
            }) ?? "—"}
          </Typography>
        </Box>
      </Stack>
    </Box>
  );
}
