# Spec técnico (front) — Historial CardTrader

## Archivos previstos

- `src/pages/cardtrader-orders-historial/cardtrader-orders-historial-page.tsx`
- `src/pages/cardtrader-orders-historial/use-orders-historial.ts` (TanStack Query)
- `src/pages/cardtrader-orders-historial/variant-events-panel.tsx`
- Tipos compartidos en `cardtrader-orders-historial.types.ts`

## API

- `GET ${apiUrl('/cardtrader/orders-historial')}` con query params alineados al back.
- Detalle eventos: query separada `enabled: expandedRow === variantKey`.

## Query keys

- `['cardtrader-orders-historial', from, to, orderAs, owner, q, page]`
- `['cardtrader-orders-historial-events', variantKey]`

## Rutas

Registrar lazy en `panel-routes.tsx` bajo layout Pokémon.

## Tests (Vitest)

- Mapper fila → props tabla (fechas, badges reserva).
- Render smoke con datos mock (opcional si el repo ya testea páginas similares).

## Coherencia

- MUI + Tailwind mix como `cardtrader-transit-*`.
- `formatCOP`, `operationalRarezaLabel`, owners config.
