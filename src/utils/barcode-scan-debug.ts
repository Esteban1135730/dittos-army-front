export type BarcodeScanLogEntry = {
  ts: string;
  source: string;
  event: string;
  detail?: unknown;
};

const LOG_PREFIX = "[barcode-scan]";
const listeners = new Set<(entry: BarcodeScanLogEntry) => void>();

let ws: WebSocket | null = null;
let wsUrl: string | null = null;

function isDebugEnabled(): boolean {
  return import.meta.env.DEV || import.meta.env.VITE_BARCODE_SCAN_DEBUG === "true";
}

function resolveWsUrl(): string | null {
  if (typeof window === "undefined") return null;
  const fromEnv = import.meta.env.VITE_BARCODE_SCAN_WS_URL?.trim();
  if (fromEnv) return fromEnv;
  const q = new URLSearchParams(window.location.search).get("barcodeWs");
  return q?.trim() || null;
}

/** Conecta WebSocket de depuración (opcional). Reenvía cada evento de lectura. */
export function initBarcodeScanDebugWebSocket(url?: string): void {
  if (typeof WebSocket === "undefined") return;
  const target = url?.trim() || resolveWsUrl();
  if (!target) return;
  if (ws && wsUrl === target && ws.readyState <= WebSocket.OPEN) return;

  ws?.close();
  wsUrl = target;
  ws = new WebSocket(target);

  ws.onopen = () => {
    logBarcodeScan("websocket", "connected", { url: target });
  };
  ws.onmessage = (ev) => {
    logBarcodeScan("websocket", "message_in", {
      data: typeof ev.data === "string" ? ev.data.slice(0, 200) : ev.data,
    });
  };
  ws.onerror = () => {
    logBarcodeScan("websocket", "error", { url: target });
  };
  ws.onclose = (ev) => {
    logBarcodeScan("websocket", "closed", { code: ev.code, reason: ev.reason });
    ws = null;
  };
}

export function subscribeBarcodeScanLog(fn: (entry: BarcodeScanLogEntry) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function logBarcodeScan(
  source: string,
  event: string,
  detail?: unknown,
): void {
  if (!isDebugEnabled()) return;

  const entry: BarcodeScanLogEntry = {
    ts: new Date().toISOString(),
    source,
    event,
    detail,
  };

  console.log(LOG_PREFIX, source, event, detail ?? "");
  listeners.forEach((fn) => fn(entry));

  if (ws?.readyState === WebSocket.OPEN) {
    try {
      ws.send(JSON.stringify(entry));
    } catch (e) {
      console.warn(LOG_PREFIX, "ws send failed", e);
    }
  }
}

export function closeBarcodeScanDebugWebSocket(): void {
  ws?.close();
  ws = null;
  wsUrl = null;
}
