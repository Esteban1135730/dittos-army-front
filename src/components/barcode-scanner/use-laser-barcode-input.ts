import {
  useCallback,
  useEffect,
  useRef,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import { logBarcodeScan } from "../../utils/barcode-scan-debug";

const WEDGE_IDLE_MS = 120;

type UseLaserBarcodeInputOptions = {
  enabled: boolean;
  onScan: (value: string) => void;
};

/**
 * Entrada para pistola láser (emula teclado + Enter).
 * Mantiene el foco en un input y dispara al pulsar Enter o tras pausa corta entre caracteres.
 */
export function useLaserBarcodeInput({ enabled, onScan }: UseLaserBarcodeInputOptions) {
  const inputRef = useRef<HTMLInputElement>(null);
  const onScanRef = useRef(onScan);
  const idleTimerRef = useRef<number | null>(null);

  onScanRef.current = onScan;

  const focus = useCallback(() => {
    if (enabled) {
      inputRef.current?.focus();
    }
  }, [enabled]);

  const flush = useCallback((raw: string, reason: "enter" | "idle") => {
    const value = raw.trim();
    logBarcodeScan("laser", "flush", { reason, length: value.length, value });
    if (!value) {
      logBarcodeScan("laser", "flush_empty", { reason });
      return;
    }
    onScanRef.current(value);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }, []);

  const scheduleIdleFlush = useCallback(
    (currentValue: string) => {
      if (idleTimerRef.current != null) {
        window.clearTimeout(idleTimerRef.current);
      }
      idleTimerRef.current = window.setTimeout(() => {
        idleTimerRef.current = null;
        logBarcodeScan("laser", "idle_timeout", {
          length: currentValue.length,
          preview: currentValue.slice(0, 80),
        });
        flush(currentValue, "idle");
      }, WEDGE_IDLE_MS);
    },
    [flush],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      logBarcodeScan("laser", "keydown", {
        key: e.key,
        code: e.code,
        len: e.currentTarget.value.length,
      });
      if (e.key === "Enter") {
        e.preventDefault();
        if (idleTimerRef.current != null) {
          window.clearTimeout(idleTimerRef.current);
          idleTimerRef.current = null;
        }
        flush(e.currentTarget.value, "enter");
      }
    },
    [flush],
  );

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value;
      logBarcodeScan("laser", "input", {
        length: v.length,
        lastChar: v.slice(-1),
        preview: v.slice(-24),
      });
      scheduleIdleFlush(v);
    },
    [scheduleIdleFlush],
  );

  useEffect(() => {
    logBarcodeScan("laser", enabled ? "enabled" : "disabled");
    if (!enabled) return;
    const t = window.setTimeout(focus, 100);
    return () => window.clearTimeout(t);
  }, [enabled, focus]);

  useEffect(() => {
    return () => {
      if (idleTimerRef.current != null) {
        window.clearTimeout(idleTimerRef.current);
      }
    };
  }, []);

  return {
    inputRef,
    handleKeyDown,
    handleChange,
    focus,
  };
}
