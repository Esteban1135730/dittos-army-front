import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatMediaError, isZxingNotFoundError } from "../../utils/format-media-error";
import { logBarcodeScan } from "../../utils/barcode-scan-debug";

/** Formatos 1D habituales en pistolas y etiquetas Code 128. */
function createLinearBarcodeReader(): BrowserMultiFormatReader {
  const hints = new Map();
  hints.set(DecodeHintType.TRY_HARDER, true);
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [
    BarcodeFormat.CODE_128,
    BarcodeFormat.CODE_39,
    BarcodeFormat.EAN_13,
    BarcodeFormat.EAN_8,
    BarcodeFormat.UPC_A,
    BarcodeFormat.UPC_E,
    BarcodeFormat.ITF,
    BarcodeFormat.QR_CODE,
  ]);
  return new BrowserMultiFormatReader(hints);
}

export type BarcodeScannerStatus =
  | "idle"
  | "starting"
  | "scanning"
  | "paused"
  | "error";

type UseBarcodeScannerOptions = {
  enabled: boolean;
  onScan: (text: string, format: string) => void;
};

async function pickRearCameraDeviceId(): Promise<string | undefined> {
  try {
    const devices = await BrowserMultiFormatReader.listVideoInputDevices();
    if (devices.length === 0) return undefined;
    const rear = devices.find((d) =>
      /back|rear|trasera|environment|wide/i.test(d.label),
    );
    return (rear ?? devices[devices.length - 1])?.deviceId;
  } catch {
    return undefined;
  }
}

export function useBarcodeScanner({ enabled, onScan }: UseBarcodeScannerOptions) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const onScanRef = useRef(onScan);
  const aliveRef = useRef(false);
  const [status, setStatus] = useState<BarcodeScannerStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  onScanRef.current = onScan;

  const cleanup = useCallback(() => {
    try {
      controlsRef.current?.stop();
    } catch {
      /* ignore */
    }
    controlsRef.current = null;
    try {
      readerRef.current?.reset();
    } catch {
      /* ignore */
    }
    readerRef.current = null;
    const video = videoRef.current;
    if (video?.srcObject instanceof MediaStream) {
      video.srcObject.getTracks().forEach((t) => t.stop());
      video.srcObject = null;
    }
  }, []);

  const start = useCallback(async () => {
    if (!aliveRef.current || !enabled) return;

    const video = videoRef.current;
    if (!video) {
      setErrorMessage("Vista de cámara no lista. Espera un momento y pulsa «Reiniciar cámara».");
      setStatus("error");
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      logBarcodeScan("camera", "no_getUserMedia");
      setErrorMessage(
        "Este navegador no permite acceder a la cámara. Prueba Chrome o Safari actualizado.",
      );
      setStatus("error");
      return;
    }

    cleanup();
    setErrorMessage(null);
    setStatus("starting");
    logBarcodeScan("camera", "starting");

    const reader = createLinearBarcodeReader();
    readerRef.current = reader;

    const onDecode = (result: { getText(): string; getBarcodeFormat(): unknown } | undefined, err: unknown) => {
      if (!aliveRef.current) return;
          if (result) {
            try {
              const text = result.getText();
              const format = String(result.getBarcodeFormat());
              logBarcodeScan("camera", "decoded", { format, text });
              cleanup();
              setStatus("paused");
              onScanRef.current(text, format);
            } catch (e) {
              if (isZxingNotFoundError(e)) return;
              logBarcodeScan("camera", "decode_handler_error", e);
              const msg = formatMediaError(e);
              if (!msg) return;
              setErrorMessage(msg);
              setStatus("error");
            }
            return;
          }
          if (err && !isZxingNotFoundError(err)) {
            logBarcodeScan("camera", "frame_error", {
              name: (err as { name?: string }).name,
              message: err instanceof Error ? err.message : String(err),
            });
          }
    };

    try {
      const deviceId = await pickRearCameraDeviceId();
      let controls: IScannerControls;

      if (deviceId) {
        controls = await reader.decodeFromVideoDevice(deviceId, video, onDecode);
      } else {
        try {
          controls = await reader.decodeFromConstraints(
            { video: { facingMode: { ideal: "environment" } } },
            video,
            onDecode,
          );
        } catch {
          controls = await reader.decodeFromConstraints(
            { video: true },
            video,
            onDecode,
          );
        }
      }

      if (!aliveRef.current) {
        controls.stop();
        return;
      }

      controlsRef.current = controls;
      setStatus("scanning");
      logBarcodeScan("camera", "scanning");
    } catch (e) {
      if (!aliveRef.current) return;
      if (isZxingNotFoundError(e)) {
        logBarcodeScan("camera", "start_not_found_ignored", e);
        return;
      }
      logBarcodeScan("camera", "start_failed", e);
      const msg = formatMediaError(e);
      if (msg) {
        setErrorMessage(msg);
        setStatus("error");
      }
      cleanup();
    }
  }, [cleanup, enabled]);

  useEffect(() => {
    aliveRef.current = true;

    if (!enabled) {
      cleanup();
      setStatus("idle");
      return () => {
        aliveRef.current = false;
        cleanup();
      };
    }

    // Esperar a que el <video> exista en el DOM (StrictMode monta dos veces).
    const timer = window.setTimeout(() => {
      void start();
    }, 300);

    return () => {
      aliveRef.current = false;
      window.clearTimeout(timer);
      cleanup();
      setStatus("idle");
    };
  }, [enabled, start, cleanup]);

  return {
    videoRef,
    status,
    errorMessage,
    start,
    stop: cleanup,
  };
}
