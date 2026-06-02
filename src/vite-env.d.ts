/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE?: string;
  readonly VITE_API_PORT?: string;
  readonly VITE_BARCODE_SCAN_DEBUG?: string;
  readonly VITE_BARCODE_SCAN_WS_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
