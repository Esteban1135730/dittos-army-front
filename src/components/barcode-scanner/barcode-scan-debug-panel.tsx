import { useEffect, useState } from "react";
import { Box, Collapse, Typography } from "@mui/material";
import {
  initBarcodeScanDebugWebSocket,
  subscribeBarcodeScanLog,
  type BarcodeScanLogEntry,
} from "../../utils/barcode-scan-debug";

const MAX_LINES = 40;

export function BarcodeScanDebugPanel() {
  const [open, setOpen] = useState(true);
  const [lines, setLines] = useState<BarcodeScanLogEntry[]>([]);
  const show =
    import.meta.env.DEV || import.meta.env.VITE_BARCODE_SCAN_DEBUG === "true";

  useEffect(() => {
    if (!show) return;
    initBarcodeScanDebugWebSocket();
    return subscribeBarcodeScanLog((entry) => {
      setLines((prev) => [...prev.slice(-(MAX_LINES - 1)), entry]);
    });
  }, [show]);

  if (!show) return null;

  const wsHint =
    import.meta.env.VITE_BARCODE_SCAN_WS_URL ||
    new URLSearchParams(window.location.search).get("barcodeWs");

  return (
    <Box
      sx={{
        mt: 1,
        p: 1,
        bgcolor: "grey.950",
        border: "1px solid",
        borderColor: "grey.700",
        borderRadius: 1,
        maxWidth: 480,
        mx: "auto",
        width: "100%",
      }}
    >
      <Typography
        variant="caption"
        component="button"
        type="button"
        onClick={() => setOpen((v) => !v)}
        sx={{
          color: "grey.400",
          cursor: "pointer",
          border: "none",
          background: "none",
          p: 0,
          font: "inherit",
        }}
      >
        {open ? "▼" : "▶"} Log escáner (consola + WebSocket opcional)
      </Typography>
      {wsHint ? (
        <Typography variant="caption" display="block" color="success.light" sx={{ mt: 0.5 }}>
          WS: {wsHint}
        </Typography>
      ) : (
        <Typography variant="caption" display="block" color="grey.600" sx={{ mt: 0.5 }}>
          WS: añade ?barcodeWs=ws://127.0.0.1:9876 o VITE_BARCODE_SCAN_WS_URL
        </Typography>
      )}
      <Collapse in={open}>
        <Box
          component="pre"
          sx={{
            mt: 1,
            mb: 0,
            fontSize: 10,
            color: "grey.300",
            maxHeight: 160,
            overflow: "auto",
            whiteSpace: "pre-wrap",
            wordBreak: "break-all",
          }}
        >
          {lines.length === 0
            ? "Sin eventos aún. Escanea o pulsa teclas en el campo pistola."
            : lines
                .map(
                  (l) =>
                    `${l.ts.slice(11, 23)} ${l.source} ${l.event}${
                      l.detail != null ? ` ${JSON.stringify(l.detail)}` : ""
                    }`,
                )
                .join("\n")}
        </Box>
      </Collapse>
    </Box>
  );
}
