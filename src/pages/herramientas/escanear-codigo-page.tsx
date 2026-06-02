import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardMedia,
  CircularProgress,
  Snackbar,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { useBarcodeScanner } from "../../components/barcode-scanner/use-barcode-scanner";
import { useLaserBarcodeInput } from "../../components/barcode-scanner/use-laser-barcode-input";
import { ScannerErrorBoundary } from "../../components/barcode-scanner/scanner-error-boundary";
import { apiUrl } from "../../config/api";
import { parseStockBarcodePayload, type StockScanView } from "../../modules/stock-barcode";
import { formatCOP } from "../../utils/convert";
import { isBarcodeIdLike } from "../../utils/barcode-value";
import { logBarcodeScan } from "../../utils/barcode-scan-debug";
import { BarcodeScanDebugPanel } from "../../components/barcode-scanner/barcode-scan-debug-panel";

type ScanMode = "laser" | "camera";

function EscanearCodigoContent() {
  const [mode, setMode] = useState<ScanMode>("laser");
  const [cameraOn, setCameraOn] = useState(false);
  const [lastRaw, setLastRaw] = useState<string | null>(null);
  const [stockView, setStockView] = useState<StockScanView | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchStockByScan = useCallback(async (raw: string) => {
    const trimmed = raw.trim();
    logBarcodeScan("page", "scan_received", { raw: trimmed });
    setLastRaw(trimmed);
    setLookupError(null);
    setStockView(null);

    const stockId = parseStockBarcodePayload(trimmed);
    logBarcodeScan("page", "parsed_stock_id", { stockId });
    if (!stockId) {
      logBarcodeScan("page", "parse_failed", { trimmed });
      setLookupError(
        "Código de barras no reconocido. Usa etiquetas Code 128 exportadas desde Stock (DA-STOCK:…).",
      );
      setCameraOn(false);
      return;
    }

    setLookupLoading(true);
    try {
      const url = apiUrl(`/stock/${stockId}/scan`);
      logBarcodeScan("page", "api_request", { url });
      const res = await axios.get<StockScanView>(url);
      logBarcodeScan("page", "api_ok", {
        stock_id: res.data.stock_id,
        card_name: res.data.card_name,
      });
      setStockView(res.data);
      setCameraOn(false);
    } catch (e) {
      logBarcodeScan("page", "api_error", e);
      const msg = axios.isAxiosError(e)
        ? (e.response?.data?.message as string) || e.message
        : "No se pudo cargar la carta del stock.";
      setLookupError(msg);
      setCameraOn(false);
    } finally {
      setLookupLoading(false);
    }
  }, []);

  const handleScan = useCallback(
    (text: string) => {
      void fetchStockByScan(text);
    },
    [fetchStockByScan],
  );

  const laser = useLaserBarcodeInput({
    enabled: mode === "laser" && !lookupLoading && !stockView && !lookupError,
    onScan: handleScan,
  });

  const { videoRef, status, errorMessage, start } = useBarcodeScanner({
    enabled: mode === "camera" && cameraOn && !lookupLoading,
    onScan: handleScan,
  });

  const handleCopy = async () => {
    const id = stockView?.stock_id ?? lastRaw;
    if (!id) return;
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
    } catch {
      /* ignore */
    }
  };

  const handleScanAgain = () => {
    setLastRaw(null);
    setStockView(null);
    setLookupError(null);
    if (mode === "camera") {
      setCameraOn(true);
    } else {
      laser.focus();
    }
  };

  const handleModeChange = (_: unknown, next: ScanMode | null) => {
    if (!next) return;
    setMode(next);
    setLookupError(null);
    setStockView(null);
    setLastRaw(null);
    setCameraOn(next === "camera");
    if (next === "laser") {
      window.setTimeout(() => laser.focus(), 150);
    }
  };

  const scanning = status === "starting" || status === "scanning";
  const priceLabel =
    stockView?.price_cop != null
      ? formatCOP(stockView.price_cop)
      : stockView
        ? "Sin PVP"
        : null;

  return (
    <Box
      sx={{
        minHeight: "100dvh",
        bgcolor: "grey.900",
        color: "common.white",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Box
        component="header"
        sx={{
          px: 2,
          py: 1.5,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: 1,
          borderColor: "grey.800",
        }}
      >
        <Button component={Link} to="/" color="inherit" size="small">
          ← Panel
        </Button>
        <Typography variant="subtitle1" fontWeight={600}>
          Escanear código de barras
        </Typography>
        <Box sx={{ width: 72 }} />
      </Box>

      <Box sx={{ flex: 1, p: 2, display: "flex", flexDirection: "column", gap: 2 }}>
        <ToggleButtonGroup
          exclusive
          value={mode}
          onChange={handleModeChange}
          size="small"
          color="primary"
          sx={{ alignSelf: "center" }}
        >
          <ToggleButton value="laser">Pistola láser</ToggleButton>
          <ToggleButton value="camera">Cámara</ToggleButton>
        </ToggleButtonGroup>

        <Alert severity="info" sx={{ bgcolor: "grey.800", color: "grey.100" }}>
          {mode === "laser" ? (
            <>
              Conecta la pistola por USB. El cursor debe estar en el campo de abajo; al
              escanear envía el código y Enter. Etiquetas desde{" "}
              <strong>Stock → Exportar códigos de barras</strong> (Code 128).
            </>
          ) : (
            <>
              Modo cámara: enfoca el <strong>código de barras</strong> Code 128 (etiquetas
              de Stock). Requiere HTTPS en el móvil; mantén buena luz y el código en horizontal.
            </>
          )}
        </Alert>

        {mode === "laser" ? (
          <Box sx={{ maxWidth: 480, mx: "auto", width: "100%" }}>
            <TextField
              inputRef={laser.inputRef}
              fullWidth
              autoFocus
              disabled={lookupLoading}
              placeholder="Haz clic aquí y escanea con la pistola…"
              onKeyDown={laser.handleKeyDown}
              onChange={laser.handleChange}
              onBlur={() => {
                if (!lookupLoading && !stockView && !lookupError) {
                  window.setTimeout(() => laser.focus(), 50);
                }
              }}
              sx={{
                "& .MuiInputBase-root": { bgcolor: "grey.800", color: "common.white" },
                "& .MuiOutlinedInput-notchedOutline": { borderColor: "grey.600" },
              }}
            />
            {lookupLoading && (
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 2 }}>
                <CircularProgress size={22} color="inherit" />
                <Typography color="grey.400">Buscando carta…</Typography>
              </Stack>
            )}
          </Box>
        ) : (
          <Box
            sx={{
              position: "relative",
              width: "100%",
              maxWidth: 480,
              mx: "auto",
              aspectRatio: "4/3",
              bgcolor: "black",
              borderRadius: 2,
              overflow: "hidden",
            }}
          >
            {cameraOn ? (
              <video
                ref={videoRef}
                muted
                playsInline
                autoPlay
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  display: "block",
                }}
              />
            ) : (
              <Stack
                alignItems="center"
                justifyContent="center"
                sx={{ position: "absolute", inset: 0, bgcolor: "grey.900", p: 2 }}
              >
                <Button variant="contained" onClick={() => setCameraOn(true)}>
                  Activar cámara
                </Button>
              </Stack>
            )}
            {scanning && cameraOn && (
              <Box
                sx={{
                  position: "absolute",
                  inset: "30% 5%",
                  border: "2px solid",
                  borderColor: "success.light",
                  pointerEvents: "none",
                }}
              />
            )}
          </Box>
        )}

        {mode === "camera" && status === "starting" && (
          <Typography textAlign="center" color="grey.400">
            Iniciando cámara…
          </Typography>
        )}

        {mode === "camera" && status === "scanning" && (
          <Typography textAlign="center" color="success.light">
            Enfoca el código de barras en horizontal
          </Typography>
        )}

        {mode === "camera" && errorMessage && (
          <Alert severity="error">{errorMessage}</Alert>
        )}

        {lookupError && (
          <Alert severity="warning">
            {lookupError}
            {lastRaw && (
              <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                Leído: {lastRaw}
              </Typography>
            )}
          </Alert>
        )}

        {stockView && (
          <Card sx={{ maxWidth: 480, mx: "auto", width: "100%" }}>
            {stockView.image_url ? (
              <CardMedia
                component="img"
                image={stockView.image_url}
                alt={stockView.card_name}
                sx={{ maxHeight: 280, objectFit: "contain", bgcolor: "grey.100" }}
              />
            ) : null}
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {stockView.card_name || "Sin nombre"}
              </Typography>
              <Typography variant="h5" color="primary" fontWeight={700}>
                {priceLabel}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Stock ID:{" "}
                <Box component="span" sx={{ fontFamily: "monospace" }}>
                  {stockView.stock_id}
                </Box>
              </Typography>
              {isBarcodeIdLike(stockView.stock_id) && (
                <Button size="small" sx={{ mt: 1 }} onClick={() => void handleCopy()}>
                  Copiar ID
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        <BarcodeScanDebugPanel />

        <Stack direction="row" spacing={1} justifyContent="center" flexWrap="wrap">
          {stockView || lookupError ? (
            <Button variant="contained" size="large" onClick={handleScanAgain}>
              Escanear otro
            </Button>
          ) : mode === "camera" ? (
            <Button
              variant="outlined"
              color="inherit"
              onClick={() => void start()}
              disabled={scanning || !cameraOn}
            >
              Reiniciar cámara
            </Button>
          ) : (
            <Button variant="outlined" color="inherit" onClick={laser.focus}>
              Enfocar campo pistola
            </Button>
          )}
        </Stack>
      </Box>

      <Snackbar
        open={copied}
        autoHideDuration={2000}
        onClose={() => setCopied(false)}
        message="ID copiado"
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
    </Box>
  );
}

export default function EscanearCodigoPage() {
  return (
    <ScannerErrorBoundary>
      <EscanearCodigoContent />
    </ScannerErrorBoundary>
  );
}
