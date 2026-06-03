import { useCallback, useEffect, useRef } from "react";

const WEDGE_IDLE_MS = 120;

type UseLaserBarcodeInputOptions = {
  enabled: boolean;
  onScan: (value: string) => void;
};

function isEnterKey(e: KeyboardEvent): boolean {
  return (
    e.key === "Enter" ||
    e.key === "NumpadEnter" ||
    e.code === "Enter" ||
    e.code === "NumpadEnter"
  );
}

/**
 * Entrada para pistola QR (emula teclado + Enter).
 * Listeners nativos en el <input> (compatible con MUI TextField).
 */
export function useLaserBarcodeInput({ enabled, onScan }: UseLaserBarcodeInputOptions) {
  const inputRef = useRef<HTMLInputElement>(null);
  const onScanRef = useRef(onScan);
  const idleTimerRef = useRef<number | null>(null);

  onScanRef.current = onScan;

  const focus = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  const flush = useCallback((raw: string) => {
    const value = raw.trim();
    if (!value) return;
    onScanRef.current(value);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }, []);

  const clearIdleTimer = useCallback(() => {
    if (idleTimerRef.current != null) {
      window.clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  }, []);

  const scheduleIdleFlush = useCallback(
    (currentValue: string) => {
      clearIdleTimer();
      idleTimerRef.current = window.setTimeout(() => {
        idleTimerRef.current = null;
        flush(currentValue);
      }, WEDGE_IDLE_MS);
    },
    [clearIdleTimer, flush],
  );

  useEffect(() => {
    if (!enabled) {
      clearIdleTimer();
      return;
    }

    let el = inputRef.current;
    let attachTimer: number | undefined;

    const bind = (input: HTMLInputElement) => {
      const onKeyDown = (e: KeyboardEvent) => {
        if (!isEnterKey(e)) return;
        e.preventDefault();
        clearIdleTimer();
        flush(input.value);
      };

      const onInput = () => {
        scheduleIdleFlush(input.value);
      };

      input.addEventListener("keydown", onKeyDown);
      input.addEventListener("input", onInput);

      return () => {
        input.removeEventListener("keydown", onKeyDown);
        input.removeEventListener("input", onInput);
      };
    };

    let unbind: (() => void) | undefined;

    if (el) {
      unbind = bind(el);
    } else {
      attachTimer = window.setTimeout(() => {
        el = inputRef.current;
        if (el) unbind = bind(el);
      }, 50);
    }

    return () => {
      if (attachTimer != null) window.clearTimeout(attachTimer);
      unbind?.();
      clearIdleTimer();
    };
  }, [enabled, clearIdleTimer, flush, scheduleIdleFlush]);

  useEffect(() => {
    if (!enabled) return;
    const t = window.setTimeout(focus, 100);
    return () => window.clearTimeout(t);
  }, [enabled, focus]);

  return {
    inputRef,
    focus,
  };
}
