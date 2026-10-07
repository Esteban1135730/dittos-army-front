# Spec funcional (front) — Historial CardTrader

Espejo del backend `039-cardtrader-orders-historial`. La UX vive en el **panel Pokémon**.

## Ruta

- `/cardtrader-orders-historial` (nombre visible: **Historial compras CardTrader** o **CardTrader — compras y ventas**).

Entrada: enlace desde Tránsito CardTrader o menú CardTrader / herramientas.

## Layout

1. **Barra de filtros**: fechas, compras/ventas/ambos, owner, búsqueda.
2. **Resumen**: pedidos CT escaneados, ítems sin TCGdex, aviso si fetch CT truncado.
3. **Tabla de variantes** (paginada): columnas según spec back; **fecha última venta local** visible en fila.
4. **Badge** «En reserva» cuando `flags.in_reserva_now`.
5. **Expandir fila** → timeline de eventos (compra CT, venta local con fecha, reserva, tránsito, venta CT).

## Imágenes

`resolveTransitCatalogImageSrc` + `useTcgdexCardDetails` (mismo patrón que tránsito).

## Estados UI

- Loading skeleton tabla.
- Error CT: alerta amarilla; datos locales siguen visibles si el API lo permite.
- Vacío: copy «No hay movimientos en el rango».

## Criterios de aceptación (front)

1. Operador encuentra una carta por nombre y ve comprado vs vendido vs reservado.
2. Fecha de venta local legible (`es-CO`).
3. Expandir fila muestra al menos un evento de compra CT y uno de venta/reserva cuando existan en fixtures/manual QA.

## Fuera de alcance v1

- Export PDF/CSV.
- Edición de stock o pedidos desde esta pantalla.
