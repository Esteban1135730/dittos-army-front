# Spec técnico — Dittos Army Mobile (inventario + sync por IP)

Arquitectura general: `docs/mobile/architecture.md`.  
Contratos API servidor: `docs/backend/features/020-stock-qr-escaner/spec-tecnico.md`, `StockController` (`GET /stock`).

## Identidad del producto

| Campo | Valor |
|-------|--------|
| Nombre visible | **Dittos Army Mobile** |
| Carpeta repo | `dittos-army-mobile/` |
| `app.json` → `name` | `Dittos Army Mobile` |
| `app.json` → `slug` | `dittos-army-mobile` |

## Paquete

```
dittos-army-mobile/          # Dittos Army Mobile — raíz del repo de producto
  app/                       # Expo Router (tabs)
  src/
    db/                      # Drizzle + migraciones SQLite
    sync/                    # motor diff, hash, progreso
    api/                     # cliente HTTP por IP
    features/
      inventory/
      scan/
      sync-screen/
    shared/                  # re-export o symlink a packages/shared
  app.json
  package.json
packages/shared/             # opcional: tipos + parsers QR compartidos
```

Stack: **Expo SDK** (React Native), **TypeScript**, **expo-sqlite**, **Drizzle ORM**, **expo-camera** (QR).

## API del servidor (existente — MVP pull)

| Método | Ruta | Uso |
|--------|------|-----|
| `GET` | `/stock` | Snapshot completo para diff (array enriquecido) |
| `GET` | `/stock/:id/scan` | Ficha enriquecida online (`StockScanView`); opcional si SQLite basta offline |
| `GET` | `/stock/:id` | Detalle línea (fallback) |

### Formato remoto (`GET /stock`)

Cada elemento incluye campos del documento Mongo más enriquecimiento del controlador:

```typescript
type RemoteStockLine = {
  _id: string;
  card_id: string;
  card_name?: string;
  card_state?: string;
  language?: string;
  languaje?: string;       // legacy; normalizar a language
  rareza?: string | null;
  shipment: number;
  unity_cost: number;
  cards_in_shipmet: number;
  currency: string;
  image_url?: string;
  holofoil?: boolean;
  league_card?: boolean;
  incoming_notes?: string;
  tags?: string[];
  card_cost?: number;      // calculado en API
  pvp?: number;
  pvp_currency?: string;
};
```

Referencia implementación: `dittos-army-back/src/controller/stock.controller.ts` — `listStock()`.

### Probar conexión (MVP)

```
GET http://{host}:{port}/stock
Accept: application/json
Timeout: 5000 ms
```

Éxito: HTTP 200 y cuerpo JSON array (vacío permitido).  
Validación mínima: si `length > 0`, primer elemento tiene `_id` y `card_id` string.

### Ampliación opcional en back (no bloqueante MVP)

| Método | Ruta | Respuesta |
|--------|------|-----------|
| `GET` | `/health` | `{ "ok": true, "service": "dittos-army-back" }` |

Permite probar conexión sin descargar todo el stock. Implementar solo si el humano aprueba un incremento back mínimo.

## SQLite — esquema

```sql
CREATE TABLE sync_config (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  server_host TEXT NOT NULL DEFAULT '',
  server_port INTEGER NOT NULL DEFAULT 3000,
  last_sync_at TEXT,
  last_sync_status TEXT,      -- 'ok' | 'error' | 'cancelled'
  last_sync_summary_json TEXT
);

CREATE TABLE stock_line (
  stock_id TEXT PRIMARY KEY,
  card_id TEXT NOT NULL,
  card_name TEXT NOT NULL DEFAULT '',
  card_state TEXT,
  language TEXT,
  rareza TEXT,
  shipment REAL NOT NULL,
  unity_cost REAL NOT NULL,
  cards_in_shipmet INTEGER NOT NULL,
  currency TEXT NOT NULL,
  image_url TEXT,
  holofoil INTEGER NOT NULL DEFAULT 0,
  league_card INTEGER NOT NULL DEFAULT 0,
  incoming_notes TEXT,
  tags_json TEXT NOT NULL DEFAULT '[]',
  card_cost REAL,
  pvp REAL,
  pvp_currency TEXT,
  sync_hash TEXT NOT NULL,
  updated_at_local TEXT NOT NULL
);

CREATE INDEX idx_stock_line_card_id ON stock_line(card_id);
CREATE INDEX idx_stock_line_card_name ON stock_line(card_name);
CREATE INDEX idx_stock_line_card_state ON stock_line(card_state);
```

