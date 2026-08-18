# Spec técnico — Pedidos de stock en clientes (panel)

Contrato API: alineado con `docs/backend/features/038-pedidos-stock-entrega/spec-tecnico.md`.  
Paquete: **`dittos-army-front`**.

## Tipos

`src/pages/clientes/pedido-types.ts` + `API_PEDIDO = apiUrl("/pedido")`.

Estados y entrega como el back. `PedidoItem` incluye `lines: PedidoLine[]`.

Catálogo: `GET /pedido/tiendas` (no hardcodear direcciones en el front salvo fallback de loading). Opcional: copiar ids en constante solo para tests.

## React Query

| Key | Uso | Invalidar |
|-----|-----|-----------|
| `["pedido-tiendas"]` | catálogo, `staleTime` largo | casi nunca |
| `["pedidos", clientId]` | historial | crear/pagar/entregar/cancelar/PATCH, y al reservar/quitar carta |
| `["pedido", pedidoId]` | detalle si se usa | igual |
| `["reservas", clientId]` | líneas vivas | igual que hoy + pedido |

## Archivos a tocar

| Archivo | Cambio |
|---------|--------|
| `cliente-types.ts` | quitar `tienda_entrega` / `tiendaEntrega` |
| `cliente-form-dialog.tsx` | quitar campo y validación |
| `clientes.tsx` | quitar columna tienda |
| `cliente-detalle.tsx` | historial, pagar/entregar, WhatsApp sin tienda de cliente |
| `reservar-cartas.tsx` | dialog nuevo/editar pedido; `pedido_id` al reservar |
| `mensaje-reserva-pedido.ts` | `descripcionEntrega(pedido)` en lugar de `tiendaEntrega: string` |
| `mensaje-reserva-pedido.test.ts` | casos tienda vs envío |
| `imprimir-pedidos.tsx` | agrupar por pedido |
| `venta-cliente-pdf.ts` | línea de entrega del pedido |
| `nuevo-pedido-dialog.tsx` | **nuevo** — checkbox, select, envío, fecha |
| `pedido-entrega-label.ts` | **nuevo** — texto puro + tests |

## Flujo reservar

1. `useQuery` pedidos del cliente.
2. `openPedido = pedidos.find(p => p.status === 'reservado')`.
3. Sin `openPedido`: no habilitar botones de reservar stock; dialog obligatorio.
4. `axios.post(API_RESERVA, { ..., pedido_id: openPedido.id })`.

## Pagar / entregar

- Detalle: `POST ${API_PEDIDO}/${id}/pagar` y `/entregar`.
- Confirmar con dialog nativo o MUI (`window.confirm` está hoy; preferir Dialog MUI si ya hay patrón en la página).

## Fecha

`type="date"` en zona local; enviar `YYYY-MM-DD`. Mostrar `es-CO` dateStyle short.

## Accesibilidad

- Dialog con título, labels en checkbox/select/fecha.
- Chips de estado con texto (no solo color): Reservado / Pagado / Entregado.

## Tests Vitest (`*.test.ts`)

- `pedido-entrega-label.test.ts`: tienda (nombre + dirección), envío (ciudad + punto).
- Actualizar `mensaje-reserva-pedido.test.ts`.

## Riesgos

- Páginas que aún lean `client.tienda_entrega` (grep al implementar).
- Imprimir pedidos: clientes sin pedido migrado.