Índices adicionales según volumen real (>5k líneas).

## Normalización y hash de sync

Campos incluidos en payload canónico (orden estable JSON):

- `card_id`, `card_name`, `card_state`
- `language` ← `(language ?? languaje ?? '').trim().toLowerCase()`
- `rareza` (null si ausente)
- `shipment`, `unity_cost`, `cards_in_shipmet`, `currency`
- `image_url`, `holofoil`, `league_card`, `incoming_notes`
- `tags` ← array ordenado alfabéticamente
- `card_cost`, `pvp`, `pvp_currency`

`sync_hash` = SHA-256 del JSON canónico (UTF-8). Comparar hash local vs remoto para decidir UPDATE vs SKIP.

Implementación compartida recomendada en `packages/shared/src/sync/stock-sync-hash.ts`.

## Motor de sync — pseudocódigo

```typescript
type SyncServerConfig = { host: string; port: number };
type SyncSummary = { inserted: number; updated: number; deleted: number; unchanged: number };

async function syncStockPull(
  cfg: SyncServerConfig,
  onProgress: (p: SyncProgress) => void,
  signal?: AbortSignal,
): Promise<SyncSummary> {
  const url = `http://${cfg.host}:${cfg.port}/stock`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new SyncError('HTTP', res.status);
  const remote: RemoteStockLine[] = await res.json();
  if (!Array.isArray(remote)) throw new SyncError('INVALID_BODY');

  const localMap = await db.getStockIdHashMap();
  const remoteIds = new Set<string>();
  const summary = { inserted: 0, updated: 0, deleted: 0, unchanged: 0 };

  await db.transaction(async (tx) => {
    const sorted = [...remote].sort((a, b) =>
      (a.card_name ?? '').localeCompare(b.card_name ?? '') || a._id.localeCompare(b._id),
    );

    for (let i = 0; i < sorted.length; i++) {
      if (signal?.aborted) throw new SyncError('CANCELLED');
      const line = sorted[i];
      const stockId = line._id;
      remoteIds.add(stockId);
      const hash = computeStockSyncHash(line);
      const localHash = localMap.get(stockId);

      if (localHash === undefined) {
        await tx.upsertStockLine(stockId, line, hash);
        summary.inserted++;
      } else if (localHash !== hash) {
        await tx.upsertStockLine(stockId, line, hash);
        summary.updated++;
      } else {
        summary.unchanged++;
      }
      onProgress({ current: i + 1, total: sorted.length, stockId, summary });
    }

    for (const localId of localMap.keys()) {
      if (!remoteIds.has(localId)) {
        await tx.deleteStockLine(localId);
        summary.deleted++;
      }
    }

    await tx.saveSyncConfig(cfg, summary);
  });

  return summary;
}
```

Orden estable del servidor en UI = orden de iteración anterior (nombre, luego `_id`).

## Código reutilizable del monorepo

| Origen | Destino móvil |
|--------|----------------|
| `dittos-army-front/src/modules/stock-barcode/stock-barcode-payload.ts` | `packages/shared` o copia inicial en `src/scan/parse-stock-qr.ts` |
| `dittos-army-back/src/service/stock-scan.service.ts` — tipo `StockScanView` | Tipo UI detalle escaneo |
| Reglas `stock-sellable`, labels rareza/idioma | Fase 2 si se muestra “vendible” en móvil |

Preferir **extraer** parser QR a `packages/shared` en el mismo incremento para no duplicar.

## Cliente HTTP

```typescript
function baseUrl(cfg: SyncServerConfig): string {
  return `http://${cfg.host}:${cfg.port}`;
}
```

- Sin auth en MVP.
- Reintentos: 0 en “Probar conexión”; 1 reintento opcional en sync completa si falla red transitoria.
- Persistir `server_host` / `server_port` en `sync_config` y AsyncStorage para precargar formulario.

## Escaneo QR

- Prefijo: `STOCK_QR_PREFIX = 'DA-STOCK:'` (ver `stock-barcode-payload.ts`).
- Parser: `parseStockQrPayload(raw) → stock_id | null`.
- Tras parseo: `SELECT * FROM stock_line WHERE stock_id = ?`.
- Permisos: cámara vía Expo (`app.json` plugins).

## UI — rutas Expo Router (propuesta)

| Ruta | Pantalla |
|------|----------|
| `/(tabs)/inventory` | Lista + búsqueda |
| `/(tabs)/scan` | Cámara QR |
| `/(tabs)/sync` | IP, probar, sincronizar, progreso |
| `/stock/[id]` | Detalle línea |

## Red — requisitos en el PC servidor

1. Nest escuchando en **`0.0.0.0:3000`** (no solo `127.0.0.1`).
2. Firewall Windows/macOS: permitir TCP entrante puerto 3000 en red **Privada**.
3. Teléfono y PC en la misma subred WiFi (sin “aislamiento de cliente” en el router).

## Android — HTTP cleartext

En `app.json` / `expo-build-properties`, permitir tráfico cleartext para sync LAN:

```json
{
  "expo": {
    "android": {
      "usesCleartextTraffic": true
    }
  }
}
```

iOS: App Transport Security — excepción para dominios locales o usar IP (documentar en README del paquete móvil).

## Rendimiento

| Escala | Comportamiento esperado |
|--------|-------------------------|
| ~500 líneas | Sync &lt; 10 s en LAN |
| ~2000 líneas | Sync &lt; 30 s; progreso cada registro o cada 5 registros |
| &gt; 5000 | Evaluar paginación en back (fuera MVP) |

Una sola petición HTTP; el trabajo 1 a 1 es local (CPU + SQLite en transacción).

## Seguridad

- No almacenar credenciales en MVP.
- IP en almacenamiento local del dispositivo.
- Documentar: no usar sync en redes públicas sin HTTPS + auth.

## Tests

| Ámbito | Herramienta | Casos |
|--------|-------------|-------|
| Hash / normalización | Vitest en `packages/shared` | Mismo input → mismo hash; tags desordenados → igual |
| Parser QR | Vitest | Port desde front existente |
| Motor sync | Vitest con SQLite in-memory | insert/update/delete/unchanged |
| UI | Manual / Maestro (fase posterior) | SA-01 … SA-06 del spec funcional |

El paquete móvil no tiene runner obligatorio en repo hasta definirlo en `dittos-army-mobile/package.json`; priorizar tests unitarios del motor sync.

## Fase 2 — push (referencia, no MVP)

Tabla `pending_change`:

```sql
CREATE TABLE pending_change (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stock_id TEXT,
  operation TEXT NOT NULL,  -- 'create' | 'update'
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
```

Endpoints back: `POST /stock`, `POST /stock/update` (`StockDto`). Requiere diseño de conflictos y posible `updated_at` en esquema Mongo.

## Criterios de done técnico (MVP)

- [ ] Paquete `dittos-army-mobile` arranca en Expo
- [ ] SQLite migrada; persistencia sobrevive reinicio app
- [ ] Pantalla sync: IP, probar, diff 1 a 1 con progreso
- [ ] Lista y detalle offline post-sync
- [ ] Escaneo QR offline con parser compartido
- [ ] Tests unitarios hash + motor sync
- [ ] README en `dittos-army-mobile/` con requisitos de red LAN
